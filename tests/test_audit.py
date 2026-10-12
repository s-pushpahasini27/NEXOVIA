"""Regression and contract tests. Provider fixtures do not verify live services."""
import json
import pytest
from backend.db import database, one
from backend.study import today
from test_app import client, signup, action, plan_input
from backend.mailer import send_otp as real_send_otp

def test_followup_retrieval_and_native_pdf_are_owner_scoped(client,monkeypatch):
    from backend import gemini, retrieval
    from backend.db import insert, uid, now, data_dir
    state = signup(client)
    uploaded = client.post('/api/files',files={'file':('notes.txt',b'QUASAR is a bright galactic nucleus.','text/plain')}).json()['resource']
    with database() as db:
        insert(db,'tutor_messages',id=uid(),user_id=state['user']['id'],role='user',body='Explain QUASAR',created=now())
        payload, sources, attachment = retrieval.context(db,state['user']['id'],'Give an example of it',uploaded['id'])
        assert sources and 'QUASAR' in sources[0]['content'] and attachment is None
        db.execute("UPDATE resources SET kind='pdf' WHERE id=?",(uploaded['id'],))
        payload, sources, attachment = retrieval.context(db,state['user']['id'],'Explain this figure',uploaded['id'],True)
        assert payload['originalPdfAttached'] and attachment[0]=='application/pdf'
        with pytest.raises(ValueError):
            retrieval.context(db,'other-user','Explain this figure',uploaded['id'],True)

def test_visual_validation_and_private_image_delivery(client,monkeypatch):
    from backend import gemini
    from starlette.testclient import TestClient
    from test_app import ORIGIN
    signup(client)
    result = {'studyRelated':True,'explanation':'A study workflow.','imagePrompt':'Illustrate cell structure.',
              'nodes':[{'id':'a','label':'Read'},{'id':'b','label':'Practice'}],
              'edges':[{'from':'a','to':'b','label':'then'}]}
    monkeypatch.setattr(gemini,'generate_json',lambda *a,**k:result)
    state = action(client,'visual',kind='diagram',question='Draw a learning workflow')
    assert state['history'][-1]['visual']['nodes'][0]['label']=='Read'
    result['edges'][0]['to']='missing'
    assert client.post('/api/workspace',json={'action':'visual','kind':'diagram','question':'Draw a workflow'}).status_code==503
    assert len(client.get('/api/workspace').json()['history'])==2
    monkeypatch.setattr(gemini,'image',lambda prompt:('image/png',b'\x89PNG\r\n\x1a\nfixture'))
    state = action(client,'visual',kind='image',question='Illustrate a cell')
    url = state['history'][-1]['visual']['url']
    assert client.get(url).content.startswith(b'\x89PNG')
    with TestClient(__import__('backend.main',fromlist=['app']).app,base_url=ORIGIN,headers={'Origin':ORIGIN}) as other:
        signup(other,'visual-owner@example.com')
        assert other.get(url).status_code==404

def test_gemini_wire_schema_thought_filtering_and_errors(monkeypatch):
    import httpx
    from backend import gemini
    monkeypatch.setenv('GEMINI_API_KEY','fixture-not-real')
    requests = []
    real_client = httpx.Client
    def respond(request):
        requests.append(json.loads(request.content))
        return httpx.Response(200,json={'candidates':[{'finishReason':'STOP','content':{'parts':[{'thought':True,'text':'private reasoning'},{'text':'{"answer":"Complete","citations":[]}'}]}}]})
    monkeypatch.setattr(gemini.httpx,'Client',lambda **kw:real_client(transport=httpx.MockTransport(respond)))
    result = gemini.generate_json('Study tutor','Explain a cell',schema={'type':'OBJECT'},attachment=('application/pdf',b'%PDF-fixture'))
    assert result['answer']=='Complete'
    assert requests[0]['generationConfig']['responseSchema']=={'type':'OBJECT'}
    assert requests[0]['contents'][0]['parts'][1]['inlineData']['mimeType']=='application/pdf'
    monkeypatch.setattr(gemini.httpx,'Client',lambda **kw:real_client(transport=httpx.MockTransport(lambda r:httpx.Response(404))))
    with pytest.raises(RuntimeError,match='model is unavailable'):
        gemini.generate('Tutor','Explain a cell')

