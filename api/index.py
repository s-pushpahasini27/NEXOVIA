"""Vercel's Python ASGI entrypoint for the Nexovia API."""

from backend.db import initialize
from backend.main import app

# Vercel Functions may not deliver an ASGI lifespan event on every cold start.
# This is idempotent and guarded by a PostgreSQL advisory lock in cloud mode.
initialize()
