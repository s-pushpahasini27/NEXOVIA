"""Browser-bound, one-use email OTP challenges with expiry and persisted limits."""
import hashlib
import hmac
import os
import re
import secrets
import time
from .web import HTTPException, JSONResponse
from .db import data_dir, one, insert, uid, now, cloud_database
from . import mailer

COOKIE = 'nexovia_email_challenge'

def _hash(value):
    return hashlib.sha256(value.encode()).hexdigest()

def _secret():
    value = os.getenv('AUTH_OTP_SECRET','').strip()
    if value:
        if len(value)<32:
            raise RuntimeError('AUTH_OTP_SECRET must contain at least 32 characters.')
        return value.encode()
    if cloud_database():
        raise RuntimeError('Set AUTH_OTP_SECRET in the Vercel project environment before enabling email verification.')
    path = data_dir()/'secrets'/'otp.key'
    path.parent.mkdir(parents=True,exist_ok=True)
    try:
        fd = os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'wb') as file:
            file.write(secrets.token_bytes(32))
    except FileExistsError:
        pass
    key = path.read_bytes()
    if len(key)!=32:
        raise RuntimeError('The OTP signing key is invalid. Restore the server key.')
    return key

def code_hash(challenge,code):
    return hmac.new(_secret(),(challenge+':'+code).encode(),hashlib.sha256).hexdigest()

def begin(db,request,email,password_hash,user_id=None):
    from .auth import secure
    stamp = int(time.time())
    db.execute('BEGIN IMMEDIATE')
    previous = one(db,'SELECT sent FROM email_challenges WHERE email=?',email)
    if previous and stamp-previous['sent']<60:
        raise HTTPException(429,'Wait 60 seconds before requesting another verification email.')
    token, code = secrets.token_urlsafe(32), f'{secrets.randbelow(1000000):06d}'
    signature = code_hash(token,code)
    # SMTP failure prevents any account or session creation. No console-code mode exists.
    mailer.send_otp(email,code)
    db.execute('DELETE FROM email_challenges WHERE expires<? OR email=?',(stamp,email))
    insert(db,'email_challenges',email=email,challenge_hash=_hash(token),user_id=user_id,password_hash=password_hash,
           code_hash=signature,attempts=0,expires=stamp+600,created=stamp,sent=stamp)
    response = JSONResponse({'requiresVerification':True,'email':email,'expiresIn':600,'resendAfter':60},status_code=202)
    response.set_cookie(COOKIE,token,max_age=600,httponly=True,secure=secure(),samesite='strict',path='/api/auth')
    return response

def challenge(db,request):
    token = request.cookies.get(COOKIE,'')
    pending = one(db,'SELECT * FROM email_challenges WHERE challenge_hash=?',_hash(token)) if token else None
    if not pending or pending['expires']<=int(time.time()) or pending['attempts']>=5:
        raise ValueError('Verification expired or exhausted. Sign up or log in again to request a new code.')
    return token,pending

def resend(db,request):
    from .auth import limit_auth
    token,pending = challenge(db,request)
    limit_auth(db,request,pending['email'])
    return begin(db,request,pending['email'],pending['password_hash'],pending['user_id'])

def verify(db,request,code):
    from .auth import issue_session, secure
    # Serialize verification so concurrent requests cannot consume one code twice.
    db.execute('BEGIN IMMEDIATE')
    token,pending = challenge(db,request)
    if not isinstance(code,str) or not re.fullmatch(r'\d{6}',code,re.ASCII):
        raise ValueError('Enter the six-digit code from your email.')
    if not hmac.compare_digest(code_hash(token,code),pending['code_hash']):
        db.execute('UPDATE email_challenges SET attempts=attempts+1 WHERE email=?',(pending['email'],))
        db.commit()
        raise ValueError('The verification code is incorrect.')
    account = one(db,'SELECT * FROM auth_accounts WHERE email=?',pending['email'])
    if pending['user_id']:
        if not account or account['id']!=pending['user_id']:
            raise ValueError('Account unavailable. Log in again.')
        user_id,target = account['id'],'/workspace' if account['profile_complete'] else '/onboarding'
        db.execute('UPDATE auth_accounts SET email_verified=1 WHERE id=?',(user_id,))
    else:
        if account:
            raise ValueError('An account already exists. Log in instead.')
        user_id,target = uid(),'/onboarding'
        insert(db,'auth_accounts',id=user_id,email=pending['email'],password_hash=pending['password_hash'],profile_complete=0,created=int(time.time()*1000),email_verified=1)
        insert(db,'profiles',id=user_id,name=pending['email'].split('@')[0],created=now())
    db.execute('DELETE FROM email_challenges WHERE email=?',(pending['email'],))
    response = issue_session(db,request,JSONResponse({'redirect':target},status_code=201 if not account else 200),user_id)
    response.delete_cookie(COOKIE,path='/api/auth',httponly=True,secure=secure(),samesite='strict')
    return response
