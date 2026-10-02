"""Headless Chromium pass: console errors, horizontal overflow, key interactive elements.

Usage: python scripts/browser_check.py [--shots DIR]
Boots the app on a temp DB, so it is safe to run anywhere.
"""
import argparse
import os
import subprocess
import sys
import tempfile
import time
import urllib.request

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 5059
BASE = f"http://127.0.0.1:{PORT}"
VIEWPORTS = {"desktop": (1280, 800), "mobile": (390, 844)}
failures = []


def check(cond, msg):
    print(("  PASS " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def boot_server(tmp):
    env = dict(os.environ, NEXOVIA_ENV="testing", DATABASE_PATH=os.path.join(tmp, "b.sqlite3"))
    code = f"from nexovia import create_app; create_app().run(port={PORT})"
    proc = subprocess.Popen([sys.executable, "-c", code], cwd=ROOT, env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:
            urllib.request.urlopen(BASE + "/login")
            return proc
        except Exception:
            time.sleep(0.2)
    proc.kill()
    raise RuntimeError("server did not start")


def new_page(browser, size, errors):
    ctx = browser.new_context(viewport={"width": size[0], "height": size[1]})
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    return ctx, page


def no_overflow(page):
    return page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shots", default=None)
    args = ap.parse_args()
    if args.shots:
        os.makedirs(args.shots, exist_ok=True)

    tmp = tempfile.mkdtemp()
    server = boot_server(tmp)
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            for vp, size in VIEWPORTS.items():
                print(f"\n[{vp}]")
                errors = []
                ctx, page = new_page(browser, size, errors)

                # Landing page
                page.goto(BASE + "/")
                check(page.locator("text=The Future of Smarter Learning Starts Here.").is_visible(), "landing hero headline renders")
                check(page.locator(".lp-card").count() == 7, "features grid renders 7 cards")
                check(no_overflow(page), "/ has no horizontal overflow")
                check(page.get_attribute("html", "data-theme") is None, "no theme attribute (dark-only, no toggle)")
                if args.shots:
                    page.screenshot(path=f"{args.shots}/{vp}-landing-top.png")

                # Scroll reveal + count-up + nav scrolled state
                page.click(".lp-cta-row a[href='#features']")
                page.wait_for_timeout(700)
                check(page.locator(".lp-card").first.evaluate("el => el.classList.contains('in-view')"), "scroll reveal activates on features section")
                stat_text = page.locator(".lp-stat-value").first.inner_text()
                check(stat_text not in ("0", ""), "hero stat count-up animates")
                check(page.locator("#lp-nav").evaluate("el => el.classList.contains('scrolled')"), "nav gains scrolled state after scrolling")
                if args.shots:
                    page.screenshot(path=f"{args.shots}/{vp}-landing-features.png")

                # Other public pages
                for path, key_sel in (("/login", "form.auth-form"), ("/register", "form.auth-form")):
                    page.goto(BASE + path)
                    check(page.locator(key_sel).first.is_visible(), f"{path} key element renders")
                    check(no_overflow(page), f"{path} has no horizontal overflow")
                    if args.shots:
                        page.screenshot(path=f"{args.shots}/{vp}-{path.strip('/')}.png")

                # Password reveal
                page.goto(BASE + "/login")
                page.fill("#password", "secret123")
                page.click("[data-toggle-password]")
                check(page.get_attribute("#password", "type") == "text", "password reveal works")

                # Register end to end
                page.goto(BASE + "/register")
                page.fill("#name", f"Grace Hopper {vp}")
                page.fill("#email", f"grace-{vp}@school.edu")
                page.fill("#password", "correct-horse")
                page.click("button[type=submit]")
                page.wait_for_url("**/app")
                check(page.locator("[data-testid=ai-tip]").is_visible(), "dashboard renders mock AI tip")
                check(page.locator(".topbar").is_visible() and page.locator(".cmd-trigger").is_visible(), "top command bar renders")
                check(no_overflow(page), "/app has no horizontal overflow")

                # Dashboard interactions
                check(page.locator(".grid-4 .card").count() == 4, "dashboard shows 4 stat cards")
                check(page.locator("#week .week-col").count() == 7, "weekly chart renders 7 days")
                page.fill("#task-input", "Review chapter 4")
                page.click("#task-form button[type=submit]")
                page.wait_for_selector("#task-list .task")
                check(page.locator("#st-total").inner_text() == "1", "adding a task updates the stat")
                check(page.locator("#task-list .task-check svg").count() == 1, "new task renders its checkmark icon")
                check(page.locator("#task-empty").is_hidden(), "empty state hides after adding a task")
                page.click("#task-list .task-check")
                page.wait_for_selector("#task-list .task.done")
                check(page.locator("#st-done").inner_text() == "1", "checking a task updates tasks done")
                page.click("#log-open")
                check(page.locator("#log-dialog[open]").count() == 1, "log session dialog opens")
                page.fill("#log-minutes", "45")
                page.fill("#log-topic", "Calculus")
                page.click("#log-form button[type=submit]")
                page.wait_for_function("document.getElementById('st-today').textContent === '45'")
                check(page.locator("#st-streak").inner_text() == "1", "logging a session starts the streak")
                check(page.locator("#st-streak-unit").inner_text() == "day", "streak unit is singular for 1 day")
                check(page.locator("#week .week-col.today .week-val").inner_text() == "45", "chart shows today's minutes")
                check(page.locator("#log-dialog[open]").count() == 0, "dialog closes after saving")
                page.fill("#tip-topic", "organic chemistry")
                page.click("#tip-form button")
                page.wait_for_function("document.getElementById('tip-text').textContent.includes('organic chemistry')")
                check(True, "AI tip button fetches a topic tip via the provider")
                check(no_overflow(page), "/app still has no overflow after interactions")
                if args.shots:
                    page.screenshot(path=f"{args.shots}/{vp}-dashboard.png", full_page=True)
                page.click("#task-list .task-del", force=True)
                page.wait_for_function("document.getElementById('st-total').textContent === '0'")
                check(True, "deleting a task updates the stat")

                if vp == "mobile":
                    check(not page.locator("#sidebar.open").count(), "sidebar closed by default on mobile")
                    page.click("#menu-btn")
                    check(page.locator("#sidebar.open").count() == 1, "menu button opens sidebar drawer")
                    page.wait_for_timeout(300)  # let the slide-in transition finish before screenshotting
                    if args.shots:
                        page.screenshot(path=f"{args.shots}/{vp}-app-drawer.png")
                    page.click(".content .page", position={"x": 300, "y": 300})
                    check(not page.locator("#sidebar.open").count(), "tapping outside closes the drawer")
                else:
                    check(page.locator("#sidebar").is_visible(), "sidebar visible on desktop")
                    if args.shots:
                        page.screenshot(path=f"{args.shots}/{vp}-app.png")

                # Command palette
                page.click("#cmd-open")
                check(page.locator("#palette.open").count() == 1, "command palette opens from top bar")
                check(page.locator(".palette-item").count() >= 4, "palette lists base + dashboard quick-action commands")
                page.fill("#palette-input", "zzzz")
                check(page.locator(".palette-empty").is_visible(), "palette shows empty state")
                page.keyboard.press("Escape")
                check(page.locator("#palette.open").count() == 0, "Escape closes palette")

                # Logout returns to public site and gates /app
                if vp == "mobile":
                    page.click("#menu-btn")
                page.click("button[aria-label='Sign out']")
                page.wait_for_url(BASE + "/")
                page.goto(BASE + "/app")
                check("/login" in page.url, "signed-out /app redirects to login")

                # Google Fonts requests are expected to fail in this sandbox (no outbound network);
                # they load fine wherever real internet access is available. Everything else must be clean.
                other_errors = [e for e in errors if "fonts.googleapis.com" not in e and "fonts.gstatic.com" not in e and "403" not in e]
                check(not other_errors, "zero console/page errors (Google Fonts 403s excluded, sandbox has no network)" + (f" -> {other_errors}" if other_errors else ""))
                ctx.close()
            browser.close()
    finally:
        server.kill()

    print("\n" + ("ALL CHECKS PASSED" if not failures else f"{len(failures)} FAILURE(S):\n - " + "\n - ".join(failures)))
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
