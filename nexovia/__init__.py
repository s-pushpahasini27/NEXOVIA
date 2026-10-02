"""Nexovia application factory."""
from flask import Flask, render_template

from config import get_config


def create_app(config_name=None, overrides=None):
    app = Flask(__name__, instance_relative_config=False)
    app.config.from_object(get_config(config_name))
    if overrides:
        app.config.update(overrides)

    from . import api, auth, db, main, security

    db.init_app(app)
    security.init_csrf(app)
    app.register_blueprint(auth.bp)
    app.register_blueprint(main.bp)
    app.register_blueprint(api.bp)

    @app.errorhandler(400)
    @app.errorhandler(404)
    def _error(err):
        return render_template("error.html", code=err.code, message=err.description), err.code

    return app
