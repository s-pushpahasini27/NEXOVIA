# Nexovia

**A connected workspace for planning, learning, and progress.**

Nexovia is a full-stack study application that brings personalized schedules, AI tutoring, study resources, focused sessions, and practice into one place. It helps students organize what to study, work through difficult concepts, and track their learning over time.

The application combines a React interface with a Python API. Study plans, tutor conversations, resources, practice results, and community activity are connected within each user's workspace.

## Contents

- [Features](#features)
- [Technology stack](#technology-stack)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the application](#running-the-application)
- [Usage](#usage)
- [Development and testing](#development-and-testing)
- [Additional documentation](#additional-documentation)

## Features

| Feature | Description |
| --- | --- |
| **AI Study Planner** | Create schedules from subjects, topics, deadlines, priorities, difficulty, and available study hours. Choose rules-based scheduling or Gemini-assisted prioritization, then preview, edit, save, archive, and restore plans. |
| **AI Tutors** | Ask questions, continue saved conversations, and use your notes or PDFs as context. The tutor can also answer questions about upcoming tasks in your saved study plans. |
| **Study Sessions** | Focus with a study timer, record actual study time, complete planned tasks, and adjust your schedule. |
| **Flashcards and Quizzes** | Generate practice material with AI, create flashcards manually, review cards with spaced repetition, and track quiz attempts. |
| **Progress Analytics** | Review study history, goals, session activity, and practice results through the Progress & insights view. |
| **Resources and Study Visuals** | Organize PDF, TXT, and Markdown notes. Configured Gemini features support OCR, PDF understanding, diagrams, and study image generation. |
| **Community** | Discover learners, manage connection requests, exchange private messages and attachments, and use browser audio/video calls with call history. |
| **Accounts and Personalization** | Use email verification or configured Google sign-in, complete onboarding, manage profile details and pictures, and switch between light and dark themes. |

## Technology stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS |
| Interface and visualization | Framer Motion, Radix UI, Base UI, Lucide icons, Recharts |
| Backend | Python, Starlette ASGI, Uvicorn |
| AI | Google Gemini API through server-side HTTP requests |
| Data and files | SQLite and local private storage; PostgreSQL through pg8000 and Vercel Blob for the cloud storage path |
| Authentication | Email/password authentication, SMTP verification, Google OpenID Connect |
| Communication | WebRTC audio/video with STUN and configurable TURN |
| Testing | pytest |

## How it works

1. **The frontend** presents the planner, tutor, resources, practice tools, analytics, and community views.
2. **The Python API** handles authentication, workspace actions, scheduling, AI requests, file processing, and call signaling.
3. **Persistent storage** keeps each user's plans, conversations, practice history, and resources. Local mode uses SQLite; setting `DATABASE_URL` selects PostgreSQL.
4. **Gemini integration** provides tutoring, AI-assisted planning, quizzes, flashcards, and configured visual generation.

For local use, the Python server serves the included `frontend/dist` build and the API from the same address. During frontend development, Vite serves the interface and forwards `/api` requests to Python.

## Project structure

```text
NEXOVIA/
├── api/                        # Hosted API and upload-token entry points
├── backend/
│   ├── main.py                 # API routes and application setup
│   ├── workspace.py            # Workspace actions and study features
│   ├── study.py                # Scheduling and study validation
│   ├── gemini.py               # Gemini integration
│   ├── db.py                   # SQLite and PostgreSQL access
│   ├── storage.py              # Private file storage
│   └── migrations/             # Database schema migrations
├── frontend/
│   ├── src/
│   │   ├── app/                # Application views and styles
│   │   ├── components/         # Shared interface components
│   │   ├── hooks/              # React hooks
│   │   └── lib/                # Client helpers and utilities
│   ├── public/                 # Public assets
│   ├── dist/                   # Included production build
│   └── package.json            # Frontend dependencies and scripts
├── tests/                      # Regression and smoke tests
├── tools/                      # Import and packaging utilities
├── .env.example                # Environment configuration template
├── requirements.txt            # Python runtime dependencies
├── requirements-dev.txt        # Test dependencies
├── run.py                      # Local server launcher
└── vercel.json                 # Hosted build and routing configuration
```

## Prerequisites

- **Python 3.12 or newer**
- **Git** to clone the repository, or a downloaded repository ZIP
- **Node.js 22.13 or newer and npm** when developing or rebuilding the frontend
- **SMTP settings** for email/password signup and verification
- **A Gemini API key** for the AI features you want to use

The included frontend build allows the local application to run with Python alone. Google sign-in, image generation, and TURN relay support can be configured as needed.

## Installation

### 1. Get the project

```bash
git clone https://github.com/s-pushpahasini27/NEXOVIA.git
cd NEXOVIA
```

If you downloaded a ZIP, extract it and open a terminal in the folder containing `run.py`.

### 2. Create a virtual environment and install dependencies

**Windows PowerShell**

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

**macOS / Linux**

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
```

### 3. Configure the application

Edit the new `.env` file using the settings below, then start the server.

## Configuration

Server configuration is loaded from `.env.local` and `.env`. Existing process environment variables take precedence. Credentials belong in server environment settings.

### Application and storage

| Variable | Purpose |
| --- | --- |
| `APP_ORIGIN` | Application origin; the local template uses `http://127.0.0.1:8000`. |
| `HOST`, `PORT` | Local server address and port; defaults are `127.0.0.1` and `8000`. |
| `ALLOW_LOCAL_DEV` | Allows the local frontend development origins. Use `false` for production. |
| `NEXOVIA_DATA_DIR` | Optional absolute path for local data; defaults to the project's `data/` directory. |
| `DATABASE_URL` | PostgreSQL connection URL when using the cloud database path. |
| `BLOB_READ_WRITE_TOKEN` | Private Vercel Blob storage token for the cloud file-storage path. |

Local mode initializes `data/nexovia.sqlite3` and private storage directories. This directory contains the local workspace data and can be retained when updating the application.

### AI features

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Gemini key for the planner, tutor, quizzes, flashcards, and supported visuals. |
| `GEMINI_MODEL` | Text model; the configuration template uses `gemini-2.5-flash`. |
| `GEMINI_IMAGE_MODEL` | Image-capable Gemini model for study image generation, using the same API key. |
| `AI_REQUESTS_PER_USER_HOUR` | Application request allowance per user; default `30`. |
| `AI_REQUESTS_PER_HOUR` | Application-wide request allowance; default `300`. |

Set the Gemini key and select models available to your account. Restart the server after changing these settings.

### Email and Google sign-in

| Variables | Purpose |
| --- | --- |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_TLS_MODE` | SMTP connection settings. The template uses port `587` with `starttls`. |
| `SMTP_FROM`, `SMTP_USERNAME`, `SMTP_PASSWORD` | Sender address and SMTP authentication. |
| `AUTH_OTP_SECRET` | OTP signing secret of at least 32 characters. Local mode can persist a generated key in `data/secrets/otp.key`; configure this variable for the cloud database path. |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` | Optional Google sign-in credentials and callback URL. |

Configure SMTP to enable email verification. For local Google sign-in, register this callback with your Google OAuth web client:

```text
http://127.0.0.1:8000/api/auth/google/callback
```

### Audio and video calls

Set `TURN_URLS` and `TURN_SECRET` to use a coturn-compatible relay with temporary credentials. Call participants connect through the Community view and grant microphone or camera access in the browser. Media access uses HTTPS or localhost.

## Running the application

Run the server from the repository root.

**Windows PowerShell**

```powershell
.\.venv\Scripts\python.exe run.py
```

**macOS / Linux**

```bash
.venv/bin/python run.py
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in your browser. Use **Ctrl+C** in the terminal to stop the server.

## Usage

1. **Create your account.** Sign up, enter the verification code sent to your email, and complete your profile. Google sign-in is available when configured.
2. **Build a study plan.** Enter subjects, topics, available time, and priorities. Preview the schedule, make adjustments, and save it.
3. **Start a focused session.** Open a planned task, use the timer, and record your progress.
4. **Learn with the tutor.** Ask a question or use saved notes as context. You can also ask, “What is my schedule tomorrow?” to retrieve upcoming tasks from your saved plans.
5. **Practice and review.** Create flashcards or quizzes, review cards, and explore your study results in Progress & insights.
6. **Connect with learners.** Find people in Community, send a connection request, and start messaging or a call.

Study scheduling and relative schedule dates use the **Asia/Kolkata** time zone.

## Development and testing

### Frontend development

Keep the Python server running, then open a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Vite forwards API requests to the Python server on port 8000.

To rebuild the frontend served by Python, run this command from `frontend/`:

```bash
npm run build
```

### Python tests

Run from the repository root.

**Windows PowerShell**

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
```

**macOS / Linux**

```bash
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q
```

## Additional documentation

- [Authentication setup](AUTH-SETUP.md)
- [AI and call configuration](AI-SETUP.md)
- [Data migration](MIGRATION.md)
