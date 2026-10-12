"""Exercise a real local HTTP server backed by an isolated test database."""
import argparse
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from uuid import uuid4
from datetime import date, timedelta
import httpx

def run(base, code_reader=None):
    password = 'nexovia isolated smoke password'
    clients = [httpx.Client(base_url=base,headers={'Origin':base},trust_env=False,timeout=15) for _ in range(2)]
    def action(client, name, **data):
        response = client.post('/api/workspace',json={'action':name,**data})
        assert response.status_code == 200, response.text
        return response.json()
    try:
        alice,bob = clients
        states = []
        for i,c in enumerate(clients):
            email=f'smoke-{uuid4()}@example.com'
            response = c.post('/api/auth',json={'action':'signup','email':email,'password':password,'confirmPassword':password})
            assert response.status_code == 202,response.text
            assert c.get('/api/workspace').status_code==401
            code=code_reader(email) if code_reader else input(f'Verification code for {email}: ').strip()
            response=c.post('/api/auth',json={'action':'verifyEmail','code':code})
            assert response.status_code == 201,response.text
            assert c.post('/api/auth',json={'action':'profile','name':f'Smoke learner {i}','goal':'600','subjects':'Python'}).status_code == 200
            state = c.get('/api/workspace').json()
            states.append(action(c,'profile',profile={**state['profile'],'discoverable':True}))
        tomorrow = (date.today()+timedelta(days=1)).isoformat()
        settings = dict(title='Smoke plan',start=tomorrow,days=2,weekday=120,weekend=120,session=30,startTime='10:00',adaptive=False,subjects=[dict(name='Python',topics='Lists',priority='high',difficulty='medium',deadline='',weak=False)])
        preview = action(alice,'preview',mode='rules',input=settings)
        plan = action(alice,'savePlan',input=settings,tasks=preview['tasks'])
        task = plan['tasks'][0]
        assert action(alice,'logSession',taskId=task['id'],minutes=20,complete=True)['sessions'][0]['minutes']==20
        resource = alice.post('/api/files',files={'file':('smoke.txt',b'Python lists are mutable.','text/plain')}).json()['resource']
        assert alice.get(resource['url']).status_code == 200
        assert bob.get(resource['url']).status_code == 404
        action(alice,'deleteResource',id=resource['id'])
        assert alice.get(resource['url']).status_code == 404
        action(alice,'restoreResource',id=resource['id'])
        assert alice.get(resource['url']).status_code == 200
        deck = action(alice,'deck',title='Smoke deck',notes='Are lists mutable? :: Yes')['decks'][0]
        assert action(alice,'review',id=deck['id'],card=0,rating='good')['decks'][0]['dueCards']==[]
        connection = action(alice,'connect',id=states[1]['user']['id'])['connections'][0]
        action(bob,'accept',id=connection['id'])
        message = 'Isolated local smoke message'
        action(alice,'message',id=states[1]['user']['id'],body=message)
        assert bob.get('/api/workspace').json()['messages'][-1]['body']==message
        assert action(bob,'readNotifications',all=True)['unreadNotifications']==0
        assert alice.get('/api/calls/config').status_code==200
        call=alice.post('/api/calls',json={'action':'start','peer':states[1]['user']['id'],'media':'audio','offer':{'type':'offer','sdp':'smoke-offer'}}).json()['call']
        assert bob.get('/api/calls').json()['call']['media']=='audio'
        assert bob.post('/api/calls',json={'action':'answer','callId':call['id'],'answer':{'type':'answer','sdp':'smoke-answer'}}).status_code==200
        assert alice.get('/api/calls').json()['call']['answer']['sdp']=='smoke-answer'
        assert alice.post('/api/calls',json={'action':'end','callId':call['id']}).status_code==200
        assert bob.get('/api/calls').json()['call'] is None
        video=alice.post('/api/calls',json={'action':'start','peer':states[1]['user']['id'],'media':'video','offer':{'type':'offer','sdp':'smoke-video-offer'}}).json()['call']
        assert video['media']=='video'
        assert bob.post('/api/calls',json={'action':'answer','callId':video['id'],'answer':{'type':'answer','sdp':'smoke-video-answer'}}).status_code==200
        assert alice.post('/api/calls',json={'action':'candidate','callId':video['id'],'candidate':{'candidate':'candidate:smoke'}}).status_code==200
        assert bob.get('/api/calls').json()['call']['candidates'][0]['candidate']['candidate']=='candidate:smoke'
        assert bob.post('/api/calls',json={'action':'end','callId':video['id']}).status_code==200
        for route in ['/','/workspace','/signup','/login']:
            assert alice.get(route).status_code==200
        assert alice.post('/api/workspace',json={'action':'tutor','question':'Explain Python'}).status_code == 503
        print('PASS: real HTTP + loopback SMTP OTP signup, onboarding, planning, session, upload, isolation, trash/restore, reviews, community messaging, notifications, audio/video-call signaling and candidate exchange, static routes and missing-AI error. Media transmission and real email inbox delivery are not verified.')
    finally:
        for client in clients:
            client.close()

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url',default='http://127.0.0.1:8765')
    parser.add_argument('--isolated-test-server',action='store_true')
    parser.add_argument('--start-isolated',action='store_true')
    args=parser.parse_args()
    if not args.base_url.startswith('http://127.0.0.1:'):
        parser.error('Only a dedicated loopback test server is supported.')
    if args.start_isolated:
        from smtp_sink import Sink
        with tempfile.TemporaryDirectory(prefix='nexovia-http-') as data, Sink() as mail:
            base = args.base_url.rstrip('/')
            port = base.rsplit(':',1)[-1]
            env = {**os.environ,'NEXOVIA_DATA_DIR':data,'APP_ORIGIN':base,'ALLOW_LOCAL_DEV':'false','GEMINI_API_KEY':'','GOOGLE_OAUTH_CLIENT_ID':'','GOOGLE_OAUTH_CLIENT_SECRET':'','SMTP_HOST':'127.0.0.1','SMTP_PORT':str(mail.port),'SMTP_TLS_MODE':'local','SMTP_FROM':'noreply@nexovia.test','SMTP_USERNAME':'','SMTP_PASSWORD':''}
            server = subprocess.Popen([sys.executable,'-m','uvicorn','backend.main:app','--host','127.0.0.1','--port',port],cwd=Path(__file__).resolve().parents[1],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            try:
                with httpx.Client(trust_env=False,timeout=1) as probe:
                    for _ in range(100):
                        if server.poll() is not None:
                            raise RuntimeError('The isolated server did not start.')
                        try:
                            if probe.get(base+'/api/health').status_code==200:
                                break
                        except httpx.HTTPError:
                            pass
                        time.sleep(.1)
                    else:
                        raise RuntimeError('The isolated server did not become ready.')
                run(base,lambda email:mail.codes[email])
            finally:
                server.terminate()
                try:
                    server.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait()
    elif args.isolated_test_server:
        run(args.base_url.rstrip('/'))
    else:
        parser.error('Use --start-isolated, or acknowledge an existing dedicated server with --isolated-test-server.')
