# Nexovia audit and verification — 10 October 2026

This audit updates the existing standalone FastAPI/Python + React/TypeScript edition. Existing learning, community, file, and account features remain available subject to the new email-verification requirement. It does not establish that every feature is verified live.

## Stage 1 — broken or incomplete features

- Added persisted, deduplicated due-task reminders respecting notification preferences, completed tasks, and snooze times.
- Settings reject invalid boolean representations, preventing a string such as `false` from enabling a privacy setting.
- Preserved existing plans, resource trash/restore, manual study tools, private attachments, notifications, quiz scoring, and flashcard review behavior.
- Baseline: 20 existing tests passed. Both new Stage 1 regression tests passed before Stage 2.

## Stage 2 — tutor, planner, PDF, and visuals

- Gemini requests use bounded output, configurable models, explicit access/quota/error handling, schema-constrained tutor/planner output, and no silent engine substitution. Thought text is excluded from displayed responses.
- Follow-up note retrieval includes the previous user question when resolving pronouns. Tutor prompts include recent conversation and measured quiz results.
- AI planning includes measured learner results and weak-subject flags, supports up to 200 sessions, and retains deadline/order/conflict validation.
- Original-PDF understanding is opt-in, uses an owner-checked local file, and enables table/figure/page questions. Scanned PDFs can be uploaded in this mode without an OCR transcript. Text-based retrieval and separately opted-in OCR remain available.
- Explicit study diagram/workflow requests produce validated node/edge graphs rendered as SVG. Generated text is escaped by React rather than interpreted as HTML.
- Study image requests require an explicitly configured image-capable Gemini model. Returned images are size-limited, decoded, and checked before private storage; downloads are owner-scoped.
- Stage 2 gate: 25 tests, TypeScript check, and frontend build passed. Provider fixtures verified request/response contracts, source isolation, and output validation; they did not establish live answer quality or model access.

## Stage 3 — communication

- Moved the incoming-call listener from the selected conversation into the persistent workspace, allowing calls on other pages or before choosing a chat.
- Added separate Audio call and Video call actions. Audio calls request only microphone input. Call refreshes that cannot restore media end the stale call. Logout ends the user's active signaling session.
- Prevented overlapping call polls, added visible call-service errors, bounded SDP/candidate input, capped candidates, and preserved membership and busy-call checks.
- Tested two-account community messaging, private file permissions, audio/video signaling, unauthorized actions, busy calls, candidates, answer, decline, and terminal states. Local HTTP smoke checks passed before Stage 4.
- Actual media transmission, browser voice recognition, permission prompts, and cross-network behavior remain unverified. Both Chromium and headless-shell installation attempts returned invalid downloaded archives; no usable local browser runtime was available.

## Stage 4 — authentication and data protection

- Email syntax validation covers local-part length/dots, domain labels, invalid characters, and IDNA normalization.
- New sign-up creates no account or session until email OTP succeeds. Existing unverified password users must verify on login; existing data and password hashes are preserved. Previously verified Google identities remain verified.
- OTPs are browser-bound, keyed-hashed, one-use, expire after ten minutes, and stop after five incorrect attempts. Resends require sixty seconds, rotate the challenge, and invalidate the old token. Sending/resending is rate limited.
- SMTP requires TLS for external providers. Delivery failure blocks verification and does not grant access. There is no console-code or bypass mode.
- Password changes revoke other sessions and pending email challenges. Existing scrypt password hashes, origin checks, HttpOnly sessions, HTTPS Secure cookies, and ownership checks remain enforced.
- Tests cover OTP ownership, replay, expiry, attempts, resend/token rotation, SMTP configuration/failure/TLS sequencing, legacy login, and data-preserving legacy imports.

## Final evidence

- **45 automated tests passed** with isolated temporary databases. Gemini/Google responses are fixtures, never live-provider evidence.
- **Real HTTP + local SMTP smoke passed:** code delivery to a loopback test sink, verification, onboarding, planning, study logging, uploads, file isolation, trash/restore, reviews, community messaging, notifications, audio-call signaling, and static routes.
- TypeScript checking and Vite production build passed. Compiled frontend is included.
- Image transport tests use a valid generated test PNG and reject a corrupt provider-image payload. They do not verify real Gemini image generation.
- One upstream Starlette/HTTPX deprecation warning and one frontend bundle-size warning remain; neither fails these checks.

## Blockers for live verification

| Capability | Required configuration or evidence |
| --- | --- |
| Gemini tutor, AI planner, OCR, PDF understanding | A working `GEMINI_API_KEY` and a Flash model accessible to that account; test real course material, citations, and output quality. |
| Study image generation | `GEMINI_IMAGE_MODEL` with confirmed image capability and account access. Confirm any costs before enabling; no paid resource was enabled here. |
| Email ownership in a real inbox | `SMTP_HOST`, `SMTP_FROM`, provider credentials and sender approval. Local SMTP tests do not verify inbox delivery or spam handling. |
| Audio/video transport | Two real browser sessions with camera/microphone permissions; an existing TURN service (`TURN_URLS`, `TURN_SECRET`) for restrictive networks. |
| Google sign-in | OAuth credentials and a real callback check; only token/flow contract tests ran here. |
| Full interface journey | Browser signup → OTP → onboarding → planner → resources → tutor → practice → community → settings; check polling, light/dark diagrams, uploads, and permission-denied behavior. |

Email/password sign-up is intentionally unavailable until SMTP is configured. Already-verified password accounts can still log in. Preserve the full data folder and OTP signing key when updating. Source archives exclude credentials, user data, uploads, and signing keys.

## Commands

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
python tests/smoke_live.py --start-isolated
cd frontend
npm ci
npm exec tsc -- --noEmit
npm run build
```

The application still uses SQLite and local files on one server, lexical retrieval rather than embeddings, and in-app/browser notifications while the app is open. Background push, semantic vector search, streaming voice agents, password-reset email, and multi-server storage are outside this update. These are not described as completed features.
