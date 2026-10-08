import json
import logging
import os
import re
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from io import BytesIO
from urllib.parse import parse_qsl
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from pypdf import PdfReader
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool
from .db import ROOT, database, initialize, data_dir, one, rows, insert, uid, now, dump
from . import auth, google, workspace

load_dotenv(ROOT / '.env')
DIST = ROOT / 'frontend/dist'

@asynccontextmanager
async def lifespan(app):
    initialize()
    yield

app = FastAPI(title='Nexovia Python API', lifespan=lifespan)

@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return JSONResponse({'error': exc.detail, 'signIn': exc.status_code == 401}, status_code=exc.status_code)

@app.exception_handler(ValueError)
async def input_error(request, exc):
    return JSONResponse({'error': str(exc)}, status_code=400)

@app.exception_handler(Exception)
async def unexpected_error(request, exc):
    logging.exception('Request failed', exc_info=exc)
    return JSONResponse({'error': 'Could not complete this request. Your changes were not saved.'}, status_code=500)

@app.middleware('http')
async def protections(request, call_next):
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        origin = request.headers.get('origin', '')
        allowed = {os.getenv('APP_ORIGIN', 'http://127.0.0.1:8000').rstrip('/')}
        if os.getenv('ALLOW_LOCAL_DEV', 'true').lower() == 'true' and not auth.secure():
            allowed.update(f'http://{h}:{p}' for h in ('localhost', '127.0.0.1') for p in (8000, 5173))
        if origin not in allowed:
            return JSONResponse({'error': 'Request origin rejected.'}, status_code=403)
        try:
            size = int(request.headers.get('content-length', '0'))
        except ValueError:
            size = 999999999
        limit = 11 * 1024 * 1024 if request.url.path in ('/api/files', '/api/chat-files') else 1024 * 1024
        if size > limit:
            return JSONResponse({'error': 'Request too large.'}, status_code=413)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['X-Frame-Options'] = 'DENY'
    if request.url.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'private, no-store'
    return response

async def body(request, maximum=1024 * 1024):
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > maximum:
            raise HTTPException(413, 'Request too large.')
    try:
        result = dict(parse_qsl(data.decode())) if request.headers.get('content-type', '').startswith('application/x-www-form-urlencoded') else json.loads(data)
    except (ValueError, UnicodeError):
        raise ValueError('Invalid request body.')
    if not isinstance(result, dict):
        raise ValueError('Invalid request body.')
    return result

def file_text(ext, content):
    if ext != 'pdf':
        return content.decode('utf-8', errors='replace')[:100000]
    try:
        reader = PdfReader(BytesIO(content), strict=False)
        extracted = []
        size = 0
        for page in reader.pages[:200]:
            value = (page.extract_text() or '').strip()
            if value:
                extracted.append(value)
                size += len(value)
            if size >= 100000:
                break
        return '\n\n'.join(extracted)[:100000]
    except Exception as exc:
        raise ValueError('This PDF could not be read. Try another PDF, TXT or Markdown file.') from exc

@app.get('/api/health')
def health():
    return {'ok': True, 'backend': 'python'}

@app.get('/api/auth/session')
def session(request: Request):
    with database() as db:
        user = auth.session_user(db, request)
        profile = one(db, 'SELECT * FROM profiles WHERE id=?', user['userId']) if user else None
        return {'user': user, 'profile': profile, 'googleEnabled': google.enabled()}

@app.post('/api/auth')
async def authenticate(request: Request):
    data = await body(request, 16000)
    def execute():
        with database() as db:
            return auth.handle_auth(db, request, data)
    return await run_in_threadpool(execute)

@app.get('/api/workspace')
def get_workspace(request: Request):
    with database() as db:
        return workspace.state(db, auth.session_user(db, request, required=True, complete=True))

@app.post('/api/workspace')
async def update_workspace(request: Request):
    data = await body(request)
    def execute():
        with database() as db:
            user = auth.session_user(db, request, required=True, complete=True)
            try:
                return workspace.action(db, user, data)
            except (KeyError, TypeError, AttributeError):
                raise ValueError('Check the fields in your request.')
    return await run_in_threadpool(execute)