def test_audio_calls_access_control_busy_and_terminal_states(client):
    from starlette.testclient import TestClient
    from backend.main import app
    from test_app import ORIGIN
    alice = signup(client)
    with TestClient(app,base_url=ORIGIN,headers={'Origin':ORIGIN}) as bob, TestClient(app,base_url=ORIGIN,headers={'Origin':ORIGIN}) as intruder:
        b = signup(bob,'audio-bob@example.com')
        signup(intruder,'audio-intruder@example.com')
        action(bob,'profile',profile={**b['profile'],'discoverable':True})
        conn = action(client,'connect',id=b['user']['id'])['connections'][0]
        action(bob,'accept',id=conn['id'])
        start = {'action':'start','peer':b['user']['id'],'media':'audio','offer':{'type':'offer','sdp':'test-offer'}}
        call = client.post('/api/calls',json=start).json()['call']
        assert call['media']=='audio'
        assert client.post('/api/calls',json=start).status_code==400
        assert intruder.get('/api/calls').json()['call'] is None
        for operation in ('answer','end','candidate','decline'):
            assert intruder.post('/api/calls',json={'action':operation,'callId':call['id']}).status_code==400
        assert bob.post('/api/calls',json={'action':'answer','callId':call['id'],'answer':{'type':'answer','sdp':'answer'}}).status_code==200
        assert bob.post('/api/calls',json={'action':'decline','callId':call['id']}).status_code==400
        assert client.post('/api/calls',json={'action':'end','callId':call['id']}).status_code==200
        assert bob.get('/api/calls').json()['call'] is None
        assert client.post('/api/calls',json={'action':'candidate','callId':call['id'],'candidate':{'candidate':'x'}}).status_code==400

@pytest.mark.parametrize('email',['a..b@example.com','.a@example.com','a.@example.com','a@-bad.com','a@bad_.com','a<b>@example.com','a@localhost','a@b.123','a\n@example.com','a'*65+'@example.com'])
def test_email_format_validation(email):
    from backend.auth import validate_email
    with pytest.raises(ValueError):
        validate_email(email)

def test_otp_is_browser_bound_one_use_and_never_returned(client):
    from starlette.testclient import TestClient
    from backend.main import app
    from test_app import ORIGIN, PASSWORD, OTP_CODES
    email='otp-owner@example.com'
    response=client.post('/api/auth',json={'action':'signup','email':email,'password':PASSWORD,'confirmPassword':PASSWORD})
    assert response.status_code==202
    code=OTP_CODES[email]
    assert code not in response.text and 'nexovia_session' not in client.cookies
    assert client.get('/api/auth/session').json()['verification']['email']==email
    with database() as db:
        pending=one(db,'SELECT * FROM email_challenges WHERE email=?',email)
        assert code not in pending['code_hash'] and pending['password_hash']!=PASSWORD
        assert one(db,'SELECT id FROM auth_accounts WHERE email=?',email) is None
    with TestClient(app,base_url=ORIGIN,headers={'Origin':ORIGIN}) as other:
        assert other.post('/api/auth',json={'action':'verifyEmail','code':code}).status_code==400
    assert client.post('/api/auth',json={'action':'resendVerification'}).status_code==429
    assert client.post('/api/auth',json={'action':'verifyEmail','code':code}).status_code==201
    assert client.post('/api/auth',json={'action':'verifyEmail','code':code}).status_code==400
    with database() as db:
        assert one(db,'SELECT email_verified FROM auth_accounts WHERE email=?',email)['email_verified']==1

def test_otp_attempts_expiry_and_resend_invalidation(client):
    import time
    from test_app import PASSWORD, OTP_CODES
    def begin(email):
        assert client.post('/api/auth',json={'action':'signup','email':email,'password':PASSWORD,'confirmPassword':PASSWORD}).status_code==202
    begin('otp-attempt@example.com')
    correct=OTP_CODES['otp-attempt@example.com']
    wrong='000000' if correct!='000000' else '000001'
    for _ in range(5):
        assert client.post('/api/auth',json={'action':'verifyEmail','code':wrong}).status_code==400
    assert client.post('/api/auth',json={'action':'verifyEmail','code':correct}).status_code==400
    begin('otp-expiry@example.com')
    with database() as db:
        db.execute('UPDATE email_challenges SET expires=? WHERE email=?',(int(time.time())-1,'otp-expiry@example.com'))
    assert client.post('/api/auth',json={'action':'verifyEmail','code':OTP_CODES['otp-expiry@example.com']}).status_code==400
    begin('otp-resend@example.com')
    old=OTP_CODES['otp-resend@example.com']
    with database() as db:
        db.execute('UPDATE email_challenges SET sent=sent-61 WHERE email=?',('otp-resend@example.com',))
    assert client.post('/api/auth',json={'action':'resendVerification'}).status_code==202
    new=OTP_CODES['otp-resend@example.com']
    # A fresh browser token invalidates the old challenge even if the six digits repeat.
    assert client.post('/api/auth',json={'action':'verifyEmail','code':new}).status_code==201

