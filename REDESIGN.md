# Nexovia — Liquid Film identity

Updated 11 October 2026.

The supplied Origin Kit TSX contains a Liquid Film animated WebGL background, not a complete page template. Its original component remains in `frontend/src/app/originkit/liquid-film.tsx`. The application now mounts one canvas at the root, behind all routes, while the surrounding layout and controls follow its midnight, mint, and violet visual language. The animation can be paused from the appearance controls; reduced-motion preferences pause it automatically, and hidden tabs suspend the canvas.

The landing page is a full-viewport product introduction rather than an embedded template demo. Authentication, profile setup, overview, planner, AI study assistant, resources, quizzes, analytics, community, conversations, notifications, settings, and calls share the same semantic colors, typography, spacing, frosted navigation, input states, dialogs, and responsive rules. Existing business logic, routes, API contracts, and data handling were retained.

The landing page now uses the requested Caprasimo display face, a skippable letter-by-letter `N-E-X-O-V-E-A` introduction, revised calls to action, four icon-led feature stories, and a responsive feature rail. The animation respects reduced-motion settings. The shared Liquid Film environment and all authenticated screens are unchanged by this landing refinement.

Main design files: `frontend/src/app/identity.css`, `landing.tsx`, `theme-ui.tsx`, and `liquid-film-stage.tsx`. The previous competing dark overrides were removed from `theme.css`.

Verification: production Vite build and TypeScript checks pass; the backend regression suite passes 54 tests using isolated data. The actual WebGL shader sources compile, link, draw both passes, and change pixels over time in a software EGL/ES3 renderer. Structural server rendering covers public, login, signup, onboarding, and workspace shells. Browser visual QA of responsive layouts was blocked by this environment's local-file and localhost browser security. Live Google OAuth, SMTP delivery, Gemini responses, camera/microphone permissions, and two-participant calls still require configured providers and a real browser session.

Run on Windows from the folder containing `run.py`:

```powershell
.\.venv\Scripts\python.exe run.py
```

If no environment exists, create one and install `requirements.txt` first. Open `http://127.0.0.1:8000/` and use Ctrl+F5 to refresh cached assets. The compiled frontend is included; one Python terminal is sufficient. Preserve your `.env.local` and `data/` folder when updating; they are excluded from this archive.
