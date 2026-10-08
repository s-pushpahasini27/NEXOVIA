# Connect Gemini to Nexovia

Nexovia uses one server-side Gemini API key for the AI study planner, tutor chat, quizzes, and flashcards.

1. Go to https://aistudio.google.com/app/apikey and create a Gemini API key.
2. In the `NEXOVIA-Python` folder, copy `.env.example` to a new file named `.env`.
3. Open `.env` and set these two lines:

   ```env
   GEMINI_API_KEY=paste_your_real_key_here
   GEMINI_MODEL=gemini-2.5-flash
   ```

4. Save `.env` and completely restart the Python server. Environment changes are read only when the server starts.
5. Sign in and open **AI study assistant**. The status should say **Gemini is connected**.
6. Open **Study planner**, enter at least one real subject and comma-separated topics, then generate the preview. A successful AI preview reports **Gemini AI planner**. If the key or service fails, Nexovia reports **Smart scheduler fallback** and still creates a safe local plan.

Never put the Gemini key in `frontend/`, browser code, GitHub, or a screenshot. The `.env` file is already ignored by Git.

## Attach notes in chat

Open **AI study assistant** and select the **+** button beside the question box.

- PDF, TXT and Markdown files (up to 10 MB) are uploaded, selected, and usable as chat context immediately.
- Text-based PDFs are extracted on the server. Scanned or image-only PDFs need OCR before upload.
- Uploaded files are available only to the signed-in account that uploaded them.

Select the microphone button to dictate a question. Voice input uses the browser's speech-recognition support and works best in current Chrome or Edge. The transcript stays editable before you send it.

## Windows start commands

Run these in PowerShell from the project folder:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe run.py
```

Then open http://127.0.0.1:8000 in the browser. Keep the PowerShell window running while using Nexovia.

If `py` is unavailable, replace `py` with `python`. If you see `No module named uvicorn`, the dependency-install command above was skipped or was run with a different Python installation.
