"""Planner domain logic. Draft generation is validated before persistence."""
from datetime import date, timedelta
from .db import get_db

RANGES = {'today': 0, 'tomorrow': 0, 'next3': 3, 'next7': 7, 'next14': 14}

def dates(scope, start=None, end=None, today=None):
    today = today or date.today()
    if scope == 'custom':
        start, end = date.fromisoformat(start), date.fromisoformat(end)
    elif scope == 'tomorrow': start = end = today + timedelta(days=1)
    else:
        start, end = today, today + timedelta(days=RANGES.get(scope, 0))
    if start < today: raise ValueError("The start date cannot be before today's date.")
    if end < start or (end-start).days > 90: raise ValueError('The end date must be on or after the start date, within 90 days.')
    return start, end

def _task(row): return dict(row)
def list_tasks(user_id, on):
    return [_task(r) for r in get_db().execute("SELECT * FROM plan_tasks WHERE user_id=? AND plan_date=? AND status != 'cancelled' ORDER BY priority, id", (user_id, on.isoformat())).fetchall()]

def generate(user_id, items, start, end):
    clean=[]
    for item in items:
        subject=str(item.get('subject','')).strip()[:80]; topic=str(item.get('topic','')).strip()[:120]
        if not subject or not topic: continue
        clean.append({'subject':subject,'topic':topic,'priority':max(1,min(3,int(item.get('priority',2)))),'deadline':str(item.get('deadline','')).strip() or None,'planned_minutes':max(15,min(600,int(item.get('planned_minutes',60))))})
    if not clean: raise ValueError('Add at least one subject and topic.')
    db=get_db(); cur=db.execute("INSERT INTO study_plans (user_id,title,start_date,end_date) VALUES (?,?,?,?)",(user_id,'AI study plan',start.isoformat(),end.isoformat())); plan=cur.lastrowid
    # Carry user-owned decisions forward before replacing an overlapping active plan.
    protected = db.execute("""SELECT t.* FROM plan_tasks t JOIN study_plans p ON p.id=t.plan_id
        WHERE t.user_id=? AND p.status='active' AND t.plan_date BETWEEN ? AND ?
        AND (t.status='completed' OR t.is_user_edited=1)""", (user_id,start.isoformat(),end.isoformat())).fetchall()
    for old in protected:
        db.execute("""INSERT INTO plan_tasks (plan_id,user_id,plan_date,subject,topic,priority,deadline,planned_minutes,status,source,is_user_edited)
        VALUES (?,?,?,?,?,?,?,?,?,?,1)""", (plan,user_id,old['plan_date'],old['subject'],old['topic'],old['priority'],old['deadline'],old['planned_minutes'],old['status'],old['source']))
    days=[start+timedelta(days=i) for i in range((end-start).days+1)]
    # Earliest deadline and highest priority receive the first feasible slots.
    clean.sort(key=lambda x:(x['deadline'] or '9999-12-31', x['priority']))
    protected_keys={(r['subject'],r['topic'],r['plan_date']) for r in protected}
    for i,item in enumerate(clean):
        d=min(days, key=lambda x:(x.isoformat()> (item['deadline'] or '9999-12-31'), x, i % len(days)))
        if (item['subject'],item['topic'],d.isoformat()) in protected_keys: continue
        db.execute("INSERT INTO plan_tasks (plan_id,user_id,plan_date,subject,topic,priority,deadline,planned_minutes) VALUES (?,?,?,?,?,?,?,?)",(plan,user_id,d.isoformat(),item['subject'],item['topic'],item['priority'],item['deadline'],item['planned_minutes']))
    db.commit(); return plan

def plan(user_id, plan_id):
    db=get_db(); p=db.execute('SELECT * FROM study_plans WHERE id=? AND user_id=?',(plan_id,user_id)).fetchone()
    if not p: return None
    tasks=[_task(r) for r in db.execute('''SELECT t.*, COALESCE(s.actual_minutes, 0) AS actual_minutes
        FROM plan_tasks t LEFT JOIN (
            SELECT plan_task_id, SUM(minutes) AS actual_minutes
            FROM study_sessions WHERE user_id=? AND plan_task_id IS NOT NULL
            GROUP BY plan_task_id
        ) s ON s.plan_task_id=t.id
        WHERE t.plan_id=? AND t.user_id=? ORDER BY t.plan_date,t.priority,t.id''',
        (user_id,plan_id,user_id)).fetchall()]
    return {'plan':dict(p),'tasks':tasks}

def active_plan(user_id):
    """Return the user's saved active plan with task and duration totals."""
    row=get_db().execute("SELECT id FROM study_plans WHERE user_id=? AND status='active' ORDER BY updated_at DESC,id DESC LIMIT 1",(user_id,)).fetchone()
    if not row: return None
    result=plan(user_id,row['id'])
    visible=[task for task in result['tasks'] if task['status']!='cancelled']
    result['summary']={
        'total':len(visible),
        'completed':sum(task['status']=='completed' for task in visible),
        'planned_minutes':sum(task['planned_minutes'] for task in visible),
        'actual_minutes':sum(task['actual_minutes'] for task in visible),
    }
    return result

def activate(user_id, plan_id):
    db=get_db(); p=plan(user_id,plan_id)
    if not p: return None
    # Completed and edited tasks stay historical; only overlapping unprotected tasks are archived with their plan.
    db.execute("UPDATE study_plans SET status='archived', updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND status='active'",(user_id,))
    db.execute("UPDATE study_plans SET status='active', updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",(plan_id,user_id)); db.commit(); return plan(user_id,plan_id)

def update_task(user_id, task_id, data):
    allowed={'plan_date','subject','topic','priority','deadline','planned_minutes','status'}; values={k:data[k] for k in allowed if k in data}
    if not values: return None
    if 'priority' in values: values['priority']=max(1,min(3,int(values['priority'])))
    if 'planned_minutes' in values: values['planned_minutes']=max(1,min(600,int(values['planned_minutes'])))
    if 'status' in values and values['status'] not in {'planned','in_progress','completed','missed','snoozed','rescheduled','cancelled'}: raise ValueError('Invalid task status.')
    sets=', '.join(f'{k}=?' for k in values)+", is_user_edited=1, updated_at=CURRENT_TIMESTAMP"
    db=get_db(); cur=db.execute(f'UPDATE plan_tasks SET {sets} WHERE id=? AND user_id=?',(*values.values(),task_id,user_id)); db.commit()
    return _task(db.execute('SELECT * FROM plan_tasks WHERE id=? AND user_id=?',(task_id,user_id)).fetchone()) if cur.rowcount else None