def test_smtp_failure_does_not_create_account_or_session(client,monkeypatch):
    from backend import mailer
    from test_app import PASSWORD
    def fail(*args):
        raise RuntimeError('Email provider unavailable')
    monkeypatch.setattr(mailer,'send_otp',fail)
    response=client.post('/api/auth',json={'action':'signup','email':'delivery-fail@example.com','password':PASSWORD,'confirmPassword':PASSWORD})
    assert response.status_code==503
    assert not client.cookies.get('nexovia_session')
    with database() as db:
        assert one(db,'SELECT id FROM auth_accounts WHERE email=?','delivery-fail@example.com') is None
        assert one(db,'SELECT email FROM email_challenges WHERE email=?','delivery-fail@example.com') is None

def test_legacy_login_requires_verification_preserves_data(client):
    from backend.auth import hash_password
    from backend.db import insert,uid,now
    from test_app import PASSWORD,OTP_CODES
    user_id=uid()
    with database() as db:
        insert(db,'auth_accounts',id=user_id,email='legacy@example.com',password_hash=hash_password(PASSWORD),profile_complete=1,created=1)
        insert(db,'profiles',id=user_id,name='Existing learner',created=now())
    response=client.post('/api/auth',json={'action':'login','email':'legacy@example.com','password':PASSWORD})
    assert response.status_code==202
    assert client.get('/api/workspace').status_code==401
    response=client.post('/api/auth',json={'action':'verifyEmail','code':OTP_CODES['legacy@example.com']})
    assert response.status_code==200 and response.json()['redirect']=='/workspace'
    assert client.get('/api/workspace').json()['profile']['name']=='Existing learner'

def test_smtp_transport_uses_tls_and_rejects_remote_plaintext(monkeypatch):
    from backend import mailer
    events=[]
    class Transport:
        def __init__(self,*a,**k):events.append('connect')
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def ehlo(self):events.append('ehlo')
        def starttls(self,**kwargs):events.append('tls')
        def login(self,*args):events.append('login')
        def send_message(self,message):
            assert '123456' in message.get_content() and message['To']=='recipient@example.com'
            events.append('send');return {}
    monkeypatch.setattr(mailer.smtplib,'SMTP',Transport)
    monkeypatch.setenv('SMTP_HOST','smtp.example.com')
    monkeypatch.setenv('SMTP_FROM','Nexovia <noreply@example.com>')
    monkeypatch.setenv('SMTP_USERNAME','test')
    mailer.send_otp('recipient@example.com','123456')
    assert events==['connect','ehlo','tls','ehlo','login','send']
    monkeypatch.setenv('SMTP_TLS_MODE','local')
    with pytest.raises(RuntimeError,match='requires STARTTLS'):
        mailer.send_otp('recipient@example.com','123456')

def test_native_scanned_pdf_upload_and_tutor_contract(client,monkeypatch):
    from io import BytesIO
    from pypdf import PdfWriter
    from backend import gemini
    signup(client)
    writer,buffer=PdfWriter(),BytesIO()
    writer.add_blank_page(width=100,height=100)
    writer.write(buffer)
    response=client.post('/api/files',files={'file':('scanned.pdf',buffer.getvalue(),'application/pdf')},data={'nativePdf':'true'})
    assert response.status_code==200
    resource=response.json()['resource']
    assert resource['nativePdfReady'] and not resource['searchable']
    seen=[]
    def respond(system,prompt,**kwargs):
        seen.append(kwargs['attachment'])
        return {'answer':'The supplied PDF page is blank.','citations':[]}
    monkeypatch.setattr(gemini,'generate_json',respond)
    assert action(client,'tutor',question='Describe page 1',resourceId=resource['id'],nativePdf=True)['history'][-1]['body']=='The supplied PDF page is blank.'
    assert seen[0][0]=='application/pdf' and seen[0][1].startswith(b'%PDF')