@app.get('/api/auth/google/start')
def google_start(request: Request):
    with database() as db:
        return google.start(db, request)

@app.get('/api/auth/google/callback')
def google_callback(request: Request):
    with database() as db:
        return google.callback(db, request)

@app.post('/api/files')
async def upload(request: Request):
    with database() as db:
        user = auth.session_user(db, request, required=True, complete=True)
        async with request.form(max_files=1, max_fields=5, max_part_size=11 * 1024 * 1024) as form:
            file = form.get('file')
            if not hasattr(file, 'read'):
                raise ValueError('Choose a non-empty PDF, TXT or Markdown file up to 10 MB.')
            content = await file.read(10 * 1024 * 1024 + 1)
            if not content or len(content) > 10 * 1024 * 1024:
                raise ValueError('Choose a non-empty PDF, TXT or Markdown file up to 10 MB.')
            ext = (file.filename or '').rsplit('.', 1)[-1].lower()
            if ext not in ('pdf', 'txt', 'md'):
                raise ValueError('Supported files: PDF, TXT and Markdown.')
            if ext == 'pdf' and not content.startswith(b'%PDF-'):
                raise ValueError('This is not a valid PDF file.')
            extracted = file_text(ext, content)
            file_id = uid()
            key = user['userId'] + '/' + file_id
            path = data_dir() / 'uploads' / key
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            try:
                insert(db, 'resources', id=file_id, user_id=user['userId'], title=(file.filename or 'notes')[:200], topic=str(form.get('topic', ''))[:200], url='/api/files?id=' + file_id, kind=ext, file_key=key, content=extracted, created=now())
                db.commit()
            except Exception:
                path.unlink(missing_ok=True)
                raise
    return {
        'ok': True,
        'resource': {
            'id': file_id,
            'title': (file.filename or 'notes')[:200],
            'topic': str(form.get('topic', ''))[:200],
            'url': '/api/files?id=' + file_id,
            'kind': ext,
            'searchable': bool(extracted),
        },
        'note': 'The PDF was saved, but it contains no readable text. Use a text-based PDF, TXT or Markdown file.' if ext == 'pdf' and not extracted else 'Your file is ready and selected as AI context.',
    }

@app.get('/api/files')
def download(request: Request, id: str = ''):
    with database() as db:
        user = auth.session_user(db, request, required=True, complete=True)
        resource = one(db, 'SELECT * FROM resources WHERE id=? AND user_id=?', id, user['userId'])
        if not resource or not resource['file_key']:
            raise HTTPException(404, 'Not found')
        root = (data_dir() / 'uploads').resolve()
        path = (root / resource['file_key']).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise HTTPException(404, 'Not found')
        return FileResponse(path, filename=re.sub(r'[^a-zA-Z0-9._ -]', '_', resource['title']), media_type='application/pdf' if resource['kind'] == 'pdf' else 'text/plain; charset=utf-8')

