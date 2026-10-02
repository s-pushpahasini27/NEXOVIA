"""Register / login / logout with remember-me sessions."""
import re
import sqlite3

from flask import (Blueprint, current_app, flash, g, redirect, render_template,
                   request, session, url_for)
from werkzeug.security import check_password_hash, generate_password_hash

from .db import get_db
from .security import is_safe_next

bp = Blueprint("auth", __name__)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@bp.before_app_request
def load_user():
    user_id = session.get("user_id")
    g.user = None
    if user_id is not None:
        g.user = get_db().execute(
            "SELECT id, email, name FROM users WHERE id = ?", (user_id,)
        ).fetchone()


def _start_session(user_id, remember):
    session.clear()  # rotates away any pre-login state (session fixation)
    session["user_id"] = user_id
    session.permanent = bool(remember)


@bp.route("/register", methods=("GET", "POST"))
def register():
    if g.user:
        return redirect(url_for("main.app_home"))
    form = {"name": "", "email": ""}
    errors = {}
    if request.method == "POST":
        form["name"] = request.form.get("name", "").strip()
        form["email"] = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        min_len = current_app.config["MIN_PASSWORD_LENGTH"]
        if not form["name"]:
            errors["name"] = "Tell us what to call you."
        if not EMAIL_RE.match(form["email"]):
            errors["email"] = "Enter a valid email address."
        if len(password) < min_len:
            errors["password"] = f"Use at least {min_len} characters."
        if not errors:
            try:
                db = get_db()
                cur = db.execute(
                    "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)",
                    (form["email"], form["name"], generate_password_hash(password)),
                )
                db.commit()
            except sqlite3.IntegrityError:
                errors["email"] = "An account with this email already exists."
            else:
                _start_session(cur.lastrowid, remember=request.form.get("remember") == "on")
                flash("Welcome to Nexovia.", "success")
                return redirect(url_for("main.app_home"))
    return render_template("auth/register.html", form=form, errors=errors), (400 if errors else 200)


@bp.route("/login", methods=("GET", "POST"))
def login():
    if g.user:
        return redirect(url_for("main.app_home"))
    email = ""
    error = None
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        row = get_db().execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if row is None or not check_password_hash(row["password_hash"], password):
            error = "Incorrect email or password."
        else:
            _start_session(row["id"], remember=request.form.get("remember") == "on")
            nxt = request.args.get("next", "")
            return redirect(nxt if is_safe_next(nxt) else url_for("main.app_home"))
    return render_template("auth/login.html", email=email, error=error), (401 if error else 200)


@bp.route("/logout", methods=("POST",))
def logout():
    session.clear()
    flash("You've been signed out.", "info")
    return redirect(url_for("main.index"))
