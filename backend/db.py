import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parent.parent

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
    db = sqlite3.connect(data_dir() / 'nexovia.sqlite3', timeout=20)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    try:
        with db:
            yield db
    finally:
        db.close()

def initialize():
    with database() as db:
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)')
        for file in sorted((ROOT / 'backend/migrations').glob('*.sql')):
            if not db.execute('SELECT 1 FROM schema_migrations WHERE name=?', (file.name,)).fetchone():
                db.executescript('BEGIN;\n' + file.read_text() + '\nCOMMIT;')
                db.execute('INSERT INTO schema_migrations VALUES (?)', (file.name,))

def one(db, sql, *params):
    row = db.execute(sql, params).fetchone()
    return dict(row) if row else None

def rows(db, sql, *params):
    return [dict(r) for r in db.execute(sql, params).fetchall()]

def insert(db, table, **values):
    # Table and column names are internal constants; every value is parameterized.
    db.execute(f"INSERT INTO {table} ({','.join(values)}) VALUES ({','.join('?' for _ in values)})", tuple(values.values()))
