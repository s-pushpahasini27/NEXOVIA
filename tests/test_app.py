import json
from urllib.parse import parse_qs, urlparse
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.db import database, one
from backend.study import today, add_days
from backend import google, gemini, main as main_module

ORIGIN = 'http://127.0.0.1:8000'
PASSWORD = 'correct horse battery staple'

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('NEXOVIA_DATA_DIR', str(tmp_path))
    monkeypatch.setenv('APP_ORIGIN', ORIGIN)
    monkeypatch.delenv('GOOGLE_OAUTH_CLIENT_ID', raising=False)
    monkeypatch.delenv('GOOGLE_OAUTH_CLIENT_SECRET', raising=False)
    monkeypatch.delenv('GEMINI_API_KEY', raising=False)
    with TestClient(app, base_url=ORIGIN, headers={'Origin': ORIGIN}) as c:
        yield c

def signup(c, email='learner@example.com', name='Ada Learner'):
    r = c.post('/api/auth', json={'action': 'signup', 'email': email, 'password': PASSWORD, 'confirmPassword': PASSWORD})
    assert r.status_code == 201, r.text
    assert r.json()['redirect'] == '/onboarding'
    assert c.get('/api/workspace').status_code == 403
    r = c.post('/api/auth', json={'action': 'profile', 'name': name, 'goal': '600', 'bio': '', 'subjects': 'Python'})
    assert r.status_code == 200, r.text
    return c.get('/api/workspace').json()

def action(c, action, **kwargs):
    r = c.post('/api/workspace', json={'action': action, **kwargs})
    assert r.status_code == 200, r.text
    return r.json()

def plan_input(offset=1, adaptive=False):
    return dict(title='Python study', start=add_days(today(), offset), days=2, weekday=120, weekend=180, session=30, startTime='09:00', subjects=[dict(name='Python', topics='Collections', priority='high', difficulty='medium', deadline=add_days(today(), 25), weak=False)], adaptive=adaptive)

def test_auth_sessions_password_and_csrf(client):
    c = client
    assert c.get('/api/workspace').status_code == 401
    assert c.post('/api/auth', json={'action': 'signup'}, headers={'Origin': 'https://other.example'}).status_code == 403
    signup(c)
    token = c.cookies.get('nexovia_session')
    with TestClient(app, base_url=ORIGIN, headers={'Origin': ORIGIN}) as other:
        other.cookies.set('nexovia_session', token)
        assert other.get('/api/workspace').json()['profile']['name'] == 'Ada Learner'
        r = c.post('/api/auth', json=dict(action='password', currentPassword=PASSWORD, password=PASSWORD+'2', confirmPassword=PASSWORD+'2'))
        assert r.status_code == 200
        assert other.get('/api/workspace').status_code == 401
    assert c.get('/api/workspace').status_code == 200
    assert c.post('/api/auth', data={'action':'logout'}, follow_redirects=False).status_code == 303
    assert c.get('/api/workspace').status_code == 401
    assert c.post('/api/auth', json=dict(action='login', email='learner@example.com', password=PASSWORD)).status_code == 401
    assert c.post('/api/auth', json=dict(action='login', email='learner@example.com', password=PASSWORD+'2')).json()['redirect'] == '/workspace'

def test_plans_preserved_adaptive_optional_conflicts_and_tasks(client):
    c = client
    signup(c)
    x = plan_input()
    preview = action(c, 'preview', input=x)
    assert len(preview['tasks']) == 2  # Checkbox off still generates.
    state = action(c, 'savePlan', input=x, tasks=preview['tasks'])
    first_ids = {t['id'] for t in state['tasks']}
    y = plan_input(4, adaptive=True)
    state = action(c, 'savePlan', input=y, tasks=action(c, 'preview', input=y)['tasks'])
    assert len(state['plans']) == 2
    assert first_ids.issubset({t['id'] for t in state['tasks']})
    assert c.post('/api/workspace', json=dict(action='savePlan', input=x, tasks=preview['tasks'])).status_code == 400
    assert len(c.get('/api/workspace').json()['plans']) == 2
    task = state['tasks'][0]
    state = action(c, 'task', id=task['id'], operation='snooze')
    assert next(t for t in state['tasks'] if t['id']==task['id'])['snoozeUntil']
    action(c, 'task', id=task['id'], operation='edit', task={**task,'time':'14:00'})
    assert action(c, 'recover', id=task['id'])['proposal']['date'] >= today()
    state = action(c, 'logSession', taskId=task['id'], minutes=20, complete=True)
    assert state['sessions'][0]['minutes'] == 20
    assert next(t for t in state['tasks'] if t['id']==task['id'])['status'] == 'completed'
    assert c.post('/api/workspace', json=dict(action='task', id=task['id'], operation='edit', task=task)).status_code == 400
    action(c, 'task', id=task['id'], operation='complete', complete=False)
    with database() as db:
        db.execute("UPDATE plans SET status='archived' WHERE id=?", (state['plans'][0]['id'],))
    restored = action(c, 'restorePlan', id=state['plans'][0]['id'])
    assert len(restored['plans']) == 2