def test_otp_resend_invalidates_prior_browser_token(client):
    from starlette.testclient import TestClient
    from backend.main import app
    from backend.email_verification import COOKIE
    from test_app import ORIGIN,PASSWORD,OTP_CODES
    email='rotate@example.com'
    client.post('/api/auth',json={'action':'signup','email':email,'password':PASSWORD,'confirmPassword':PASSWORD})
    token=client.cookies.get(COOKIE)
    with database() as db:
        db.execute('UPDATE email_challenges SET sent=sent-61 WHERE email=?',(email,))
    assert client.post('/api/auth',json={'action':'resendVerification'}).status_code==202
    with TestClient(app,base_url=ORIGIN,headers={'Origin':ORIGIN}) as stale:
        stale.cookies.set(COOKIE,token)
        assert stale.post('/api/auth',json={'action':'verifyEmail','code':OTP_CODES[email]}).status_code==400

def test_missing_smtp_configuration_blocks_signup(client,monkeypatch):
    from backend import mailer
    from test_app import PASSWORD
    monkeypatch.setattr(mailer,'send_otp',real_send_otp)
    monkeypatch.delenv('SMTP_HOST',raising=False)
    monkeypatch.delenv('SMTP_FROM',raising=False)
    response=client.post('/api/auth',json={'action':'signup','email':'no-mail@example.com','password':PASSWORD,'confirmPassword':PASSWORD})
    assert response.status_code==503 and 'Configure SMTP_HOST' in response.json()['error']
    with database() as db:
        assert one(db,'SELECT id FROM auth_accounts WHERE email=?','no-mail@example.com') is None

def test_existing_account_message_guides_to_login(client):
    from test_app import PASSWORD
    signup(client,'already@example.com')
    response=client.post('/api/auth',json={'action':'signup','email':'already@example.com','password':PASSWORD,'confirmPassword':PASSWORD})
    assert response.status_code==400
    assert 'Log in to continue' in response.json()['error']

def test_image_response_decodes_and_rejects_corrupt_images(monkeypatch):
    import base64
    import httpx
    from io import BytesIO
    from PIL import Image
    from backend import gemini
    buffer=BytesIO()
    Image.new('RGB',(2,2)).save(buffer,format='PNG')
    monkeypatch.setenv('GEMINI_API_KEY','fixture-key')
    monkeypatch.setenv('GEMINI_IMAGE_MODEL','gemini-2.5-flash-image')
    real_client=httpx.Client
    def transport(data):
        return httpx.MockTransport(lambda r:httpx.Response(200,json={'candidates':[{'finishReason':'STOP','content':{'parts':[{'inlineData':{'mimeType':'image/png','data':base64.b64encode(data).decode()}}]}}]}))
    monkeypatch.setattr(gemini.httpx,'Client',lambda **kw:real_client(transport=transport(buffer.getvalue())))
    assert gemini.image('Draw a cell')[1]==buffer.getvalue()
    monkeypatch.setattr(gemini.httpx,'Client',lambda **kw:real_client(transport=transport(b'\x89PNG\r\n\x1a\ncorrupt')))
    with pytest.raises(RuntimeError,match='no valid study image'):
        gemini.image('Draw a cell')

def test_settings_reject_string_booleans(client):
    state = signup(client)
    r = client.post('/api/workspace', json={'action':'profile','profile':{**state['profile'],'discoverable':'false'}})
    assert r.status_code == 400
    assert client.get('/api/workspace').json()['profile']['discoverable'] == 0

def test_task_reminders_are_persistent_deduplicated_and_opt_in(client):
    state = signup(client)
    x = plan_input()
    saved = action(client,'savePlan',input=x,tasks=action(client,'preview',input=x,mode='rules')['tasks'])
    with database() as db:
        db.execute("UPDATE tasks SET date='2020-01-01' WHERE user_id=?",(state['user']['id'],))
    first = client.get('/api/workspace').json()
    assert len([n for n in first['notifications'] if n['kind']=='task']) == 2
    assert client.get('/api/workspace').json()['unreadNotifications'] == first['unreadNotifications']
    action(client,'profile',profile={**saved['profile'],'reminders':False})
    action(client,'readNotifications',all=True)
    assert client.get('/api/workspace').json()['unreadNotifications'] == 0
