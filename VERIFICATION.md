# Conversion verification

Verified on 2026-10-08 with Python 3.12.

## Passed

- **9 integration tests** (`python -m pytest -q`): signup/onboarding, login/logout, session reuse, password changes and revocation, origin rejection, rate limits, plan preservation, optional adaptive scheduling, conflicts, task editing/completion/snooze/recovery, study logging, plan restoration, links, uploaded notes, private downloads, tutor search, quiz scoring/idempotency, decks/reviews, Gemini tutor/quiz/flashcard generation, community permissions, persisted unread notifications, private messages, static page routes, Google state protection, mocked Google onboarding, signed-token claim/signature validation, and database import safeguards.
- **12 scheduler parity fixtures** compared the original TypeScript implementation with Python, ignoring randomly generated task IDs. Results matched for adaptive on/off, weak topics on/off, and one-, three-, and seven-day plans with an observed session length of 23 minutes.
- The existing visual system is retained and extended with a complete community chat layout, learner profile dialog, persistent notification center, unread bell count, browser-alert controls, and Gemini connection status.
- The frontend builds successfully using its own installed dependencies. The compiled build is included. Python source compiles successfully.

## Limits of verification

- Live Google sign-in is not tested without a real Google OAuth client. Tests mock the provider exchange; separate tests check signed JWT acceptance and rejection for wrong audience, issuer, expiration, and signature.
- No actual hosted user database or uploaded files were exported. Import was checked using a generated SQL dump of the preserved schema.
- Automated API and build checks do not substitute for a complete manual browser review on every device. The preserved UI has not undergone a new end-to-end visual browser audit in this conversion.
- The test client emits an upstream deprecation warning about its HTTPX integration; tests pass. The Vite build may warn about a large JavaScript chunk; this is a size advisory, not a build failure.

The existing hosted app was not altered or redeployed. Use this edition locally or deploy it on a Python-capable host.
