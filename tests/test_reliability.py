"""Provider responses in these tests are fixtures, never live-AI verification."""
import json
from io import BytesIO
import pytest
from starlette.testclient import TestClient
from pypdf import PdfWriter
from backend import gemini, retrieval
from backend.main import app, file_text
from backend.db import database, one, insert, uid, now
from test_app import client, signup, action, ORIGIN, plan_input

def test_missing_ai_is_explicit_and_atomic(client):
    signup(client)
    for payload in [dict(action='tutor',question='Explain Python'),dict(action='practice',topic='Python',count=3),dict(action='deck',title='Python'),dict(action='preview',input=plan_input())]:
        response = client.post('/api/workspace', json=payload)
        assert response.status_code == 503
        assert 'not configured' in response.json()['error']
    state = client.get('/api/workspace').json()
    assert not state['history'] and not state['attempts'] and not state['decks'] and not state['plans']
    with database() as db:
        assert one(db,'SELECT COUNT(*) AS n FROM quiz_drafts')['n'] == 0

def test_retrieval_beyond_old_cutoff_and_owner_isolation(client, monkeypatch):
    state = signup(client)
    content = ('Ordinary chapter material. ' * 1000) + '\nQUASAR produces energy in an active galactic nucleus.'
    uploaded = client.post('/api/files',files={'file':('astronomy.txt',content.encode(),'text/plain')}).json()['resource']
    with database() as db:
        found = retrieval.retrieve(db,state['user']['id'],'What is QUASAR?',uploaded['id'])
        assert found and 'QUASAR' in found[0]['content']
        assert retrieval.retrieve(db,'another-user','QUASAR') == []
        with pytest.raises(ValueError):
            retrieval.retrieve(db,'another-user','QUASAR',uploaded['id'])
    def grounded(system, prompt, **kwargs):
        data = json.loads(prompt)
        return {'answer':'A quasar is an active galactic nucleus.', 'citations':[data['excerpts'][0]['id']]}
    monkeypatch.setattr(gemini,'generate_json',grounded)
    message = action(client,'tutor',question='What is QUASAR?',resourceId=uploaded['id'])['history'][-1]
    assert message['sources'][0]['resourceId'] == uploaded['id']
    monkeypatch.setattr(gemini,'generate_json',lambda *args, **kwargs:{'answer':'Invented claim','citations':['nonexistent']})
    assert client.post('/api/workspace',json=dict(action='tutor',question='QUASAR')).status_code == 503
    assert len(client.get('/api/workspace').json()['history']) == 2
    action(client,'deleteResource',id=uploaded['id'])
    assert client.get(uploaded['url']).status_code == 404
    with database() as db:
        assert retrieval.retrieve(db,state['user']['id'],'QUASAR') == []
    restored = action(client,'restoreResource',id=uploaded['id'])
    assert not restored['trashedResources']
    assert client.get(uploaded['url']).status_code == 200
    with database() as db:
        assert retrieval.retrieve(db,state['user']['id'],'QUASAR')
        summary_sources = retrieval.retrieve(db,state['user']['id'],'Summarize this file',uploaded['id'])
        assert len(summary_sources) > 6

def test_review_schedule_and_notification_total(client):
    state = signup(client)
    deck = action(client,'deck',title='Actual cards',notes='One? :: First\nTwo? :: Second')['decks'][0]
    assert deck['dueCards'] == [0,1]
    result = action(client,'review',id=deck['id'],card=0,rating='good')
    assert result['decks'][0]['dueCards'] == [1]
    action(client,'review',id=deck['id'],card=1,rating='again')
    with database() as db:
        schedule = one(db,'SELECT * FROM card_schedule WHERE deck_id=? AND card=1',deck['id'])
        assert schedule['due'] > now() and schedule['interval_days'] == 10/1440
        for n in range(125):
            insert(db,'notifications',id=uid(),user_id=state['user']['id'],kind='test',title='Test',body='Test',link='Practice',source_id=str(n),read=0,created=now())
    result = client.get('/api/workspace').json()
    assert len(result['notifications']) == 100
    assert result['unreadNotifications'] == 126
    assert action(client,'readNotifications',all=True)['unreadNotifications'] == 0

def test_recent_history_not_first_hundred(client):
    state = signup(client)
    with database() as db:
        for n in range(110):
            insert(db,'tutor_messages',id=uid(),user_id=state['user']['id'],role='user',body=str(n),created='2026-01-01T00:00:00.000Z')
    history = client.get('/api/workspace').json()['history']
    assert len(history)==100 and history[0]['body']=='10' and history[-1]['body']=='109'

