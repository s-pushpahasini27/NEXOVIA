from datetime import datetime, timedelta, timezone
from io import BytesIO
from PIL import Image
from starlette.testclient import TestClient
from backend.main import app
from backend.db import database, one
from backend import profile_photos
from test_app import ORIGIN, signup, action, client


def image_bytes():
    output = BytesIO()
    Image.new('RGB', (20, 20), 'blue').save(output, format='PNG')
    return output.getvalue()


def test_profile_picture_upload_visibility_and_google_preference(client, monkeypatch):
    alice = signup(client)
    user_id = alice['user']['id']
    assert client.post('/api/profile-picture', files={'file':('fake.png', b'bad', 'image/png')}).status_code == 400
    assert client.post('/api/profile-picture', files={'file':('large.png',b'a'*(2*1024*1024+1),'image/png')}).status_code == 400
    response = client.post('/api/profile-picture', files={'file':('avatar.png',image_bytes(),'image/png')})
    assert response.status_code == 200, response.text
    assert client.get('/api/profile-picture/'+user_id).headers['content-type'] == 'image/webp'
    with TestClient(app,base_url=ORIGIN,headers={'Origin':ORIGIN}) as other:
        bob = signup(other,'bob-photo@example.com','Bob')
        assert other.get('/api/profile-picture/'+user_id).status_code == 404
        action(client,'profile',profile={**alice['profile'],'discoverable':True})
        assert other.get('/api/profile-picture/'+user_id).status_code == 200
        assert any(p['avatar_source']=='upload' for p in other.get('/api/workspace').json()['peers'])
        with database() as db:
            profile_photos.google(db,user_id,'https://evil.example/avatar.png')
            assert one(db,'SELECT avatar_source FROM profiles WHERE id=?',user_id)['avatar_source']=='upload'


def test_onboarding_picture_persists_before_profile_completion(client):
    from test_app import PASSWORD, OTP_CODES
    r=client.post('/api/auth',json={'action':'signup','email':'picture@example.com','password':PASSWORD,'confirmPassword':PASSWORD})
    assert r.status_code==202
    assert client.post('/api/auth',json={'action':'verifyEmail','code':OTP_CODES['picture@example.com']}).status_code==201
    session=client.get('/api/auth/session').json()
    user_id=session['user']['userId']
    assert client.get('/api/workspace').status_code==403
    assert client.post('/api/profile-picture',files={'file':('avatar.png',image_bytes(),'image/png')}).status_code==200
    assert client.get('/api/profile-picture/'+user_id).status_code==200
    client.post('/api/auth',json={'action':'profile','name':'Picture User','goal':'600','subjects':'Python, Data Structures'})
    assert client.get('/api/workspace').json()['profile']['avatar_source']=='upload'


def test_call_history_both_participants_and_duration(client):
    alice=signup(client)
    with TestClient(app,base_url=ORIGIN,headers={'Origin':ORIGIN}) as other:
        bob=signup(other,'bob-calls@example.com','Bob')
        action(other,'profile',profile={**bob['profile'],'discoverable':True})
        connection=action(client,'connect',id=bob['user']['id'])['connections'][0]
        action(other,'accept',id=connection['id'])
        for media in ('audio','video'):
            started=client.post('/api/calls',json={'action':'start','peer':bob['user']['id'],'media':media,'offer':{'type':'offer','sdp':'offer'}})
            assert started.status_code==200,started.text
            call_id=started.json()['call']['id']
            for c in (client,other):
                events=[m for m in c.get('/api/workspace').json()['messages'] if m['call_id']==call_id]
                assert len(events)==1 and events[0]['event_type']=='call_started' and events[0]['call_media']==media
            assert other.post('/api/calls',json={'action':'answer','callId':call_id,'answer':{'type':'answer','sdp':'answer'}}).status_code==200
            with database() as db:
                earlier=(datetime.now(timezone.utc)-timedelta(seconds=65)).isoformat(timespec='milliseconds').replace('+00:00','Z')
                db.execute('UPDATE call_sessions SET answered_at=? WHERE id=?',(earlier,call_id))
            assert other.post('/api/calls',json={'action':'end','callId':call_id}).status_code==200
            assert client.post('/api/calls',json={'action':'end','callId':call_id}).status_code==200
            for c in (client,other):
                events=[m for m in c.get('/api/workspace').json()['messages'] if m['call_id']==call_id]
                assert [m['event_type'] for m in events]==['call_started','call_ended']
                assert events[-1]['call_media']==media and events[-1]['call_duration']>=64
                assert events[-1]['sender']==alice['user']['id'] and events[-1]['recipient']==bob['user']['id']