@app.post('/api/chat-files')
async def upload_chat_file(request: Request):
    with database() as db:
        user = auth.session_user(db, request, required=True, complete=True)
        async with request.form(max_files=1, max_fields=5, max_part_size=11 * 1024 * 1024) as form:
            peer = str(form.get('peer', ''))
            if not one(db, "SELECT id FROM connections WHERE status='accepted' AND ((sender=? AND recipient=?) OR (sender=? AND recipient=?))", user['userId'], peer, peer, user['userId']):
                raise ValueError('Connect with this learner before sharing files.')
            file = form.get('file')
            if not hasattr(file, 'read'):
                raise ValueError('Choose a file up to 10 MB.')
            content = await file.read(10 * 1024 * 1024 + 1)
            if not content or len(content) > 10 * 1024 * 1024:
                raise ValueError('Choose a non-empty file up to 10 MB.')
            title = (file.filename or 'attachment')[:200]
            ext = title.rsplit('.', 1)[-1].lower()
            media = {
                'pdf': 'application/pdf', 'txt': 'text/plain; charset=utf-8',
                'md': 'text/markdown; charset=utf-8', 'png': 'image/png',
                'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'webp': 'image/webp',
            }
            if ext not in media:
                raise ValueError('Supported chat files: PDF, TXT, Markdown, PNG, JPG and WebP.')
            valid_signature = (
                ext not in ('pdf', 'png', 'jpg', 'jpeg', 'webp')
                or (ext == 'pdf' and content.startswith(b'%PDF-'))
                or (ext == 'png' and content.startswith(b'\x89PNG\r\n\x1a\n'))
                or (ext in ('jpg', 'jpeg') and content.startswith(b'\xff\xd8\xff'))
                or (ext == 'webp' and len(content) >= 12 and content[:4] == b'RIFF' and content[8:12] == b'WEBP')
            )
            if not valid_signature:
                raise ValueError('The selected file does not match its extension.')
            message_id = uid()
            key = user['userId'] + '/' + message_id
            path = data_dir() / 'chat_uploads' / key
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            caption = workspace.text(form.get('caption'), 4000)
            try:
                insert(db, 'messages', id=message_id, sender=user['userId'], recipient=peer,
                       body=caption, created=now(), attachment_name=title,
                       attachment_kind=ext, attachment_key=key, attachment_size=len(content))
                sender = one(db, 'SELECT name FROM profiles WHERE id=?', user['userId'])
                workspace.notify(db, peer, 'message', f"New file from {sender['name']}",
                                 caption or f'Shared {title}', f"community:{user['userId']}", message_id)
                db.commit()
            except Exception:
                path.unlink(missing_ok=True)
                raise
    return {'ok': True, 'messageId': message_id, 'note': 'File sent.'}

@app.get('/api/chat-files')
def download_chat_file(request: Request, id: str = ''):
    with database() as db:
        user = auth.session_user(db, request, required=True, complete=True)
        message = one(db, '''SELECT * FROM messages WHERE id=? AND attachment_key IS NOT NULL
            AND (sender=? OR recipient=?)''', id, user['userId'], user['userId'])
        if not message:
            raise HTTPException(404, 'Not found')
        root = (data_dir() / 'chat_uploads').resolve()
        path = (root / message['attachment_key']).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise HTTPException(404, 'Not found')
        media = {'pdf': 'application/pdf', 'txt': 'text/plain; charset=utf-8',
                 'md': 'text/markdown; charset=utf-8', 'png': 'image/png',
                 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'webp': 'image/webp'}
        filename = re.sub(r'[^a-zA-Z0-9._ -]', '_', message['attachment_name'])
        return FileResponse(path, filename=filename, media_type=media.get(message['attachment_kind'], 'application/octet-stream'), content_disposition_type='attachment')

