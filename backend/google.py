"""Google OpenID Connect: authorization code + PKCE, verified ID tokens."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from urllib.parse import urlencode, urlparse
import httpx
import jwt
from fastapi.responses import RedirectResponse
from .auth import issue_session, session_user, secure, validate_email
from .db import one, insert, uid, now

FLOW_COOKIE = 'nexovia_google_flow'
JWKS = jwt.PyJWKClient('https://www.googleapis.com/oauth2/v3/certs', timeout=10)

def config():
    return tuple(os.getenv(k, '').strip() for k in ('GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_URI'))

def enabled():
    client_id, secret, redirect = config()
    p = urlparse(redirect)
    local = p.scheme == 'http' and p.hostname in ('localhost', '127.0.0.1')
    return bool(client_id and secret and (p.scheme == 'https' or local) and p.path == '/api/auth/google/callback' and not p.query and not p.fragment)

def b64(value):
    return base64.urlsafe_b64encode(value).rstrip(b'=').decode()

def sign_flow(payload, secret):
    value = b64(json.dumps(payload, separators=(',', ':')).encode())
    return value + '.' + b64(hmac.new(secret.encode(), value.encode(), hashlib.sha256).digest())

def read_flow(value, secret):
    body, signature = value.split('.')
    expected = b64(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(signature, expected):
        raise ValueError('Invalid Google sign-in flow.')
    data = json.loads(base64.urlsafe_b64decode(body + '=' * (-len(body) % 4)))
    if not 0 <= time.time() - data['created'] <= 600:
        raise ValueError('Google sign-in expired. Please try again.')
    return data

def start(db, request):
    if not enabled():
        return RedirectResponse('/login?' + urlencode({'google_error': 'Google sign-in has not been configured yet.'}), status_code=303)
    client_id, secret, redirect = config()
    intent = 'link' if request.query_params.get('intent') == 'link' else 'login'
    user = session_user(db, request, required=intent == 'link')
    flow = dict(state=secrets.token_urlsafe(32), nonce=secrets.token_urlsafe(32), verifier=secrets.token_urlsafe(32), intent=intent, userId=user['userId'] if intent == 'link' else None, created=int(time.time()))
    query = dict(client_id=client_id, redirect_uri=redirect, response_type='code', scope='openid email profile', state=flow['state'], nonce=flow['nonce'], code_challenge=b64(hashlib.sha256(flow['verifier'].encode()).digest()), code_challenge_method='S256', prompt='select_account')
    response = RedirectResponse('https://accounts.google.com/o/oauth2/v2/auth?' + urlencode(query), status_code=303)
    response.set_cookie(FLOW_COOKIE, sign_flow(flow, secret), max_age=600, httponly=True, secure=secure(), samesite='lax', path='/api/auth/google')
    return response

def exchange(code, verifier):
    client_id, secret, redirect = config()
    with httpx.Client(timeout=15) as client:
        response = client.post('https://oauth2.googleapis.com/token', data=dict(code=code, client_id=client_id, client_secret=secret, redirect_uri=redirect, code_verifier=verifier, grant_type='authorization_code'))
        response.raise_for_status()
        token = response.json()['id_token']
    key = JWKS.get_signing_key_from_jwt(token)
    claims = jwt.decode(token, key.key, algorithms=['RS256'], audience=client_id, issuer=['https://accounts.google.com', 'accounts.google.com'], options={'require': ['exp', 'iat', 'iss', 'aud', 'sub', 'nonce', 'email', 'email_verified']}, leeway=30)
    if claims.get('azp') and claims['azp'] != client_id:
        raise ValueError('Invalid Google audience.')
    return claims

def callback(db, request):
    try:
        if not enabled():
            raise ValueError('Google sign-in is not configured.')
        flow = read_flow(request.cookies.get(FLOW_COOKIE, ''), config()[1])
        if not hmac.compare_digest(request.query_params.get('state', ''), flow['state']):
            raise ValueError('Google sign-in could not be verified. Please try again.')
        if request.query_params.get('error') or not request.query_params.get('code'):
            raise ValueError('Google sign-in was cancelled. Please try again.')
        claims = exchange(request.query_params['code'], flow['verifier'])
        if not hmac.compare_digest(str(claims.get('nonce', '')), flow['nonce']) or claims.get('email_verified') is not True:
            raise ValueError('Google did not verify this email. Please try another account.')
        subject = claims.get('sub', '')
        if not isinstance(subject, str) or not 1 <= len(subject) <= 255 or not subject.isascii():
            raise ValueError('Invalid Google account.')
        email = validate_email(claims['email'])
        identity = one(db, 'SELECT user_id FROM google_identities WHERE sub=?', subject)
        account = one(db, 'SELECT * FROM auth_accounts WHERE email=?', email)
        if flow['intent'] == 'link':
            user = session_user(db, request, required=True)
            if user['userId'] != flow['userId'] or user['email'] != email:
                raise ValueError('Choose the Google account with the same email as your Nexovia account.')
            if identity and identity['user_id'] != user['userId']:
                raise ValueError('This Google account is already connected.')
            user_id, target = user['userId'], '/workspace#Settings'
        elif identity:
            account = one(db, 'SELECT * FROM auth_accounts WHERE id=?', identity['user_id'])
            if not account:
                raise ValueError('Account unavailable.')
            user_id = account['id']
            target = '/workspace' if account['profile_complete'] else '/onboarding'
        elif account:
            domain = email.rsplit('@', 1)[1]
            if domain not in ('gmail.com', 'googlemail.com') and claims.get('hd') != domain:
                raise ValueError('Log in with your password, then connect Google from Settings.')
            user_id = account['id']
            target = '/workspace' if account['profile_complete'] else '/onboarding'
        else:
            user_id, target = uid(), '/onboarding'
            insert(db, 'auth_accounts', id=user_id, email=email, password_hash='google-only', profile_complete=0, created=int(time.time() * 1000))
            insert(db, 'profiles', id=user_id, name=str(claims.get('name') or email.split('@')[0])[:100], created=now())
        if not identity:
            insert(db, 'google_identities', sub=subject, user_id=user_id, created=int(time.time() * 1000))
        response = issue_session(db, request, RedirectResponse(target, status_code=303), user_id)
    except Exception as exc:
        db.rollback()
        message = str(exc) if isinstance(exc, ValueError) and not isinstance(exc, jwt.PyJWTError) else 'Google sign-in could not be completed. Please try again.'
        response = RedirectResponse('/login?' + urlencode({'google_error': message[:220]}), status_code=303)
    response.delete_cookie(FLOW_COOKIE, path='/api/auth/google', secure=secure(), httponly=True, samesite='lax')
    return response
