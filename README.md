# Nexovia

Nexovia is a study workspace for planning, learning, practicing, and tracking progress in one place. Its React interface talks to a Python API. The included `frontend/dist` build lets you run the app locally without installing Node.js; Node.js is needed when changing or rebuilding the interface.

## Features

| Area | What it does |
| --- | --- |
| Study planner | Creates deadline-aware schedules from subjects, priorities, difficulty, and available time. Choose the rules-based scheduler or Gemini-assisted prioritization; preview, edit, save, archive, and restore plans. |
| AI study assistant | Answers questions with Gemini, can use your saved notes as context, and can answer questions about your upcoming saved schedule. Notes-based answers validate source references; AI can still make mistakes. |
| Study sessions | Provides a focus timer, records actual study time, and supports task completion, snoozing, and missed-session recovery. |
| Practice and analytics | Generates quizzes and flashcards, supports manual cards and spaced review, and displays study history, goals, and progress insights. |
| Resources and visuals | Stores private PDF, TXT, and Markdown notes for retrieval. Optional AI OCR, original-PDF understanding, study diagrams, and image generation depend on the configured Gemini model and feature settings. |
| Community | Offers opt-in learner discovery, connection requests, private messages and attachments, notifications, and peer-to-peer audio/video calls with call history. |
| Accounts and interface | Includes email/password signup with email verification, optional Google sign-in, onboarding, profile settings, responsive light/dark layouts, and reduced-motion support. |

Gemini-backed features require a valid API key and model access; they do not silently substitute sample results when the provider fails. Calls require both users to be connected, media permissions, and HTTPS or localhost. A TURN relay is recommended for calls across restrictive networks; none is supplied by this repository.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite 8, CSS/Tailwind, Framer Motion, and UI components based on Radix/Base UI.
- **Backend:** Python, Starlette ASGI, Uvicorn, and server-side Gemini REST requests.
- **Data:** SQLite and private files in `data/` locally; PostgreSQL via `DATABASE_URL` and private Vercel Blob in the Vercel deployment.
- **Integrations:** SMTP for email verification, optional Google OAuth, browser WebRTC for calls, and optional coturn-compatible TURN.
- **Hosted runtime:** Vercel serves the built frontend, a Python API Function, and a Node upload-token Function.

## Project structure

```text
.
├── run.py                    # Local Python server
├── api/
│   ├── index.py              # Vercel Python API entry point
│   └── blob-token.js         # Authenticated direct-upload tokens
├── backend/                  # API, auth, planner, AI, calls, storage, data
│   └── migrations/           # Database schema migrations
├── frontend/
│   ├── src/                  # React and TypeScript source
│   ├── dist/                 # Committed ready-to-run build
│   └── package.json          # Frontend scripts and dependencies
├── tests/                    # Python regression tests
├── requirements.txt          # Python runtime dependencies
├── requirements-dev.txt      # Python test dependencies
├── .env.example              # Server configuration template
└── vercel.json               # Vercel build and route configuration
```

Additional setup details are in [`AUTH-SETUP.md`](AUTH-SETUP.md), [`AI-SETUP.md`](AI-SETUP.md), and [`MIGRATION.md`](MIGRATION.md).

## Install and run locally

Use Python **3.12 or newer**. Extract the repository first, then run these commands from its root. No PowerShell activation or execution-policy change is required.

**Windows PowerShell**

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe run.py
```

If `py` is unavailable, use `python` for the first command.

**macOS / Linux**

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
.venv/bin/python run.py
```

Open **http://127.0.0.1:8000** and stop the server with **Ctrl+C**. On later starts, run only the last command for your operating system. The server loads `.env.local` and `.env`; existing process environment variables take precedence.

The app creates `data/nexovia.sqlite3` and private upload directories on first use. Keep `data/` when updating the code and back up the whole directory with the server stopped. A local installation does **not** automatically contain accounts or files from a hosted Nexovia deployment. To move local storage, set an absolute `NEXOVIA_DATA_DIR` in `.env`.

