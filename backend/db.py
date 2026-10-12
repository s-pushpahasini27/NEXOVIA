import json
import os
import sqlite3
import re
from urllib.parse import urlparse, unquote, parse_qs
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parent.parent

def cloud_database():
    return bool(os.getenv('DATABASE_URL'))


class PostgresConnection:
    """Small compatibility layer for the application's parameterized SQLite queries."""

    def __init__(self, connection):
        self.connection = connection

    def execute(self, sql, params=()):
        if sql.strip().upper() == 'BEGIN IMMEDIATE':
            return None  # pg8000 starts a transaction automatically.
        ignore = bool(re.match(r'\s*INSERT\s+OR\s+IGNORE\s+INTO\b', sql, re.I))
        if ignore:
            sql = re.sub(r'INSERT\s+OR\s+IGNORE\s+INTO', 'INSERT INTO', sql, count=1, flags=re.I) + ' ON CONFLICT DO NOTHING'
        cursor = self.connection.cursor()
        cursor.execute(sql, params)
        return PostgresResult(cursor)

    def commit(self):
        self.connection.commit()

    def rollback(self):
        self.connection.rollback()

    def close(self):
        self.connection.close()


class PostgresResult:
    def __init__(self, cursor):
        self.cursor = cursor

    def fetchone(self):
        row = self.cursor.fetchone()
        return dict(zip((column[0] for column in self.cursor.description), row)) if row is not None else None

    def fetchall(self):
        columns = [column[0] for column in self.cursor.description]
        return [dict(zip(columns, row)) for row in self.cursor.fetchall()]


def postgres_connection():
    import pg8000.dbapi
    pg8000.dbapi.paramstyle = 'qmark'
    parsed = urlparse(os.environ['DATABASE_URL'])
    if parsed.scheme not in ('postgres', 'postgresql') or not parsed.hostname:
        raise ValueError('DATABASE_URL must be a PostgreSQL URL.')
    options = parse_qs(parsed.query)
    connection = pg8000.dbapi.connect(
        user=unquote(parsed.username or ''), password=unquote(parsed.password or ''),
        host=parsed.hostname, port=parsed.port or 5432,
        database=unquote(parsed.path.lstrip('/')),
        ssl_context=True if options.get('sslmode', ['require'])[0] != 'disable' else False,
        timeout=20,
    )
    return PostgresConnection(connection)

def data_dir():
    p = Path(os.getenv('NEXOVIA_DATA_DIR', str(ROOT / 'data'))).resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p

def now():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

def uid():
    return str(uuid4())

def dump(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))

@contextmanager
def database():
    if cloud_database():
        db = postgres_connection()
    else:
        db = sqlite3.connect(data_dir() / 'nexovia.sqlite3', timeout=20)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def initialize():
    with database() as db:
        if cloud_database():
            from .postgres_schema import initialize_postgres
            initialize_postgres(db)
            return
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)')
        for file in sorted((ROOT / 'backend/migrations').glob('*.sql')):
            if not db.execute('SELECT 1 FROM schema_migrations WHERE name=?', (file.name,)).fetchone():
                name = file.name.replace("'", "''")
                db.executescript('BEGIN;\n' + file.read_text() + "\nINSERT INTO schema_migrations VALUES ('" + name + "');\nCOMMIT;")
        from .retrieval import index_resource
        for resource in rows(db, "SELECT * FROM resources WHERE content<>'' AND deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM resource_chunks WHERE resource_id=resources.id)"):
            index_resource(db, resource)

def one(db, sql, *params):
    row = db.execute(sql, params).fetchone()
    return dict(row) if row else None

def rows(db, sql, *params):
    return [dict(r) for r in db.execute(sql, params).fetchall()]

def insert(db, table, **values):
    # Table and column names are internal constants; every value is parameterized.
    db.execute(f"INSERT INTO {table} ({','.join(values)}) VALUES ({','.join('?' for _ in values)})", tuple(values.values()))