def test_files_tutor_quizzes_decks_and_isolation(client, monkeypatch):
    c = client
    signup(c)
    resource = action(c, 'resource', title='Python docs', url='https://docs.python.org/', topic='Python')['resources'][0]
    action(c, 'deleteResource', id=resource['id'])
    r = c.post('/api/files', files={'file': ('notes.md', b'Binary search halves a sorted search interval.', 'text/markdown')}, data={'topic':'Binary search'})
    assert r.status_code == 200, r.text
    assert r.json()['resource']['searchable'] is True
    rsrc = c.get('/api/workspace').json()['resources'][0]
    assert r.json()['resource']['id'] == rsrc['id']
    assert c.get(rsrc['url']).content.startswith(b'Binary search')
    history = action(c, 'tutor', question='Explain binary search', resourceId=rsrc['id'])['history']
    assert 'Matching passages' in history[-1]['body']
    class TextPage:
        def extract_text(self): return 'Mitochondria produce energy for the cell.'
    class TextPdf:
        pages = [TextPage()]
    monkeypatch.setattr(main_module, 'PdfReader', lambda *args, **kwargs: TextPdf())
    pdf = c.post('/api/files', files={'file': ('biology.pdf', b'%PDF-readable', 'application/pdf')})
    assert pdf.status_code == 200, pdf.text
    assert pdf.json()['resource']['searchable'] is True
    pdf_history = action(c, 'tutor', question='What do mitochondria produce?', resourceId=pdf.json()['resource']['id'])['history']
    assert 'Matching passages from biology.pdf' in pdf_history[-1]['body']
    assert c.post('/api/files', files={'file':('bad.pdf',b'not a PDF')}).status_code == 400
    assert c.post('/api/files', files={'file':('bad.exe',b'bad')}).status_code == 400
    quiz = action(c, 'practice', topic='Binary search', count=3)
    assert len(quiz['questions']) == 2
    assert all('answer' not in q and 'explanation' not in q for q in quiz['questions'])
    with database() as db:
        answers = [q['answer'] for q in json.loads(one(db,'SELECT questions FROM quiz_drafts WHERE id=?',quiz['id'])['questions'])]
    assert action(c,'submitQuiz',id=quiz['id'],answers=answers)['score'] == 2
    action(c,'submitQuiz',id=quiz['id'],answers=answers)
    assert len(c.get('/api/workspace').json()['attempts']) == 1
    deck = action(c,'deck', title='Notes', notes='What is BFS? :: Breadth first search')['decks'][0]
    assert len(action(c,'review',id=deck['id'],card=0,rating='good')['reviews']) == 1
    with TestClient(app,base_url=ORIGIN,headers={'Origin':ORIGIN}) as other:
        signup(other,'second@example.com')
        assert other.get(rsrc['url']).status_code == 404
        assert other.post('/api/workspace',json=dict(action='submitQuiz',id=quiz['id'],answers=answers)).status_code == 400
        assert other.post('/api/workspace',json=dict(action='review',id=deck['id'],card=0,rating='good')).status_code == 400
        state = other.get('/api/workspace').json()
        assert not state['resources'] and not state['history'] and not state['decks']

