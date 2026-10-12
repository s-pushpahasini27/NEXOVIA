"""Import a trusted Nexovia SQL dump into a fresh local data directory."""
import argparse
import os
import re
from pathlib import Path
import sqlite3
import sys
import tempfile
from contextlib import closing

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
from backend.db import ROOT, data_dir

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sql_dump', type=Path)
    args = parser.parse_args()
    load_dotenv(ROOT / '.env')
    target = data_dir() / 'nexovia.sqlite3'
    if target.exists():
        parser.error('The target database already exists. Back it up and choose a fresh NEXOVIA_DATA_DIR.')
    handle, name = tempfile.mkstemp(prefix='import-', suffix='.sqlite3', dir=data_dir())
    os.close(handle)
    temporary = Path(name)
    try:
        with closing(sqlite3.connect(temporary)) as db, db:
            db.executescript(args.sql_dump.read_text(encoding='utf-8-sig'))
            for table, columns in {'profiles':['id','name'], 'plans':['id','user_id','input'], 'tasks':['id','plan_id','user_id'], 'auth_accounts':['id','email','password_hash'], 'resources':['id','file_key']}.items():
                available = {row[1] for row in db.execute(f'PRAGMA table_info({table})')}
                if not set(columns).issubset(available):
                    raise ValueError(f'The export is missing the expected {table} schema.')
            if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise ValueError('SQLite integrity check failed.')
            db.execute('DELETE FROM auth_sessions')
            db.execute('DELETE FROM auth_rate_limits')
            db.execute('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)')
            for migration in sorted((ROOT/'backend/migrations').glob('*.sql')):
                sql = migration.read_text()
                tables = re.findall(r'CREATE (?:VIRTUAL )?TABLE\s+`?(\w+)`?', sql, re.I)
                columns = re.findall(r'ALTER TABLE\s+`?(\w+)`?\s+ADD COLUMN\s+`?(\w+)`?', sql, re.I)
                present = [bool(db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()) for table in tables]
                present += [column in {r[1] for r in db.execute(f'PRAGMA table_info({table})')} for table,column in columns]
                if present and not any(present):
                    db.executescript(sql)
                elif not present or not all(present):
                    raise ValueError(f'Partially applied or unsupported migration: {migration.name}. The original export was not changed.')
                db.execute('INSERT OR IGNORE INTO schema_migrations VALUES (?)', (migration.name,))
        temporary.replace(target)
        print(f'Imported database: {target}\nCopy uploaded files into data/uploads, then start Nexovia and log in again.')
    finally:
        temporary.unlink(missing_ok=True)

if __name__ == '__main__':
    main()
