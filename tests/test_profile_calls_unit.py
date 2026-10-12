from datetime import datetime, timedelta, timezone
from io import BytesIO
from PIL import Image
from backend.db import database, initialize, one, rows, insert, now, uid
from backend import call_history, profile_photos


def test_call_events_are_shared_ordered_and_once(tmp_path,monkeypatch):
    monkeypatch.setenv('NEXOVIA_DATA_DIR',str(tmp_path))
    initialize()
    with database() as db:
        a,b=uid(),uid()
        for user,name in ((a,'Alice'),(b,'Bob')):
            insert(db,'profiles',id=user,name=name,created=now())
        call={'id':uid(),'caller':a,'callee':b,'status':'active','media':'audio','created':now(),
              'answered_at':(datetime.now(timezone.utc)-timedelta(seconds=65)).isoformat(timespec='milliseconds').replace('+00:00','Z')}
        call_history.started(db,call)
        insert(db,'call_sessions',id=call['id'],caller=a,callee=b,status='active',media='audio',
               offer='{}',answer='{}',created=call['created'],updated=now(),answered_at=call['answered_at'])
        call_history.finish(db,call,'ended')
        call_history.finish(db,{**call,'status':'ended'},'ended')
        for user in (a,b):
            events=rows(db,'SELECT * FROM messages WHERE (sender=? OR recipient=?) AND call_id=? ORDER BY created',user,user,call['id'])
            assert [event['event_type'] for event in events]==['call_started','call_ended']
            assert events[-1]['call_duration']>=64
            assert events[-1]['call_media']=='audio'


def test_picture_is_sanitized_and_persisted(tmp_path,monkeypatch):
    monkeypatch.setenv('NEXOVIA_DATA_DIR',str(tmp_path))
    initialize()
    with database() as db:
        user=uid()
        insert(db,'profiles',id=user,name='Alice',created=now())
        output=BytesIO()
        Image.new('RGB',(20,20),'blue').save(output,'PNG')
        profile_photos.save(db,user,output.getvalue())
        image_path=profile_photos.path(user)
        assert image_path.is_file()
        with Image.open(image_path) as image:
            assert image.format=='WEBP'
        assert one(db,'SELECT avatar_source FROM profiles WHERE id=?',user)['avatar_source']=='upload'
        try:
            profile_photos.save(db,user,b'not-an-image')
        except ValueError:
            pass
        else:
            raise AssertionError('Invalid image was accepted')
        assert image_path.is_file()


def test_google_picture_copies_verified_host_only(tmp_path,monkeypatch):
    monkeypatch.setenv('NEXOVIA_DATA_DIR',str(tmp_path))
    initialize()
    output=BytesIO()
    Image.new('RGB',(16,16),'green').save(output,'PNG')
    class Response:
        headers={'content-type':'image/png'}
        content=output.getvalue()
        def raise_for_status(self): pass
    visited=[]
    def fake_get(url,**kwargs):
        visited.append(url)
        return Response()
    monkeypatch.setattr(profile_photos.httpx,'get',fake_get)
    with database() as db:
        user=uid()
        insert(db,'profiles',id=user,name='Google learner',created=now())
        profile_photos.google(db,user,'https://evil.example/test.png')
        assert not visited
        profile_photos.google(db,user,'https://lh3.googleusercontent.com/avatar')
        assert len(visited)==1
        assert one(db,'SELECT avatar_source FROM profiles WHERE id=?',user)['avatar_source']=='google'


def test_new_migration_preserves_existing_profile_and_chat(tmp_path,monkeypatch):
    import sqlite3
    from backend.db import ROOT
    monkeypatch.setenv('NEXOVIA_DATA_DIR',str(tmp_path))
    path=tmp_path/'nexovia.sqlite3'
    migration_dir=ROOT/'backend'/'migrations'
    with sqlite3.connect(path) as db:
        db.execute('CREATE TABLE schema_migrations (name TEXT PRIMARY KEY)')
        for migration in sorted(migration_dir.glob('*.sql')):
            if migration.name.startswith('0012_'):
                continue
            db.executescript(migration.read_text().replace('--> statement-breakpoint',''))
            db.execute('INSERT INTO schema_migrations VALUES (?)',(migration.name,))
        db.execute("INSERT INTO profiles(id,name,created) VALUES ('old','Existing learner','2026-01-01')")
        db.execute("INSERT INTO messages(id,sender,recipient,body,created) VALUES ('old-message','old','peer','Preserved','2026-01-01')")
    initialize()
    with database() as db:
        assert one(db,'SELECT name,avatar_source FROM profiles WHERE id=?','old')['name']=='Existing learner'
        assert one(db,'SELECT body,event_type FROM messages WHERE id=?','old-message')['body']=='Preserved'


def test_adaptive_plan_respects_toggle_with_logged_pace():
    from backend.study import schedule, today, add_days
    data={'start':add_days(today(),1),'days':1,'weekday':120,'weekend':120,
          'session':40,'startTime':'09:15','adaptive':True,
          'subjects':[{'name':'Python','topics':'Functions','priority':'medium',
                       'difficulty':'medium','deadline':'','weak':False}]}
    enabled=schedule(data,actual_session=25)
    disabled=schedule({**data,'adaptive':False},actual_session=25)
    assert enabled['tasks'][0]['duration']==25
    assert disabled['tasks'][0]['duration']==40
    assert enabled['tasks'][0]['time']=='09:15'
    assert schedule(data,actual_session=None)['tasks'][0]['duration']==40
