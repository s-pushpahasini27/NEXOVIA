"""Persisted attempt limits; not a billing or free-plan guarantee."""
import os
import time
from .web import HTTPException
from .db import one

def reserve(db, user_id, units=1):
    window = int(time.time()) // 3600
    user_limit = int(os.getenv('AI_REQUESTS_PER_USER_HOUR', '30'))
    global_limit = int(os.getenv('AI_REQUESTS_PER_HOUR', '300'))
    if units < 1 or user_limit < 1 or global_limit < 1:
        raise RuntimeError('AI request limits must be positive integers.')
    # Claim both quotas together, and release the write lock before network I/O.
    db.execute('BEGIN IMMEDIATE')
    db.execute('DELETE FROM ai_usage_limits WHERE "window"<?', (window,))
    for scope, limit in [('global', global_limit), ('user:' + user_id, user_limit)]:
        current = one(db, 'SELECT used FROM ai_usage_limits WHERE scope=? AND "window"=?', scope, window)
        if (current['used'] if current else 0) + units > limit:
            db.rollback()
            raise HTTPException(429, 'The hourly AI request limit has been reached. Try again next hour.')
        db.execute('INSERT INTO ai_usage_limits VALUES(?,?,?) ON CONFLICT(scope,"window") DO UPDATE SET used=used+excluded.used', (scope,window,units))
    db.commit()
