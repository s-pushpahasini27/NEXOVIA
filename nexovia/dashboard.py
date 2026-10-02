"""Dashboard data logic: dates in the student's timezone, streaks, weekly totals, tasks, sessions."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from flask import has_request_context, request

from .db import get_db

MAX_TITLE = 120
MAX_TOPIC = 60
MAX_MINUTES = 600


def today():
    """Today's date in the browser's timezone, falling back to the server's local timezone."""
    tz = datetime.now().astimezone().tzinfo
    if has_request_context():
        name = request.cookies.get("nx-tz", "")
        if name:
            try:
                tz = ZoneInfo(name)
            except Exception:
                pass
    return datetime.now(tz).date()


# --- sessions --------------------------------------------------------------
def log_session(user_id, minutes, topic="", day=None, plan_task_id=None):
    db = get_db()
    day = day or today()
    db.execute(
        "INSERT INTO study_sessions (user_id, topic, minutes, day, plan_task_id) VALUES (?, ?, ?, ?, ?)",
        (user_id, topic.strip()[:MAX_TOPIC], int(minutes), day.isoformat(), plan_task_id),
    )
    db.commit()


def streak(user_id, on):
    rows = get_db().execute(
        "SELECT DISTINCT day FROM study_sessions WHERE user_id = ? AND day <= ? ORDER BY day DESC LIMIT 400",
        (user_id, on.isoformat()),
    ).fetchall()
    days = {r["day"] for r in rows}
    cursor = on if on.isoformat() in days else on - timedelta(days=1)  # a streak survives until today ends
    count = 0
    while cursor.isoformat() in days:
        count += 1
        cursor -= timedelta(days=1)
    return count


def week(user_id, on):
    start = on - timedelta(days=6)
    rows = get_db().execute(
        "SELECT day, SUM(minutes) AS m FROM study_sessions WHERE user_id = ? AND day >= ? AND day <= ? GROUP BY day",
        (user_id, start.isoformat(), on.isoformat()),
    ).fetchall()
    by_day = {r["day"]: r["m"] for r in rows}
    days = []
    for i in range(7):
        d = start + timedelta(days=i)
        days.append({"date": d.isoformat(), "label": d.strftime("%a"),
                     "minutes": by_day.get(d.isoformat(), 0), "today": d == on})
    peak = max([60] + [d["minutes"] for d in days])
    for d in days:
        d["pct"] = round(d["minutes"] / peak * 100)
    return days


# --- tasks -----------------------------------------------------------------
def _task(row):
    return {"id": row["id"], "title": row["title"], "done": bool(row["done"])}


def list_tasks(user_id, on):
    rows = get_db().execute(
        "SELECT id, title, done FROM tasks WHERE user_id = ? AND plan_date = ? ORDER BY done, id",
        (user_id, on.isoformat()),
    ).fetchall()
    return [_task(r) for r in rows]


def add_task(user_id, title, on):
    db = get_db()
    cur = db.execute("INSERT INTO tasks (user_id, title, plan_date) VALUES (?, ?, ?)",
                     (user_id, title.strip()[:MAX_TITLE], on.isoformat()))
    db.commit()
    return _task(db.execute("SELECT id, title, done FROM tasks WHERE id = ?", (cur.lastrowid,)).fetchone())


def toggle_task(user_id, task_id):
    db = get_db()
    row = db.execute("SELECT id, title, done FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id)).fetchone()
    if row is None:
        return None
    db.execute("UPDATE tasks SET done = ? WHERE id = ?", (0 if row["done"] else 1, task_id))
    db.commit()
    return _task(db.execute("SELECT id, title, done FROM tasks WHERE id = ?", (task_id,)).fetchone())


def delete_task(user_id, task_id):
    db = get_db()
    cur = db.execute("DELETE FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id))
    db.commit()
    return cur.rowcount > 0


# --- summary ---------------------------------------------------------------
def summary(user_id, on=None):
    on = on or today()
    days = week(user_id, on)
    tasks = list_tasks(user_id, on)
    return {
        "date": on.isoformat(),
        "date_label": on.strftime("%A, %b ") + str(on.day),
        "stats": {
            "streak": streak(user_id, on),
            "today_minutes": days[-1]["minutes"],
            "week_minutes": sum(d["minutes"] for d in days),
            "tasks_done": sum(1 for t in tasks if t["done"]),
            "tasks_total": len(tasks),
        },
        "week": days,
        "tasks": tasks,
    }
