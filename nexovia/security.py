"""CSRF protection and the login_required decorator."""
import secrets
from functools import wraps

from flask import abort, g, redirect, request, session, url_for

CSRF_KEY = "_csrf"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def csrf_token():
    token = session.get(CSRF_KEY)
    if not token:
        token = secrets.token_urlsafe(32)
        session[CSRF_KEY] = token
    return token


def init_csrf(app):
    app.jinja_env.globals["csrf_token"] = csrf_token

    @app.before_request
    def _validate_csrf():
        if request.method in SAFE_METHODS:
            return
        sent = request.form.get("csrf_token") or request.headers.get("X-CSRF-Token", "")
        expected = session.get(CSRF_KEY, "")
        if not expected or not sent or not secrets.compare_digest(sent, expected):
            abort(400, description="Invalid or missing CSRF token.")


def is_safe_next(target):
    """Only allow same-site relative redirects."""
    return bool(target) and target.startswith("/") and not target.startswith("//") and "\\" not in target


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if g.get("user") is None:
            nxt = request.full_path.rstrip("?")
            return redirect(url_for("auth.login", next=nxt))
        return view(*args, **kwargs)

    return wrapped