def test_community_permissions(client):
    c = client
    alice = signup(c)
    with TestClient(app,base_url=ORIGIN,headers={'Origin':ORIGIN}) as other:
        bob = signup(other,'bob@example.com','Bob')
        action(other,'profile',profile={**bob['profile'],'discoverable':True,'latitude':12.9876,'longitude':77.5123})
        assert c.post('/api/workspace',json=dict(action='message',id=bob['user']['id'],body='Hello')).status_code == 400
        connection = action(c,'connect',id=bob['user']['id'])['connections'][0]
        assert c.post('/api/workspace',json=dict(action='accept',id=connection['id'])).status_code == 400
        bob_state = other.get('/api/workspace').json()
        assert bob_state['unreadNotifications'] == 1
        assert bob_state['notifications'][0]['kind'] == 'connection'
        action(other,'accept',id=connection['id'])
        assert c.get('/api/workspace').json()['notifications'][0]['kind'] == 'connection_accepted'
        action(c,'message',id=bob['user']['id'],body='Study together?')
        bob_state = other.get('/api/workspace').json()
        assert bob_state['messages'][0]['body'] == 'Study together?'
        assert bob_state['notifications'][0]['kind'] == 'message'
        assert bob_state['unreadNotifications'] == 2
        shared = c.post('/api/chat-files', data={'peer':bob['user']['id'],'caption':'My notes'},
                        files={'file':('graphs.md',b'BFS uses a queue.','text/markdown')})
        assert shared.status_code == 200, shared.text
        message_id = shared.json()['messageId']
        bob_state = other.get('/api/workspace').json()
        assert bob_state['messages'][-1]['attachment_name'] == 'graphs.md'
        assert bob_state['messages'][-1]['body'] == 'My notes'
        assert other.get('/api/chat-files?id=' + message_id).content == b'BFS uses a queue.'
        assert bob_state['notifications'][0]['title'] == 'New file from Ada Learner'
        assert bob_state['unreadNotifications'] == 3
        assert c.post('/api/chat-files', data={'peer':bob['user']['id']},
                      files={'file':('unsafe.exe',b'bad','application/octet-stream')}).status_code == 400
        action(other,'readNotifications',peerId=alice['user']['id'])
        assert other.get('/api/workspace').json()['unreadNotifications'] == 0
        started = c.post('/api/calls', json={'action':'start','peer':bob['user']['id'],
                         'offer':{'type':'offer','sdp':'test-offer'}})
        assert started.status_code == 200, started.text
        call_id = started.json()['call']['id']
        incoming = other.get('/api/calls').json()['call']
        assert incoming['id'] == call_id and incoming['status'] == 'ringing'
        assert other.get('/api/workspace').json()['notifications'][0]['kind'] == 'call'
        answered = other.post('/api/calls',json={'action':'answer','callId':call_id,
                              'answer':{'type':'answer','sdp':'test-answer'}})
        assert answered.status_code == 200, answered.text
        assert c.get('/api/calls').json()['call']['answer']['sdp'] == 'test-answer'
        candidate = {'candidate':'candidate:1 1 UDP 1 127.0.0.1 9000 typ host','sdpMid':'0','sdpMLineIndex':0}
        assert c.post('/api/calls',json={'action':'candidate','callId':call_id,'candidate':candidate}).status_code == 200
        assert other.get('/api/calls').json()['call']['candidates'][0]['candidate']['candidate'].startswith('candidate:1')
        assert other.post('/api/calls',json={'action':'end','callId':call_id}).status_code == 200
        assert c.get('/api/calls').json()['call'] is None
        assert c.get('/api/workspace').json()['peers'][0]['latitude'] == 13.0

def test_gemini_tutor_quiz_and_flashcards(client, monkeypatch):
    c = client
    signup(c)
    monkeypatch.setenv('GEMINI_API_KEY','test-key')
    monkeypatch.setattr(gemini,'generate',lambda system,prompt,**kwargs:'A live Gemini explanation.')
    def structured(system,prompt):
        if 'flashcards' in prompt:
            return [dict(q=f'Card {i}?',a=f'Answer {i}') for i in range(10)]
        return [dict(topic='Python',subject='Programming',q=f'Question {i}?',options=['A','B','C','D'],answer=0,explanation='Because A is correct.') for i in range(3)]
    monkeypatch.setattr(gemini,'generate_json',structured)
    tutor = action(c,'tutor',question='Explain lists')
    assert tutor['aiConnected'] is True
    assert tutor['history'][-1]['body'] == 'A live Gemini explanation.'
    quiz = action(c,'practice',topic='Python',count=3)
    assert quiz['mode'] == 'Gemini generated practice'
    assert len(quiz['questions']) == 3
    deck_state = action(c,'deck',title='Python',notes='')
    assert len(deck_state['decks'][0]['cards']) == 10

def test_gemini_study_planner_and_safe_fallback(client, monkeypatch):
    c = client
    signup(c)
    monkeypatch.setenv('GEMINI_API_KEY','test-key')
    monkeypatch.setattr(gemini,'generate_json',lambda system,prompt:[{'session':0,'slot':0},{'session':1,'slot':1}])
    preview = action(c,'preview',input=plan_input())
    assert preview['mode'] == 'Gemini AI planner'
    assert len(preview['tasks']) == 2
    assert preview['tasks'][0]['kind'] == 'Learn'
    monkeypatch.setattr(gemini,'generate_json',lambda system,prompt:[{'session':0,'slot':0},{'session':0,'slot':1}])
    fallback = action(c,'preview',input=plan_input())
    assert fallback['mode'] == 'Smart scheduler fallback'
    assert len(fallback['tasks']) == 2