def test_ocr_opt_in_and_output(monkeypatch):
    writer, buffer = PdfWriter(), BytesIO()
    writer.add_blank_page(width=100,height=100)
    writer.write(buffer)
    with pytest.raises(ValueError,match='Enable AI OCR'):
        file_text('pdf',buffer.getvalue())
    seen = []
    def transcribe(system,prompt,**kwargs):
        seen.append(kwargs['attachment'])
        return 'Photographed learning notes.'
    monkeypatch.setattr(gemini,'generate',transcribe)
    assert 'Photographed' in file_text('pdf',buffer.getvalue(),True)
    assert seen[0][0] == 'application/pdf' and seen[0][1].startswith(b'%PDF')
    with pytest.raises(ValueError,match='100,000'):
        file_text('txt',b'a'*100001)

def test_turn_credentials_are_short_lived_and_authenticated(client,monkeypatch):
    assert client.get('/api/calls/config').status_code == 401
    signup(client)
    monkeypatch.delenv('TURN_SECRET',raising=False)
    assert client.get('/api/calls/config').json()['relayConfigured'] is False
    monkeypatch.setenv('TURN_URLS','turn:relay.example:3478,turns:relay.example:5349')
    monkeypatch.setenv('TURN_SECRET','test-secret-only')
    config = client.get('/api/calls/config').json()
    assert config['relayConfigured']
    assert 'test-secret-only' not in json.dumps(config)
    assert config['iceServers'][1]['credential']

def test_provider_rejects_truncation_and_invalid_payload():
    with pytest.raises(RuntimeError):
        gemini._text({'candidates':[{'finishReason':'MAX_TOKENS','content':{'parts':[{'text':'partial'}]}}]})
    assert gemini._text({'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':'Complete'}]}}]}) == 'Complete'

def test_privacy_settings_persist_and_hide_discovery(client):
    state = signup(client)
    profile = {**state['profile'],'discoverable':True,'adaptive':False,'reminders':False}
    saved = action(client,'profile',profile=profile)['profile']
    assert saved['discoverable']==1 and saved['adaptive']==0 and saved['reminders']==0
    for _ in range(3):
        assert client.get('/api/workspace').json()['profile']==saved
    action(client,'profile',profile={**profile,'discoverable':False})
    with TestClient(app,base_url=ORIGIN,headers={'Origin':ORIGIN}) as other:
        assert not signup(other,'private-check@example.com')['peers']

def test_ai_limit_is_persisted_without_stopping_manual_features(client,monkeypatch):
    signup(client)
    monkeypatch.setenv('GEMINI_API_KEY','test-key')
    monkeypatch.setenv('AI_REQUESTS_PER_USER_HOUR','1')
    monkeypatch.setattr(gemini,'generate_json',lambda *args, **kwargs:{'answer':'Test contract response.','citations':[]})
    action(client,'tutor',question='Explain Python')
    response = client.post('/api/workspace',json={'action':'tutor','question':'Explain another topic'})
    assert response.status_code == 429
    assert len(client.get('/api/workspace').json()['history']) == 2
    assert action(client,'preview',mode='rules',input=plan_input())['tasks']

def test_legacy_import_applies_missing_migrations(tmp_path,monkeypatch):
    import os
    import sqlite3
    import subprocess
    import sys
    from backend.db import ROOT, initialize
    old = sqlite3.connect(':memory:')
    for migration in sorted((ROOT/'backend/migrations').glob('000[01]*.sql')):
        old.executescript(migration.read_text())
    old.execute("INSERT INTO auth_accounts VALUES ('preserved','legacy-export@example.com','existing-password-format',1,1)")
    old.execute("INSERT INTO profiles (id,name,created) VALUES ('preserved','Preserved learner','2026-01-01')")
    old.execute("INSERT INTO auth_sessions VALUES ('old-session','preserved',9999999999999,1)")
    exported = tmp_path/'legacy.sql'
    exported.write_text('\n'.join(old.iterdump()))
    old.close()
    destination = tmp_path/'updated'
    result = subprocess.run([sys.executable,str(ROOT/'tools/import_sql.py'),str(exported)],env={**os.environ,'NEXOVIA_DATA_DIR':str(destination)},capture_output=True,text=True)
    assert result.returncode == 0, result.stderr
    monkeypatch.setenv('NEXOVIA_DATA_DIR',str(destination))
    initialize()
    with database() as db:
        assert one(db,'SELECT COUNT(*) AS n FROM schema_migrations')['n'] == len(list((ROOT/'backend/migrations').glob('*.sql')))
        assert db.execute('SELECT deleted_at FROM resources').fetchall() == []
        assert db.execute('SELECT provider,sources FROM tutor_messages').fetchall() == []
        assert db.execute('SELECT * FROM call_sessions').fetchall() == []
        assert one(db,'SELECT name FROM profiles WHERE id=?','preserved')['name']=='Preserved learner'
        assert one(db,'SELECT password_hash,email_verified FROM auth_accounts WHERE id=?','preserved')=={'password_hash':'existing-password-format','email_verified':0}
        assert one(db,'SELECT token_hash FROM auth_sessions WHERE user_id=?','preserved') is None
