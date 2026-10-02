"""Per-request sqlite3 connection + schema bootstrap."""
import os
import sqlite3

import click
from flask import current_app, g


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(current_app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def close_db(_exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(path, encoding="utf-8") as fh:
        get_db().executescript(fh.read())
    db = get_db()
    db.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)")
    if not db.execute("SELECT 1 FROM schema_migrations WHERE version = '001_planner_core'").fetchone():
        db.executescript("""
        CREATE TABLE study_plans (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE plan_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, plan_id INTEGER NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, plan_date TEXT NOT NULL, subject TEXT NOT NULL, topic TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 2 CHECK(priority BETWEEN 1 AND 3), deadline TEXT, planned_minutes INTEGER NOT NULL CHECK(planned_minutes BETWEEN 1 AND 600), status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed','missed','snoozed','rescheduled','cancelled')), source TEXT NOT NULL DEFAULT 'ai', is_user_edited INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE INDEX idx_plans_user_status ON study_plans(user_id, status);
        CREATE INDEX idx_plan_tasks_user_date ON plan_tasks(user_id, plan_date);
        """)
        # Preserve old session rows; this only adds an optional association for new ones.
        columns = {r['name'] for r in db.execute('PRAGMA table_info(study_sessions)').fetchall()}
        if 'plan_task_id' not in columns:
            db.execute('ALTER TABLE study_sessions ADD COLUMN plan_task_id INTEGER REFERENCES plan_tasks(id)')
        db.execute("INSERT INTO schema_migrations (version) VALUES ('001_planner_core')")
    db.commit()


@click.command("init-db")
def init_db_command():
    """Create tables (idempotent)."""
    init_db()
    click.echo("Database ready.")


def init_app(app):
    os.makedirs(os.path.dirname(app.config["DATABASE"]) or ".", exist_ok=True)
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)
    with app.app_context():
        init_db()