def test_google_flow_guards_and_mocked_verified_identity(client, monkeypatch):
    c = client
    assert c.get('/api/auth/session').json()['googleEnabled'] is False
    monkeypatch.setenv('GOOGLE_OAUTH_CLIENT_ID','test-client')
    monkeypatch.setenv('GOOGLE_OAUTH_CLIENT_SECRET','test-secret')
    monkeypatch.setenv('GOOGLE_OAUTH_REDIRECT_URI',ORIGIN+'/api/auth/google/callback')
    start = c.get('/api/auth/google/start',follow_redirects=False)
    query = parse_qs(urlparse(start.headers['location']).query)
    assert query['code_challenge_method'] == ['S256']
    bad = c.get('/api/auth/google/callback?code=x&state=forged',follow_redirects=False)
    assert '/login?' in bad.headers['location']
    assert c.get('/api/auth/session').json()['user'] is None
    start = c.get('/api/auth/google/start',follow_redirects=False)
    query = parse_qs(urlparse(start.headers['location']).query)
    monkeypatch.setattr(google,'exchange',lambda code,verifier:dict(sub='google123',email='googleuser@gmail.com',email_verified=True,nonce=query['nonce'][0],name='Google Learner'))
    response = c.get('/api/auth/google/callback',params=dict(code='mock-code',state=query['state'][0]),follow_redirects=False)
    assert response.headers['location'] == '/onboarding'
    user = c.get('/api/auth/session').json()['user']
    assert user['hasPassword'] == 0 and user['fullName'] == 'Google Learner'

def test_validation_static_and_rate_limit(client):
    c = client
    for path in ('/','/login','/signup','/workspace'):
        response = c.get(path)
        assert response.status_code == 200
        assert 'Nexovia' in response.text
    assert c.get('/api/not-a-route').status_code == 404
    assert c.get('/backend/auth.py').status_code == 404
    assert c.post('/api/auth',content='invalid').status_code == 400
    for _ in range(10):
        assert c.post('/api/auth',json=dict(action='login',email='absent@example.com',password='bad')).status_code == 401
    assert c.post('/api/auth',json=dict(action='login',email='absent@example.com',password='bad')).status_code == 429

def test_google_token_signature_and_claims(client, monkeypatch):
    import time
    from types import SimpleNamespace
    import jwt
    from cryptography.hazmat.primitives.asymmetric import rsa
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setenv('GOOGLE_OAUTH_CLIENT_ID', 'expected-client')
    monkeypatch.setenv('GOOGLE_OAUTH_CLIENT_SECRET', 'test-secret')
    monkeypatch.setenv('GOOGLE_OAUTH_REDIRECT_URI', ORIGIN+'/api/auth/google/callback')
    claims = dict(iss='https://accounts.google.com', aud='expected-client', sub='test-sub', iat=int(time.time()), exp=int(time.time())+300, nonce='test-nonce', email='test@gmail.com', email_verified=True)
    token = jwt.encode(claims, key, algorithm='RS256', headers={'kid':'test-key'})
    class Response:
        def raise_for_status(self): pass
        def json(self): return {'id_token': token}
    class HTTPClient:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def post(self, *args, **kwargs): return Response()
    monkeypatch.setattr(google.httpx, 'Client', HTTPClient)
    monkeypatch.setattr(google.JWKS, 'get_signing_key_from_jwt', lambda t: SimpleNamespace(key=key.public_key()))
    assert google.exchange('code','verifier')['sub'] == 'test-sub'
    for overrides in ({'aud':'wrong-client'},{'iss':'https://attacker.example'},{'exp':int(time.time())-60}):
        token = jwt.encode({**claims,**overrides},key,algorithm='RS256')
        with pytest.raises(jwt.PyJWTError):
            google.exchange('code','verifier')
    token = jwt.encode(claims,rsa.generate_private_key(public_exponent=65537,key_size=2048),algorithm='RS256')
    with pytest.raises(jwt.InvalidSignatureError):
        google.exchange('code','verifier')

def test_import_preserves_ids_and_invalidates_sessions(client, tmp_path, monkeypatch):
    import os
    import subprocess
    import sys
    from pathlib import Path
    from backend.db import ROOT
    signup(client)
    original = client.get('/api/workspace').json()['user']['id']
    dump = tmp_path/'export.sql'
    with database() as db:
        dump.write_text('\n'.join(db.iterdump()), encoding='utf-8')
    destination = tmp_path/'imported'
    result = subprocess.run([sys.executable,str(ROOT/'tools/import_sql.py'),str(dump)],env={**os.environ,'NEXOVIA_DATA_DIR':str(destination)},capture_output=True,text=True)
    assert result.returncode == 0, result.stderr
    monkeypatch.setenv('NEXOVIA_DATA_DIR',str(destination))
    with database() as db:
        assert one(db,'SELECT id FROM auth_accounts')['id'] == original
        assert one(db,'SELECT COUNT(*) AS n FROM auth_sessions')['n'] == 0
    refused = subprocess.run([sys.executable,str(ROOT/'tools/import_sql.py'),str(dump)],env={**os.environ,'NEXOVIA_DATA_DIR':str(destination)},capture_output=True,text=True)
    assert refused.returncode != 0
