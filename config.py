"""Environment configuration. Selected by NEXOVIA_ENV (development | testing | production)."""
import os
from datetime import timedelta

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me")
    DATABASE = os.environ.get("DATABASE_PATH", os.path.join(BASE_DIR, "instance", "nexovia.sqlite3"))
    # Production will use this (Phase 7). Kept here so the switch is config-only.
    DATABASE_URL = os.environ.get("DATABASE_URL")
    GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
    GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
    AI_PROVIDER = os.environ.get("AI_PROVIDER", "groq" if GROQ_API_KEY else "mock")
    PERMANENT_SESSION_LIFETIME = timedelta(days=30)  # applies to "remember me" sessions
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = False
    MIN_PASSWORD_LENGTH = 8
    TESTING = False


class DevelopmentConfig(Config):
    DEBUG = True


class TestingConfig(Config):
    TESTING = True
    SECRET_KEY = "test-secret"
    AI_PROVIDER = "mock"


class ProductionConfig(Config):
    SESSION_COOKIE_SECURE = True

    @classmethod
    def validate(cls):
        if cls.SECRET_KEY == "dev-only-change-me":
            raise RuntimeError("SECRET_KEY must be set in production")


CONFIGS = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(name=None):
    cfg = CONFIGS.get(name or os.environ.get("NEXOVIA_ENV", "development"), DevelopmentConfig)
    if hasattr(cfg, "validate"):
        cfg.validate()
    return cfg
