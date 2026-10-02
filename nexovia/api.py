"""JSON endpoints for the dashboard. CSRF is enforced globally (X-CSRF-Token header)."""
from flask import Blueprint, g, jsonify, request

from . import dashboard
from .ai_provider.groq_provider import GroqError
from . import planner
from . import study_tips

bp = Blueprint("api", __name__, url_prefix="/api")


@bp.before_request
def require_login():
    if g.get("user") is None:
        return jsonify(error="Sign in required."), 401


def _body():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def _fresh(**extra):
    s = dashboard.summary(g.user["id"])
    return jsonify(stats=s["stats"], week=s["week"], **extra)


@bp.post("/tasks")
def create_task():
    title = str(_body().get("title", "")).strip()
    if not title:
        return jsonify(error="Give the task a title."), 400
    task = dashboard.add_task(g.user["id"], title, dashboard.today())
    return _fresh(task=task), 201


@bp.post("/tasks/<int:task_id>/toggle")
def toggle_task(task_id):
    task = dashboard.toggle_task(g.user["id"], task_id)
    if task is None:
        return jsonify(error="Task not found."), 404
    return _fresh(task=task)


@bp.post("/tasks/<int:task_id>/delete")
def delete_task(task_id):
    if not dashboard.delete_task(g.user["id"], task_id):
        return jsonify(error="Task not found."), 404
    return _fresh(deleted=task_id)


@bp.post("/sessions")
def create_session():
    body = _body()
    try:
        minutes = int(body.get("minutes"))
    except (TypeError, ValueError):
        return jsonify(error="Enter the minutes you studied."), 400
    if not 1 <= minutes <= dashboard.MAX_MINUTES:
        return jsonify(error=f"Minutes must be between 1 and {dashboard.MAX_MINUTES}."), 400
    task_id=body.get('plan_task_id')
    if task_id is not None:
        try: task_id=int(task_id)
        except (TypeError,ValueError): return jsonify(error='Invalid planner task.'),400
        if not planner.update_task(g.user['id'],task_id,{'status':'in_progress'}): return jsonify(error='Planner task not found.'),404
    dashboard.log_session(g.user["id"], minutes, str(body.get("topic", "")), plan_task_id=task_id)
    return _fresh(), 201


@bp.get("/ai/tip")
def ai_tip():
    topic = request.args.get("topic", "").strip()[:80]
    try:
        res = study_tips.tip_for_user(g.user["id"], topic)
    except GroqError as exc:
        return jsonify(error=str(exc)), 503
    return jsonify(text=res.text, provider=res.provider)

@bp.post('/planner/generate')
def generate_plan():
    body=_body()
    try:
        start,end=planner.dates(body.get('range','today'),body.get('start_date'),body.get('end_date'),dashboard.today())
        plan_id=planner.generate(g.user['id'], body.get('items',[]), start,end)
    except (ValueError,TypeError) as err: return jsonify(error=str(err)),400
    return jsonify(planner.plan(g.user['id'],plan_id)),201

@bp.get('/planner/<int:plan_id>')
def get_plan(plan_id):
    result=planner.plan(g.user['id'],plan_id)
    return (jsonify(result),200) if result else (jsonify(error='Plan not found.'),404)

@bp.post('/planner/<int:plan_id>/activate')
def activate_plan(plan_id):
    result=planner.activate(g.user['id'],plan_id)
    return (jsonify(result),200) if result else (jsonify(error='Plan not found.'),404)

@bp.post('/planner/tasks/<int:task_id>')
def edit_plan_task(task_id):
    try: task=planner.update_task(g.user['id'],task_id,_body())
    except (ValueError,TypeError) as err: return jsonify(error=str(err)),400
    return (jsonify(task=task),200) if task else (jsonify(error='Task not found.'),404)
