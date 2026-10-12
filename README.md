# NEXOVIA — standalone Python edition

The existing Nexovia interface, with a Python ASGI backend and a local SQLite database. No ChatGPT, Cowork, Cloudflare account, or Node server is needed to run the included build.

**The backend is Python.** The browser interface remains React + TypeScript + CSS to preserve the same design, animations, themes, and interactions. It is not a Python desktop GUI. The compiled interface is included in `frontend/dist`.

## Start on Windows in VS Code

1. Install Python **3.12 or newer**. Enable “Add Python to PATH” during installation.
2. Extract the ZIP. In VS Code choose **File → Open Folder → NEXOVIA-Python**. Do not open the files inside the ZIP without extracting them.
3. Open **Terminal → New Terminal** and run:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe run.py
```

4. Open **http://127.0.0.1:8000** in your browser.
5. Configure email delivery as described in `AUTH-SETUP.md`, create an account, verify its email code, and complete your profile. Stop the server with **Ctrl+C**.

Next time, run only:

```powershell
.\.venv\Scripts\python.exe run.py
```

These commands do not require PowerShell activation or an execution-policy change. If `py` is unavailable, use `python` for the first command. You can also install the Microsoft Python extension in VS Code, select the `.venv` interpreter, and run the included “Run Nexovia Python” debug configuration.

This build uses Starlette directly and intentionally does **not** install Pydantic Core. That avoids the native Pydantic DLL that some Windows Application Control policies block. If you are replacing an earlier Nexovia download, delete its `.venv` folder before creating the new one above.

## macOS / Linux

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python run.py
```

Internet access is needed for the initial dependency installation, email verification, and live AI. Already-verified password accounts can log in and use local study features without external services. Google sign-in, external links, and downloaded Google Fonts need internet access; system fonts remain available offline.

## Features preserved

| Area | Included behavior |
| --- | --- |
| Interface | Landing, login, signup, onboarding, workspace pages, responsive sidebar, light/dark themes, styled dynamic greeting, and reduced-motion support |
| Accounts | Validated email/password signup and login, browser-bound email OTP verification, profile creation, password changes, logout, persistent 30-day cookie sessions, optional verified Google login/linking |
| Planner | Date ranges, subjects, deadlines, priorities, difficulty, adaptive scheduling, preview/edit/save, multiple saved plans, archive restoration, conflict checks |
| Study sessions | Focus timer, actual study minutes, completion, snooze, missed-task recovery, reminders |
| Resources | Links, private PDF/TXT/Markdown uploads, optional scanned-PDF OCR, indexed passage retrieval, source citations, recoverable removal |
| Practice | Live Gemini quizzes and flashcards, manual cards, server-side scoring, immutable submissions, due-date review scheduling |
| Progress | Existing progress, goals, study history, insights and weak-topic displays |
| Community | Opt-in discovery, categorized searchable B.Tech/engineering skill multi-select with custom skills, learner profile pictures, connection requests, private chat with call start/end history, voice input, file attachments, and peer-to-peer audio/video calls |
| Notifications | Persisted connection/message/call alerts, unread counts, in-app popups, optional browser alerts while the app is open, study reminders |
| Settings | Profile, weekly goal, preferences, account security, Google account connection when configured |

The planner opens as a clean form with one blank subject row. Choose the rules-based scheduler or Gemini AI prioritization explicitly. Generated AI content is never replaced with sample questions or reference answers after a failure. A subtle app-wide particle background adapts to light and dark mode, reduces density on mobile, pauses in hidden tabs, and respects reduced-motion preferences.

The AI planner, tutor, generated quizzes, and flashcards require a working `GEMINI_API_KEY`. Provider errors are displayed and invalid generations are not saved. Planning output is constrained to valid time slots and checked for deadlines, order and conflicts. The assistant's **+** button attaches text-based PDF, TXT, or Markdown notes; its microphone button uses browser speech recognition. Relevant passages from the owner's files are retrieved with SQLite full-text search and sent to Gemini; returned citation IDs are checked against those passages. This is lexical retrieval, not vector search, and citation validation does not guarantee factual correctness. Tutors use recorded quiz performance; new quizzes receive previous topic attempts to adapt difficulty. Scanned PDFs are not processed through the tutor interface. Community alerts work while the app is open. There is no background push or password-reset email. Email ownership is verified through configured SMTP delivery; see `AUTH-SETUP.md`. The assistant also supports validated study diagrams and optional generated images. Scheduling uses **Asia/Kolkata**; greetings use browser local time.

Connected learners can choose audio-only or video calls from chat. The incoming-call listener stays mounted across workspace pages. Nexovia handles WebRTC signaling; media is not recorded. Browser media access requires localhost or HTTPS and permission from both participants. Configure an existing coturn-compatible relay with `TURN_URLS` and `TURN_SECRET` for restrictive networks. The server creates expiring per-user relay credentials without exposing the shared secret. Without TURN, the interface warns that some networks cannot connect. Both participants must use the same running Nexovia server. Real media transport and cross-network calls have not been verified in this environment.

Call start and end entries appear in both participants' shared chat timeline with the call type, local display time and connected duration; unanswered/declined calls have zero connected duration. Pictures uploaded during onboarding or Settings are validated, resized and stored privately. Google profile pictures are copied from a verified Google image host when available; manually uploaded pictures take precedence. Only the profile owner, a discoverable profile's viewers, or accepted connections can retrieve a picture. Start-up applies migration `0012_call_history_profile_pictures.sql` to existing local databases without deleting data.

## Where your local data is saved

The first launch creates:

- `data/nexovia.sqlite3` — accounts, profiles, plans, tasks, study sessions, resources, practice, and community data.
- `data/uploads/` — private uploaded files.
- `data/chat_uploads/` — private community-chat attachments available only to the sender and recipient.
- `data/profile_pictures/` — private, resized profile pictures.
- `data/visuals/` — private generated study images.
- `data/secrets/otp.key` — private OTP signing key, generated only when `AUTH_OTP_SECRET` is unset.

Data survives server restarts. Back up the **entire `data` folder with the server stopped**, including any SQLite auxiliary files. Keep it private: it contains your account and study information. Do not delete it when updating the code. To store data elsewhere, copy `.env.example` to `.env` and set an absolute `NEXOVIA_DATA_DIR`.

**The download does not contain the hosted site's live user database or uploads.** Your existing hosted app remains unchanged. This local app starts with an empty database. Existing hosted data needs an authorized D1 SQL export and the associated uploaded files; the code alone cannot recover that data. The same table schema, identifiers, JSON fields, and scrypt password format are preserved. See `MIGRATION.md` for the import path. Do not sign up again expecting the hosted account to appear automatically.

## Enable Google sign-in (optional)

Email/password signup requires configured SMTP delivery and OTP verification. See `AUTH-SETUP.md`. To enable Google:

1. In Google Cloud, create/configure an OAuth consent screen and an OAuth client of type **Web application**. Add test users if the consent screen is in testing mode.
2. Add the exact authorized redirect URI:
   `http://127.0.0.1:8000/api/auth/google/callback`
3. Copy `.env.example` to `.env` in the project root. Fill in `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`. Keep the provided local redirect URI.
4. Restart Python and use **Continue with Google**. New accounts go through profile creation; returning users open their workspace.

Use the same hostname consistently: `localhost` and `127.0.0.1` are different cookie hosts and redirect URIs. For production, use your exact HTTPS domain for both `APP_ORIGIN` and the Google redirect URI. Never put the client secret in React code or commit `.env`.

Google uses state, nonce, PKCE, signed short-lived flow cookies, and verified Google ID tokens. Existing Gmail/Google Workspace accounts can match verified identities; other email domains require logging in with the password and connecting Google in Settings. Real Google login must be tested with your credentials; the included automated checks use a mocked identity exchange and test the token verifier separately.

## Enable Gemini AI (optional)

1. Open [Google AI Studio](https://aistudio.google.com/app/apikey) and create an API key.
2. Copy `.env.example` to `.env` in the project root.
3. Put the key after `GEMINI_API_KEY=`. Do not add quotes or paste it into frontend code.
4. Keep `GEMINI_MODEL=gemini-2.5-flash`, then restart `python run.py`.

A key being present means configured, not verified. A successful tutor response is labeled with its stored Gemini provenance and supporting passages when available. If the key is missing or rejected, AI requests fail visibly without fabricated content. Rules-based planning and manual cards remain explicit independent features. Application-level hourly request limits are configurable; they do not guarantee free provider usage. No billing account, paid plan or external resource is created by this package. See `AI-SETUP.md` for setup and `VERIFICATION.md` for evidence and remaining checks.

## Edit the interface

Python serves the compiled UI. Only install Node.js **22.13+** if you want to edit/rebuild the React interface:

```bash
cd frontend
npm ci
npm run dev
```

Keep `python run.py` running in another terminal. Open `http://127.0.0.1:5173`; Vite proxies `/api` to Python. Google callback configuration points to port 8000 by default, so that flow returns to the Python-served build.

After editing, rebuild and restart Python:

```bash
cd frontend
npm run build
```

Changes to `frontend/src` do not appear on port 8000 until rebuilt. The app has no Next.js, Vinext, D1, R2, or ChatGPT runtime dependency.

## Project files

| Path | Purpose |
| --- | --- |
| `run.py` | Python server entry point |
| `backend/main.py` | API routes, uploads, static frontend serving |
| `backend/auth.py` | Passwords, sessions, rate limits |
| `backend/google.py` | Google OpenID Connect |
| `backend/study.py` | Deterministic scheduling and validation |
| `backend/gemini.py`, `backend/retrieval.py` | Live AI client, owner-scoped retrieval and citation validation |
| `backend/ai_limits.py` | Persisted request budgets |
| `backend/workspace.py` | Study and community operations |
| `backend/db.py`, `backend/migrations/` | SQLite persistence and original schema |
| `frontend/src/app/` | Preserved React screens and CSS |
| `frontend/src/components/` | Preserved UI components |
| `frontend/dist/` | Ready-to-run compiled UI |
| `tests/` | API and security regression tests |

## Tests

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
```

Tests create temporary databases and do not modify your real data. See `VERIFICATION.md` for conversion checks and remaining setup requirements.

## Hosting

The provided `run.py` binds to your own computer only. For public deployment use a Python-capable host with persistent disk and HTTPS, configure `APP_ORIGIN`, set `ALLOW_LOCAL_DEV=false`, and keep the database/uploads on durable storage. Host multiple users against **one shared deployment** for community features; separate laptop databases do not synchronize. SQLite is intended for a single-server deployment, not replicas with independent disks.

This package has **not replaced the existing `chatgpt.site` deployment**. Running Python requires a Python-capable host; the original Workers runtime is not used by this edition.

Implementation references: [Starlette application documentation](https://www.starlette.io/applications/), [PyJWT validation API](https://pyjwt.readthedocs.io/en/stable/api.html).


## Vercel deployment

The Vercel build serves the React interface and Python API from one project. Configure Production environment variables for `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `GEMINI_API_KEY`, `AUTH_OTP_SECRET`, and the `SMTP_*` mail settings before using live signup and AI features. A coturn-compatible relay can be added with `TURN_URLS` and `TURN_SECRET` for reliable calls across networks. Keep all secrets in Vercel, never in Git.
