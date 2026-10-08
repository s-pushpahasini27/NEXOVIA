# NEXOVIA — standalone Python edition

The existing Nexovia interface, with a Python FastAPI backend and a local SQLite database. No ChatGPT, Cowork, Cloudflare account, or Node server is needed to run the included build.

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
5. Create an account and complete your profile. Stop the server with **Ctrl+C**.

Next time, run only:

```powershell
.\.venv\Scripts\python.exe run.py
```

These commands do not require PowerShell activation or an execution-policy change. If `py` is unavailable, use `python` for the first command. You can also install the Microsoft Python extension in VS Code, select the `.venv` interpreter, and run the included “Run Nexovia Python” debug configuration.

## macOS / Linux

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python run.py
```

Internet access is needed for the initial dependency installation. Email/password login and local study features then work without external services. Google sign-in, external links, and downloaded Google Fonts need internet access; system fonts provide an offline fallback.

## Features preserved

| Area | Included behavior |
| --- | --- |
| Interface | Existing landing, login, signup, onboarding, workspace pages, sidebar preference/animation, light/dark themes, styled dynamic greeting, responsive layouts |
| Accounts | Email/password signup and login, profile creation, password changes, logout, persistent 30-day cookie sessions, optional Google login/linking |
| Planner | Date ranges, subjects, deadlines, priorities, difficulty, adaptive scheduling, preview/edit/save, multiple saved plans, archive restoration, conflict checks |
| Study sessions | Focus timer, actual study minutes, completion, snooze, missed-task recovery, reminders |
| Resources | Links, private PDF/TXT/Markdown uploads and downloads, text-note searching |
| Practice | Gemini-generated quizzes and flashcards when configured, safe built-in fallback, server-side scoring, attempt history, and reviews |
| Progress | Existing progress, goals, study history, insights and weak-topic displays |
| Community | Opt-in discovery, full learner profiles, approximate location, connection requests/acceptance, private chat, voice input, private file attachments, and built-in peer-to-peer audio/video calls |
| Notifications | Persisted connection/message/call alerts, unread counts, in-app popups, optional browser alerts while the app is open, study reminders |
| Settings | Profile, weekly goal, preferences, account security, Google account connection when configured |

The planner opens as a clean form with one blank subject row. Example subjects remain available only in the built-in practice bank and are never inserted into a learner's new plan automatically. A subtle app-wide particle background adapts to light and dark mode, reduces density on mobile, pauses in hidden tabs, and respects the operating system's reduced-motion preference.

The AI study planner, study assistant, generated quizzes, and generated flashcards use Gemini when `GEMINI_API_KEY` is configured. Planner output is constrained to scheduler-approved time slots, checked for deadlines and conflicts, and safely falls back to the local scheduler if Gemini is unavailable or returns invalid data. The assistant composer has a compact **+** attachment button for PDF, TXT or Markdown notes and a microphone button for browser-supported voice input. Text-based PDFs are extracted on the server; scanned/image-only PDFs need OCR first. There is no password-reset email service or email-verification delivery service. Community alerts are persisted in SQLite and can show browser alerts while Nexovia is open; this is not a background push-notification service after the browser or server closes. Scheduling retains the original **Asia/Kolkata** timezone; greetings use the browser's local time.

Connected learners can start a live camera/microphone call directly from a chat. Nexovia handles the invitation and WebRTC signaling through the Python server; audio and video travel peer-to-peer and are not recorded. Calls work on `localhost` and HTTPS after both learners grant browser camera/microphone permission. The included public STUN configuration works on most networks, but a production deployment that must support restrictive corporate/mobile networks should add a managed TURN relay. Both learners must use the same running Nexovia deployment—separate local databases cannot call each other.

## Where your local data is saved

The first launch creates:

- `data/nexovia.sqlite3` — accounts, profiles, plans, tasks, study sessions, resources, practice, and community data.
- `data/uploads/` — private uploaded files.
- `data/chat_uploads/` — private community-chat attachments available only to the sender and recipient.

Data survives server restarts. Back up the **entire `data` folder with the server stopped**, including any SQLite auxiliary files. Keep it private: it contains your account and study information. Do not delete it when updating the code. To store data elsewhere, copy `.env.example` to `.env` and set an absolute `NEXOVIA_DATA_DIR`.

**The download does not contain the hosted site's live user database or uploads.** Your existing hosted app remains unchanged. This local app starts with an empty database. Existing hosted data needs an authorized D1 SQL export and the associated uploaded files; the code alone cannot recover that data. The same table schema, identifiers, JSON fields, and scrypt password format are preserved. See `MIGRATION.md` for the import path. Do not sign up again expecting the hosted account to appear automatically.

## Enable Google sign-in (optional)

Email/password login works immediately. To enable Google:

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

When connected, the AI study assistant page shows **Gemini is connected**. The planner preview reports **Gemini AI planner**; quizzes and flashcards also use Gemini. If the key is missing, rejected, rate-limited, or temporarily unavailable, Nexovia keeps working with its validated local scheduler, reference notes, and practice bank.

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
| `backend/study.py` | Planner, validation, practice generation |
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

Implementation references: [FastAPI server deployment](https://fastapi.tiangolo.com/deployment/manually/), [PyJWT validation API](https://pyjwt.readthedocs.io/en/stable/api.html).
