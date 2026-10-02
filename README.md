# Nexovia + Public Landing Page

AI-powered student learning platform. Flask + Jinja2 + vanilla JS. No build step.

## Run it
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py                       # http://127.0.0.1:5000
```
Config comes from `NEXOVIA_ENV` (`development` default), `SECRET_KEY`, `DATABASE_PATH`, `AI_PROVIDER`.

### Plan-aware AI tips with Groq

Set `GROQ_API_KEY` in the environment before starting the server. Nexovia then uses Groq automatically for short study tips based on the signed-in student's active plan, progress, priorities, and deadlines. `GROQ_MODEL` can override the default `llama-3.3-70b-versatile`. On PowerShell, for example, set `$env:GROQ_API_KEY` in your terminal, then run `python run.py`. Keep the key server-side; never put it in browser code or commit it. Without a key, the app offers a clearly labelled local plan-based preview. Set `AI_PROVIDER=mock` to force preview mode.

## What's here
- **App factory**, dev/testing/production config, auth (register/login/logout, remember-me, CSRF, `login_required`), and the pluggable `ai_provider` abstraction — unchanged from the first pass.
- **Design system, corrected**: monochrome dark-only theme (no light mode, no toggle), grayscale-only palette — "primary" is expressed through contrast and weight, not color. Three font roles loaded from Google Fonts: **Space Grotesk** (display/headings), **Inter** (body), **IBM Plex Mono** (labels, eyebrows, stats).
- **Public landing page** (`templates/public/index.html`, `static/css/landing.css`, `static/js/landing.js`): sticky nav with blur-on-scroll, hero with badge/headline/subtitle/two CTAs, three count-up stats, a 7-card features grid with hover-lift, and a footer. Scroll-reveal and count-up are vanilla `IntersectionObserver` — no other libraries.
- App shell (sidebar + top command bar + palette) carried over as-is, restyled onto the new monochrome tokens.

## How it wires together
- `create_app()` registers the `auth` and `main` blueprints, `db.init_app`, and `security.init_csrf`.
- Every color in the app is a CSS custom property in `tokens.css`. There is exactly one color family (grayscale) plus black/white; a future palette change means editing that one file.
- The landing page's nav links (`#features`, `#ai-tools`, `#community`, `#about`) are anchors into sections of the same page — `#ai-tools` and `#community` are set on the first and fifth feature cards.
- `current_provider().complete(...)` on the dashboard still resolves from `AI_PROVIDER` in config, unchanged.

## Verify
```bash
python -m unittest discover -s tests -v      # 20 Flask test-client tests (16 original + 4 for the landing page)
./scripts/check.sh                            # py_compile on every .py + node --check on every .js
python scripts/browser_check.py --shots out   # Playwright/Chromium: desktop + mobile
```
Last run: 20/20 tests, all files compile, all JS parses, all browser checks pass on desktop and mobile (console errors, horizontal overflow, scroll reveal, count-up, nav scroll state, palette, auth flows, mobile drawer).

## Known tuning points
1. **Google Fonts needs real internet.** The build sandbox has no outbound network, so the three fonts 403 there and the browser check explicitly excludes those two font-host errors from its "zero console errors" gate (with a comment explaining why). On your machine, with normal internet access, they'll load and the headings/labels will render in Space Grotesk/IBM Plex Mono immediately — nothing to change.
2. **Schema is SQLite-only** (`AUTOINCREMENT`). Postgres schema + driver switch is planned for Phase 7 (renumbered from the original plan — see note below).
3. **Login has no rate limiting or lockout** yet — planned for the hardening phase.
4. **Command palette** has one command (`Go to Home`) since the theme-toggle command was removed along with the toggle; more commands land as more pages exist.
5. **Phase numbering note**: what first shipped as "Phase 1" was actually the auth flow and AI provider abstraction; this delivery adds the actual Phase 1 scope (the public landing page) on top of that work, which is kept as-is per your sign-off.
