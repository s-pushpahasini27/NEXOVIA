# Nexovia AI and call setup

## Server configuration

Copy `.env.example` to `.env` in the project root and set `GEMINI_API_KEY` using your own Gemini project. Leave billing disabled if you want to stay within the provider's available free tier. This application cannot enforce provider billing settings. Do not enable a paid plan without the project owner's approval.

`GEMINI_MODEL` defaults to `gemini-2.5-flash` and is configurable. Use a model available to your account. Keep keys on the Python server, never in React or Git. Environment variables override files; `.env.local` overrides `.env` for values not already set in the process. Restart the server after changes.

Key presence is never presented as a successful connection test. To verify actual access, ask a question in **AI study assistant** and confirm a new Gemini-labeled response is saved. Check its content, then reload to verify persistence. An error is an error: no reference answer or sample quiz is substituted.

## What is implemented

- **Tutor:** live Gemini generation, recent conversation, actual quiz-performance context, and owner-scoped retrieval from saved notes. Responses persist with provider provenance and validated source IDs.
- **Quizzes:** newly generated questions with four distinct choices and validated answers; prior attempts inform the prompt. Submitting again returns the original saved score.
- **Flashcards:** live generated cards or explicitly entered `Question :: Answer` pairs. Again is due in ten minutes; Good starts at one day; Easy starts at three days. Subsequent successful intervals grow, capped at 365 days.
- **Planner:** explicitly select Rules-based scheduling or Gemini AI prioritization. Both validate conflicts and deadlines. AI plans are limited to 200 sessions per request and do not silently switch engines.
- **Notes:** PDF/TXT/Markdown up to 10 MB, 200 PDF pages, and approximately 100,000 extracted characters. Oversized input is rejected rather than silently truncated. Retrieval uses overlapping passages with SQLite FTS5, not embeddings. Complete file summaries are limited to 35,000 characters; larger text files support specific-topic retrieval. Select **Use original PDF understanding** to send an uploaded PDF directly to Gemini for whole-document, table, and figure questions. This permits scanned-PDF uploads without an OCR transcript; turn the option on before upload. It is an explicit data-sharing choice.
- **OCR:** select **Use AI OCR** before uploading a scanned PDF. Up to ten textless pages can be sent to Gemini for transcription. Extraction and AI work execute outside the event loop. OCR can misread text; inspect source passages. No OCR provider is called when the option is off.
- **Study visuals:** explicit diagram/workflow requests produce a validated graph rendered as SVG. Explicit study-image requests use `GEMINI_IMAGE_MODEL`, which must name an image-capable model available to your account. It is unset by default. Generated images are decoded and checked before saving, and authenticated downloads are restricted to their owner. Provider image generation may require billing or incur costs; confirm access and costs before enabling it. No paid service is enabled automatically.
- **Voice input:** browser speech recognition with an editable transcript, available only in supporting browsers. This is not a conversational streaming voice agent.

## Request limits

The server reserves an hourly quota before AI work: `AI_REQUESTS_PER_USER_HOUR=30` and `AI_REQUESTS_PER_HOUR=300` by default. A PDF upload with OCR enabled reserves ten units conservatively. Failed provider attempts consume quota. These limits are persisted in SQLite and are not a billing cap or a free-tier guarantee.

## Chat calls

Use an existing coturn-compatible service with time-limited REST credentials:

```env
TURN_URLS=turn:your-relay-host:3478,turns:your-relay-host:5349
TURN_SECRET=your-existing-relay-shared-secret
```

Do not place the shared secret in frontend code. `/api/calls/config` requires login and returns temporary per-user credentials. If no relay is configured, direct STUN-based calls may work, but restrictive networks can fail. No paid relay is provisioned automatically.

To verify calls, sign in with two connected test accounts on two devices, choose Audio call or Video call in Community, accept from another workspace page, then test audio, video, mute, camera toggle and hang-up. Repeat from different networks with TURN enabled. API signaling tests alone do not prove media transport.

## Run locally on Windows

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe run.py
```

Open `http://127.0.0.1:8000`. Preserve your existing `data` folder when updating. Stop the server and back up that folder before the first launch of an updated version; additive migrations run automatically.

## Provider references

- https://ai.google.dev/gemini-api/docs/generate-content/structured-output
- https://ai.google.dev/gemini-api/docs/generate-content/document-processing
- https://ai.google.dev/gemini-api/docs/generate-content/image-generation

The implementation uses configurable GenerateContent REST models. These references guide the request format; they do not prove that your key or chosen model has access. Live provider verification remains required.
