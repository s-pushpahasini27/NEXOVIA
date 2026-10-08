"""Python port of the original scheduler, validation, and practice bank."""
import json
import math
import random
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from .db import uid

ZONE = ZoneInfo('Asia/Kolkata')
concepts = json.loads(Path(__file__).with_name('concepts.json').read_text(encoding='utf-8'))

def today():
    return datetime.now(ZONE).date().isoformat()

def current_minutes():
    d = datetime.now(ZONE)
    return d.hour * 60 + d.minute

def add_days(value, n):
    return (date.fromisoformat(value) + timedelta(days=n)).isoformat()

def valid_date(value):
    try:
        return isinstance(value, str) and bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}', value)) and date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False

def minutes(value):
    h, m = map(int, value.split(':'))
    return h * 60 + m

def clock(n):
    return f'{n // 60:02d}:{n % 60:02d}'

def integer(n, low, high):
    return isinstance(n, (int, float)) and not isinstance(n, bool) and math.isfinite(n) and int(n) == n and low <= n <= high

def capacity(x, day):
    return x['weekend'] if date.fromisoformat(day).weekday() >= 5 else x['weekday']

def valid_time(t):
    return isinstance(t, str) and re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', t)

def validate_input(x):
    if not isinstance(x, dict) or not valid_date(x.get('start')) or x['start'] < today():
        raise ValueError('Choose today or a future start date.')
    if not integer(x.get('days'), 1, 31):
        raise ValueError('Choose a plan from 1 to 31 days.')
    if not valid_time(x.get('startTime')):
        raise ValueError('Choose a valid start time.')
    if not all(integer(x.get(k), 15, 480) for k in ('weekday', 'weekend')):
        raise ValueError('Daily study time must be 15–480 minutes.')
    if not integer(x.get('session'), 15, 120):
        raise ValueError('Sessions must be 15–120 minutes.')
    subjects = x.get('subjects')
    if not isinstance(subjects, list) or not 1 <= len(subjects) <= 10:
        raise ValueError('Add 1–10 subjects.')
    for s in subjects:
        if s.get('priority') not in ('high', 'medium', 'low') or s.get('difficulty') not in ('easy', 'medium', 'hard'):
            raise ValueError('Choose a valid priority and difficulty.')
        if not str(s.get('name', '')).strip() or not str(s.get('topics', '')).strip() or len(s['topics']) > 2000:
            raise ValueError('Each subject needs a name and topics.')
        if s.get('deadline') and (not valid_date(s['deadline']) or s['deadline'] < x['start']):
            raise ValueError('A subject deadline cannot be before the plan starts.')
    return x

def schedule(x, actual_session=None, existing=None):
    validate_input(x)
    duration = max(15, min(x['session'], math.floor(actual_session / 5 + .5) * 5)) if x.get('adaptive') and actual_session else x['session']
    work = [(s, topic.strip(), kind) for s in x['subjects'] for topic in s['topics'].split(',') if topic.strip() for kind in ('Learn', 'Review' if s.get('weak') else 'Practice')]
    work.sort(key=lambda w: (w[0].get('deadline') or '9999', {'high': 0, 'medium': 1, 'low': 2}[w[0]['priority']]))
    tasks = []
    for i in range(int(x['days'])):
        day = add_days(x['start'], i)
        occupied = sorted([t for t in existing or [] if t['date'] == day and t['status'] != 'completed'], key=lambda t: t['time'])
        left = capacity(x, day) - sum(t['duration'] for t in occupied)
        start = minutes(x['startTime'])
        if day == today():
            start = max(start, math.ceil((current_minutes() + 5) / 5) * 5)
        hard = j = 0
        while j < len(work):
            s, topic, kind = work[j]
            if (s.get('deadline') and day > s['deadline']) or (hard >= 2 and s['difficulty'] == 'hard') or (kind != 'Learn' and not any(t['subject'] == s['name'] and t['topic'] == topic and t['kind'] == 'Learn' and t['date'] < day for t in tasks)):
                j += 1
                continue
            length = min(duration, left)
            if length < 15:
                break
            for old in occupied:
                at = minutes(old['time'])
                if start < at + old['duration'] and start + length > at:
                    start = at + old['duration'] + 10
            if start + length > 1440:
                break
            tasks.append(dict(id=uid(), subject=s['name'], topic=topic, date=day, time=clock(start), duration=length, priority=s['priority'], difficulty=s['difficulty'], deadline=s.get('deadline') or '', status='pending', kind=kind, manual=0))
            work.pop(j)
            left -= length
            start += length + 10
            hard += s['difficulty'] == 'hard'
    note = f'{len(work)} learning blocks do not fit before the selected dates or deadlines. Extend the range, add time or reduce topics.' if work else 'Learning and practice fit within your available time. Ten-minute breaks separate sessions.'
    return dict(tasks=tasks, remaining=len(work), mode='Smart scheduler', note=note)

def validate_tasks(tasks, x):
    validate_input(x)
    if not isinstance(tasks, list) or not 1 <= len(tasks) <= 300:
        raise ValueError('A plan needs 1–300 tasks.')
    ids = set()
    for t in tasks:
        if t.get('id') in ids:
            raise ValueError('Duplicate task.')
        ids.add(t.get('id'))
        if not str(t.get('topic', '')).strip() or not str(t.get('subject', '')).strip() or not valid_date(t.get('date')) or not x['start'] <= t['date'] <= add_days(x['start'], x['days'] - 1):
            raise ValueError('Every task needs a topic and a date inside your plan.')
        if t.get('deadline') and (not valid_date(t['deadline']) or t['date'] > t['deadline']):
            raise ValueError('A task is scheduled after its deadline.')
        if not integer(t.get('duration'), 5, 240) or not valid_time(t.get('time')) or minutes(t['time']) + t['duration'] > 1440:
            raise ValueError('Check task duration and start time.')
    for day in {t['date'] for t in tasks}:
        daily = sorted([t for t in tasks if t['date'] == day], key=lambda t: t['time'])
        if sum(t['duration'] for t in daily) > capacity(x, day):
            raise ValueError(f'{day} exceeds your available study time.')
        if any(minutes(b['time']) < minutes(a['time']) + a['duration'] for a, b in zip(daily, daily[1:])):
            raise ValueError(f'Two sessions overlap on {day}.')

def conflicts(proposed, existing, x):
    errors = []
    for day in dict.fromkeys(t['date'] for t in proposed):
        current = [t for t in existing if t['date'] == day and t['status'] != 'completed']
        if not current:
            continue
        added = [t for t in proposed if t['date'] == day]
        if sum(t['duration'] for t in current + added) > capacity(x, day):
            errors.append(f'{day} exceeds your daily study time across saved plans.')
        for t in added:
            if any(minutes(t['time']) < minutes(c['time']) + c['duration'] and minutes(c['time']) < minutes(t['time']) + t['duration'] for c in current):
                errors.append(f"{day} at {t['time']} overlaps a session in another plan.")
    return list(dict.fromkeys(errors))

def practice(topic, count):
    words = [w for w in topic.lower().split() if len(w) > 2]
    source = [c for c in concepts if any(w in (c['topic'] + ' ' + c['subject']).lower() for w in words)] or concepts
    result = []
    for c in source[:max(1, min(count, len(source)))]:
        shift = random.randrange(4)
        result.append({**c, 'options': c['options'][shift:] + c['options'][:shift], 'answer': (4 - shift) % 4})
    return result
