import hashlib
import hmac
import os
import re
import secrets
import time
from .web import HTTPException, JSONResponse, RedirectResponse
from .db import one, insert, now, uid
from .study import integer

COOKIE = 'nexovia_session'
LIFETIME = 30 * 86400

def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()

def secure():
    return os.getenv('VERCEL') == '1' or os.getenv('APP_ORIGIN', 'http://127.0.0.1:8000').startswith('https://')

def hash_password(password):
    salt = secrets.token_hex(16)
    key = hashlib.scrypt(password.encode(), salt=salt.encode(), n=32768, r=8, p=3, maxmem=64 * 1024 * 1024, dklen=32)
    return f'scrypt$32768$8$3${salt}${key.hex()}'

def verify_password(password, stored):
    try:
        kind, n, r, p, salt, expected = stored.split('$')
        if kind != 'scrypt' or (int(n), int(r), int(p)) != (32768, 8, 3) or len(password) > 128:
            return False
        key = hashlib.scrypt(password.encode(), salt=salt.encode(), n=int(n), r=int(r), p=int(p), maxmem=64 * 1024 * 1024, dklen=32)
        return hmac.compare_digest(key.hex(), expected)
    except (ValueError, AttributeError):
        return False

def validate_password(password):
    if not isinstance(password, str) or not 12 <= len(password) <= 128:
        raise ValueError('Use a password with 12–128 characters.')
    return password

