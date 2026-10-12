"""Shared, idempotent conversation events for calls."""
from datetime import datetime, timedelta
from .db import insert, now, uid


def started(db, call):
    insert(db, 'messages', id=uid(), sender=call['caller'], recipient=call['callee'],
           body='', created=call['created'], event_type='call_started',
           call_id=call['id'], call_media=call['media'])


def finish(db, call, status, stamp=None):
    if call['status'] not in ('ringing', 'active'):
        return
    ended = stamp or now()
    if ended <= call['created']:
        ended = (datetime.fromisoformat(call['created'].replace('Z', '+00:00')) + timedelta(milliseconds=1)).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
    duration = 0
    if call.get('answered_at'):
        duration = max(0, int((datetime.fromisoformat(ended.replace('Z', '+00:00')) -
                               datetime.fromisoformat(call['answered_at'].replace('Z', '+00:00'))).total_seconds()))
    db.execute('UPDATE call_sessions SET status=?,updated=? WHERE id=?', (status, ended, call['id']))
    db.execute('''INSERT OR IGNORE INTO messages
        (id,sender,recipient,body,created,event_type,call_id,call_media,call_duration,call_status)
        VALUES (?,?,?,?,?,?,?,?,?,?)''',
        (uid(), call['caller'], call['callee'], '', ended, 'call_ended',
         call['id'], call['media'], duration, status))