def expire_calls(db):
    ringing_cutoff = (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
    active_cutoff = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
    stamp = now()
    db.execute("UPDATE call_sessions SET status='ended',updated=? WHERE status='ringing' AND created<?", (stamp, ringing_cutoff))
    db.execute("UPDATE call_sessions SET status='ended',updated=? WHERE status='active' AND updated<?", (stamp, active_cutoff))

def call_payload(call, candidates=None):
    if not call:
        return None
    return {**call,
            'offer': json.loads(call['offer']) if call.get('offer') else None,
            'answer': json.loads(call['answer']) if call.get('answer') else None,
            'candidates': [{**item, 'candidate': json.loads(item['candidate'])} for item in (candidates or [])]}

@app.get('/api/calls')
def current_call(request: Request):
    with database() as db:
        user = auth.session_user(db, request, required=True, complete=True)
        expire_calls(db)
        call = one(db, """SELECT * FROM call_sessions WHERE status IN ('ringing','active')
            AND (caller=? OR callee=?) ORDER BY created DESC LIMIT 1""", user['userId'], user['userId'])
        candidates = rows(db, 'SELECT * FROM call_candidates WHERE call_id=? AND sender<>? ORDER BY created', call['id'], user['userId']) if call else []
        return {'call': call_payload(call, candidates)}

@app.post('/api/calls')
async def update_call(request: Request):
    data = await body(request, 256 * 1024)
    with database() as db:
        user = auth.session_user(db, request, required=True, complete=True)
        u, action = user['userId'], data.get('action')
        expire_calls(db)
        if action == 'start':
            peer, offer = str(data.get('peer', '')), data.get('offer')
            if not one(db, "SELECT id FROM connections WHERE status='accepted' AND ((sender=? AND recipient=?) OR (sender=? AND recipient=?))", u, peer, peer, u):
                raise ValueError('Connect with this learner before calling.')
            if one(db, "SELECT id FROM call_sessions WHERE status IN ('ringing','active') AND (caller=? OR callee=? OR caller=? OR callee=?)", u, u, peer, peer):
                raise ValueError('One of you is already in a call.')
            if not isinstance(offer, dict) or offer.get('type') != 'offer' or not isinstance(offer.get('sdp'), str):
                raise ValueError('Invalid call offer.')
            call_id, stamp = uid(), now()
            insert(db, 'call_sessions', id=call_id, caller=u, callee=peer, status='ringing', offer=dump(offer), answer=None, created=stamp, updated=stamp)
            sender = one(db, 'SELECT name FROM profiles WHERE id=?', u)
            workspace.notify(db, peer, 'call', f"Incoming call from {sender['name']}", 'Open Community to answer the call.', f'community:{u}', call_id)
        else:
            call_id = str(data.get('callId', ''))
            call = one(db, 'SELECT * FROM call_sessions WHERE id=? AND (caller=? OR callee=?)', call_id, u, u)
            if not call:
                raise ValueError('Call not found.')
            if action == 'answer':
                answer = data.get('answer')
                if call['callee'] != u or call['status'] != 'ringing' or not isinstance(answer, dict) or answer.get('type') != 'answer' or not isinstance(answer.get('sdp'), str):
                    raise ValueError('This call cannot be answered.')
                db.execute("UPDATE call_sessions SET status='active',answer=?,updated=? WHERE id=?", (dump(answer), now(), call_id))
                recipient = one(db, 'SELECT name FROM profiles WHERE id=?', u)
                workspace.notify(db, call['caller'], 'call_accepted', 'Call answered', f"{recipient['name']} joined your call.", f'community:{u}', call_id)
            elif action == 'decline':
                if call['callee'] != u or call['status'] != 'ringing':
                    raise ValueError('This call cannot be declined.')
                db.execute("UPDATE call_sessions SET status='declined',updated=? WHERE id=?", (now(), call_id))
                recipient = one(db, 'SELECT name FROM profiles WHERE id=?', u)
                workspace.notify(db, call['caller'], 'call_declined', 'Call declined', f"{recipient['name']} could not join the call.", f'community:{u}', call_id)
            elif action == 'candidate':
                candidate = data.get('candidate')
                if call['status'] not in ('ringing', 'active') or not isinstance(candidate, dict) or not isinstance(candidate.get('candidate'), str):
                    raise ValueError('Invalid call candidate.')
                insert(db, 'call_candidates', id=uid(), call_id=call_id, sender=u, candidate=dump(candidate), created=now())
                db.execute('UPDATE call_sessions SET updated=? WHERE id=?', (now(), call_id))
            elif action == 'end':
                if call['status'] in ('ringing', 'active'):
                    db.execute("UPDATE call_sessions SET status='ended',updated=? WHERE id=?", (now(), call_id))
            else:
                raise ValueError('Unknown call action.')
        db.commit()
        current = one(db, 'SELECT * FROM call_sessions WHERE id=?', (call_id if action == 'start' else str(data.get('callId', ''))))
        return {'call': call_payload(current)}

if (DIST / 'assets').exists():
    app.mount('/assets', StaticFiles(directory=DIST / 'assets'), name='assets')

@app.get('/{path:path}', include_in_schema=False)
def frontend(path: str):
    if path == 'api' or path.startswith('api/'):
        raise HTTPException(404, 'API endpoint not found.')
    candidate = (DIST / path).resolve()
    if candidate.is_relative_to(DIST.resolve()) and candidate.is_file():
        return FileResponse(candidate)
    if path not in ('', 'login', 'signup', 'onboarding', 'workspace'):
        raise HTTPException(404, 'Page not found.')
    if not (DIST / 'index.html').exists():
        raise HTTPException(503, 'Build the interface first: cd frontend && npm ci && npm run build')
    return FileResponse(DIST / 'index.html', headers={'Cache-Control': 'no-cache'})