def validate_email(email):
    if not isinstance(email,str):
        raise ValueError('Enter a valid email address.')
    email = email.strip().lower()
    if len(email)>254 or email.count('@')!=1:
        raise ValueError('Enter a valid email address.')
    local,domain = email.split('@')
    try:
        domain = domain.encode('idna').decode('ascii')
    except UnicodeError:
        raise ValueError('Enter a valid email address.')
    labels = domain.split('.')
    if not 1<=len(local)<=64 or not re.fullmatch(r"[a-z0-9!#$%&'*+/=?^_`{|}~.-]+",local) or local.startswith('.') or local.endswith('.') or '..' in local or len(labels)<2 or not all(re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?',label) for label in labels) or labels[-1].isdigit() or len(domain)>253:
        raise ValueError('Enter a valid email address.')
    normalized = local+'@'+domain
    if len(normalized)>254:
        raise ValueError('Enter a valid email address.')
    return normalized

def session_user(db, request, required=False, complete=False):
    token = request.cookies.get(COOKIE, '')
    user = one(db, '''SELECT a.id AS userId,a.email,a.profile_complete AS profileComplete,
        a.password_hash!='google-only' AS hasPassword,p.name AS fullName
        FROM auth_sessions s JOIN auth_accounts a ON a.id=s.user_id
        LEFT JOIN profiles p ON p.id=a.id WHERE s.token_hash=? AND s.expires>? AND a.email_verified=1''', digest(token), int(time.time() * 1000)) if token else None
    if not user and required:
        raise HTTPException(401, 'Please sign in to save your study workspace.')
    if user and complete and not user['profileComplete']:
        raise HTTPException(403, 'Complete your profile before opening the workspace.')
    return user

def revoke(db, request):
    db.execute('DELETE FROM auth_sessions WHERE token_hash=?', (digest(request.cookies.get(COOKIE, '')),))

def issue_session(db, request, response, user_id):
    revoke(db, request)
    token = secrets.token_urlsafe(32)
    stamp = int(time.time() * 1000)
    insert(db, 'auth_sessions', token_hash=digest(token), user_id=user_id, expires=stamp + LIFETIME * 1000, created=stamp)
    response.set_cookie(COOKIE, token, max_age=LIFETIME, httponly=True, secure=secure(), samesite='lax', path='/')
    return response

def limit_auth(db, request, email):
    stamp = int(time.time() * 1000)
    slot = stamp // 600000
    db.execute('DELETE FROM auth_rate_limits WHERE expires<?', (stamp,))
    db.execute('DELETE FROM auth_sessions WHERE expires<?', (stamp,))
    for scope, value, limit in [('ip', request.client.host if request.client else 'unknown', 30), ('email', email, 10)]:
        key = digest(f'{scope}:{value}:{slot}')
        db.execute('INSERT INTO auth_rate_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1', (key, (slot + 1) * 600000))
        hits = one(db, 'SELECT hits FROM auth_rate_limits WHERE key=?', key)['hits']
        # Persist attempts even when authentication subsequently fails.
        db.commit()
        if hits > limit:
            raise HTTPException(429, 'Too many attempts. Please try again in ten minutes.')

def handle_auth(db, request, b):
    from . import email_verification
    action = b.get('action')
    if action=='verifyEmail':
        return email_verification.verify(db,request,b.get('code'))
    if action=='resendVerification':
        return email_verification.resend(db,request)
    if action == 'logout':
        user = session_user(db,request)
        if user:
            from .call_history import finish
            from .db import rows
            for call in rows(db,"SELECT * FROM call_sessions WHERE status IN ('ringing','active') AND (caller=? OR callee=?)",user['userId'],user['userId']):
                finish(db,call,'ended')
        revoke(db, request)
        response = RedirectResponse('/', status_code=303)
        response.delete_cookie(COOKIE, path='/', secure=secure(), httponly=True, samesite='lax')
        return response
    if action in ('signup', 'login'):
        email = validate_email(b.get('email'))
        password = b.get('password') if isinstance(b.get('password'), str) else ''
        limit_auth(db, request, email)
        account = one(db, 'SELECT * FROM auth_accounts WHERE email=?', email)
        if action == 'signup':
            validate_password(password)
            if password != b.get('confirmPassword'):
                raise ValueError('Your passwords do not match.')
            if account:
                raise ValueError('This email already has a Nexovia account. Log in to continue, or use Continue with Google if it is the same email.')
            return email_verification.begin(db,request,email,hash_password(password))
        dummy = 'scrypt$32768$8$3$' + '0' * 32 + '$' + '0' * 64
        valid = verify_password(password, account['password_hash'] if account and account['password_hash'] != 'google-only' else dummy)
        if not valid or not account:
            raise HTTPException(401, 'The email or password is incorrect.')
        if not account['email_verified']:
            return email_verification.begin(db,request,email,account['password_hash'],account['id'])
        return issue_session(db, request, JSONResponse({'redirect': '/workspace' if account['profile_complete'] else '/onboarding'}), account['id'])
    user = session_user(db, request, required=True)
    if action == 'profile':
        name, bio, subjects = [str(b.get(k) or '').strip() for k in ('name', 'bio', 'subjects')]
        try:
            goal = float(b.get('goal', 0))
        except (ValueError, TypeError):
            goal = 0
        if not name or len(name) > 100:
            raise ValueError('Enter a name up to 100 characters.')
        if len(bio) > 1000 or len(subjects) > 1500:
            raise ValueError('Keep your profile details within the displayed limits.')
        if not integer(goal, 30, 3360):
            raise ValueError('Choose a weekly goal between 30 and 3360 minutes.')
        db.execute('UPDATE profiles SET name=?,bio=?,subjects=?,goal=? WHERE id=?', (name, bio, subjects, int(goal), user['userId']))
        db.execute('UPDATE auth_accounts SET profile_complete=1 WHERE id=?', (user['userId'],))
        return {'redirect': '/workspace'}
    if action == 'password':
        limit_auth(db, request, user['email'])
        password = validate_password(b.get('password'))
        if password != b.get('confirmPassword'):
            raise ValueError('Your passwords do not match.')
        stored = one(db, 'SELECT password_hash FROM auth_accounts WHERE id=?', user['userId'])['password_hash']
        if stored != 'google-only' and not verify_password(b.get('currentPassword', ''), stored):
            raise HTTPException(401, 'Your current password is incorrect.')
        db.execute('UPDATE auth_accounts SET password_hash=? WHERE id=?', (hash_password(password), user['userId']))
        db.execute('DELETE FROM email_challenges WHERE email=?',(user['email'],))
        db.execute('DELETE FROM auth_sessions WHERE user_id=?', (user['userId'],))
        return issue_session(db, request, JSONResponse({'ok': True}), user['userId'])
    raise ValueError('Unknown action.')
