"""Public index and the authenticated app home (shell + placeholder dashboard)."""
from flask import Blueprint, g, redirect, render_template, url_for

from . import dashboard, planner as planner_service, study_tips
from .ai_provider.groq_provider import GroqError
from .security import login_required

bp = Blueprint("main", __name__)


@bp.route("/")
def index():
    if g.user:
        return redirect(url_for("main.app_home"))
    return render_template("public/index.html")


@bp.route("/app")
@login_required
def app_home():
    d = dashboard.summary(g.user["id"])
    active = planner_service.active_plan(g.user["id"])
    try:
        tip = study_tips.tip_for_user(g.user["id"], active=active)
    except GroqError:
        tip = study_tips.preview_tip(active)
    today_plan_tasks = [task for task in active['tasks'] if task['plan_date'] == d['date'] and task['status'] != 'cancelled'] if active else []
    today_plan_summary = {
        'total': len(today_plan_tasks),
        'completed': sum(task['status'] == 'completed' for task in today_plan_tasks),
        'planned_minutes': sum(task['planned_minutes'] for task in today_plan_tasks),
        'actual_minutes': sum(task['actual_minutes'] for task in today_plan_tasks),
    }
    return render_template("app/home.html", tip=tip, d=d, active_plan=active,
                           today_plan_tasks=today_plan_tasks, today_plan_summary=today_plan_summary)

@bp.route('/planner')
@login_required
def planner():
    return render_template('app/planner.html', active_plan=planner_service.active_plan(g.user['id']))