### Develop the frontend

Install Node.js **22.13 or newer** only when editing the interface. Keep the Python server running in one terminal; in another terminal run:

```bash
cd frontend
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Vite proxies `/api` to the Python server at port 8000. To refresh the interface served by Python at port 8000, run `npm run build` from `frontend/`; source changes alone do not update the committed build. The public landing and authentication styles are in `frontend/src/app/landing.css` and `frontend/src/app/auth.css`. The default Google OAuth callback points to port 8000.

## Environment setup

Copy `.env.example` to `.env` for local use. Keep `.env`, passwords, and API keys out of Git and frontend code. For a hosted instance, set server variables through the hosting provider's secret settings.

| Setting | Purpose |
| --- | --- |
| `APP_ORIGIN` | Exact public origin (for example, `https://your-domain.example`) used for request-origin checks and OAuth setup; defaults to `http://127.0.0.1:8000` locally. |
| `HOST`, `PORT`, `ALLOW_LOCAL_DEV` | Local server address/port and local development-origin allowance. Set `ALLOW_LOCAL_DEV=false` for production. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_TLS_MODE`, `SMTP_FROM`, `SMTP_USERNAME`, `SMTP_PASSWORD` | Existing SMTP provider credentials for email verification. Password signup cannot complete without working email delivery. `starttls` on port 587 is the example default; use your provider's required settings. |
| `AUTH_OTP_SECRET` | Long private OTP signing key (at least 32 characters). Locally the app can generate and persist one in `data/secrets/otp.key`; configure it explicitly for stateless/cloud hosting. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Enable the AI planner, tutor, quizzes, flashcards, and applicable study visuals. The model defaults to `gemini-2.5-flash`; access must be verified with your provider account. |
| `GEMINI_IMAGE_MODEL` | Optional image-capable Gemini model for generated study images; unset by default. The same `GEMINI_API_KEY` is used. Check model access and possible provider charges first. |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` | Optional Google sign-in. Register the exact callback URI `/api/auth/google/callback` with your Google OAuth web client. |
| `TURN_URLS`, `TURN_SECRET` | Optional coturn-compatible relay URLs and shared secret for reliable WebRTC calls across networks. Without them, calls use public STUN and may fail. |
| `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN` | Required for persistent cloud data and private files on Vercel. `DATABASE_URL` selects PostgreSQL instead of local SQLite. |
| `AI_REQUESTS_PER_USER_HOUR`, `AI_REQUESTS_PER_HOUR` | Application-side Gemini request limits. These are not provider billing limits. |

For local email verification, fill in the SMTP settings and restart the server. For Google OAuth locally, use `http://127.0.0.1:8000/api/auth/google/callback` and keep the same hostname in your browser. For AI, create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey), put it in `GEMINI_API_KEY`, restart, and test with a real tutor question. Never paste the key into a screenshot or commit it.

## Usage

1. Configure SMTP, start the server, sign up, verify the emailed code, and complete your profile. Alternatively, configure Google OAuth and use Google sign-in.
2. In **Study planner**, enter subjects and available time, preview a rules-based or AI-prioritized schedule, then save it. Start a session, track time, and review progress.
3. In **AI study assistant**, ask a concept question, attach saved notes when useful, or ask “What is my schedule tomorrow?” The tutor receives your upcoming active, incomplete planner tasks and uses **Asia/Kolkata** for relative schedule dates.
4. Create quizzes or flashcards for practice. In **Community**, connect with another learner before messaging or calling.

AI answers and OCR can be inaccurate. Review important study content and schedules before relying on them.

## Tests

From the repository root, install the test dependencies and run the Python regression suite:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
```

For frontend changes, also run `npm run build` from `frontend/`. Automated tests use temporary data and do not prove live SMTP delivery, Gemini access, Google OAuth, or cross-network call quality.
