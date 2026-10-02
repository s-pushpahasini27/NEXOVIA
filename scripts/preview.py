"""Capture seeded preview screenshots of the key screens.

Usage: python scripts/preview.py OUT_DIR
Boots the app on a temp DB, registers a demo student, seeds a week of study data, and screenshots
the landing page and dashboard at desktop and mobile sizes.
"""
import os
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.request
from datetime import datetime, timedelta

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 5073
BASE = f"http://127.0.0.1:{PORT}"
SIZES = {"desktop": (1280, 900), "mobile": (390, 844)}
MINUTES = [35, 50, 0, 75, 40, 60]  # the six days before today


def main(out):
    os.makedirs(out, exist_ok=True)
    tmp = tempfile.mkdtemp()
    db_path = os.path.join(tmp, "preview.sqlite3")
    env = dict(os.environ, NEXOVIA_ENV="testing", DATABASE_PATH=db_path)
    srv = subprocess.Popen([sys.executable, "-c", f"from nexovia import create_app; create_app().run(port={PORT})"],
                           cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:
            urllib.request.urlopen(BASE + "/login")
            break
        except Exception:
            time.sleep(0.2)
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            for name, (w, h) in SIZES.items():
                ctx = browser.new_context(viewport={"width": w, "height": h})
                page = ctx.new_page()
                page.goto(BASE + "/")
                page.wait_for_timeout(300)
                page.screenshot(path=f"{out}/{name}-landing.png")
                page.goto(BASE + "/register")
                page.fill("#name", "Grace Hopper")
                page.fill("#email", f"grace-{name}@school.edu")
                page.fill("#password", "correct-horse")
                page.click("button[type=submit]")
                page.wait_for_url("**/app")

                # Seed the previous six days directly, then add today's plan through the UI
                con = sqlite3.connect(db_path)
                uid = con.execute("SELECT id FROM users WHERE email = ?", (f"grace-{name}@school.edu",)).fetchone()[0]
                today = datetime.now().date()
                for i, m in enumerate(MINUTES):
                    if m:
                        d = today - timedelta(days=6 - i)
                        con.execute("INSERT INTO study_sessions (user_id, topic, minutes, day) VALUES (?, '', ?, ?)",
                                    (uid, m, d.isoformat()))
                con.commit()
                con.close()
                page.reload()
                for title in ("Review chapter 4 notes", "Finish problem set 3", "Make flashcards for Friday's quiz"):
                    page.fill("#task-input", title)
                    page.click("#task-form button[type=submit]")
                    page.wait_for_function(f"document.querySelectorAll('#task-list .task').length >= {1 + ['Review chapter 4 notes', 'Finish problem set 3', 'Make flashcards for Friday' + chr(39) + 's quiz'].index(title)}")
                page.click("#task-list .task:first-child .task-check")
                page.click("#log-open")
                page.fill("#log-minutes", "45")
                page.fill("#log-topic", "Calculus")
                page.click("#log-form button[type=submit]")
                page.wait_for_function("document.getElementById('st-today').textContent === '45'")
                page.wait_for_timeout(700)  # let bar transitions settle
                page.add_style_tag(content=".topbar{position:static!important}")  # sticky bar breaks full-page captures
                page.screenshot(path=f"{out}/{name}-dashboard.png", full_page=True)
                if name == "desktop":
                    page.click("#cmd-open")
                    page.wait_for_timeout(200)
                    page.screenshot(path=f"{out}/{name}-palette.png")
                    page.keyboard.press("Escape")
                    page.click("#log-open")
                    page.wait_for_timeout(200)
                    page.screenshot(path=f"{out}/{name}-log-dialog.png")
                ctx.close()
            browser.close()
    finally:
        srv.kill()
    print("previews written to", out)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "previews")
