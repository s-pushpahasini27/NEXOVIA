"""SMTP transport: never return or log verification codes."""
import os
import smtplib
import ssl
from email.message import EmailMessage

def configured():
    return bool(os.getenv('SMTP_HOST','').strip() and os.getenv('SMTP_FROM','').strip())

def send_otp(email, code):
    if not configured():
        raise RuntimeError('Email verification is unavailable. Configure SMTP_HOST and SMTP_FROM with your email provider credentials.')
    host = os.getenv('SMTP_HOST','').strip()
    mode = os.getenv('SMTP_TLS_MODE','starttls').strip().lower()
    if mode not in ('starttls','ssl','local') or (mode=='local' and host not in ('127.0.0.1','localhost','::1')):
        raise RuntimeError('SMTP requires STARTTLS or SSL. Plaintext is permitted only for a local test mail server.')
    port = int(os.getenv('SMTP_PORT','465' if mode=='ssl' else '587'))
    message = EmailMessage()
    message['Subject'] = 'Verify your Nexovia email'
    message['From'] = os.getenv('SMTP_FROM').strip()
    message['To'] = email
    message.set_content(f'Your Nexovia verification code is: {code}\n\nIt expires in 10 minutes. Do not share this code. If you did not request it, ignore this email.')
    try:
        context = ssl.create_default_context()
        transport = smtplib.SMTP_SSL(host,port,timeout=15,context=context) if mode=='ssl' else smtplib.SMTP(host,port,timeout=15)
        with transport as smtp:
            smtp.ehlo()
            if mode=='starttls':
                smtp.starttls(context=context)
                smtp.ehlo()
            username = os.getenv('SMTP_USERNAME','').strip()
            if username:
                smtp.login(username,os.getenv('SMTP_PASSWORD',''))
            refused = smtp.send_message(message)
            if refused:
                raise RuntimeError('The email provider refused delivery. Check the recipient or provider configuration.')
    except (smtplib.SMTPException,OSError) as exc:
        raise RuntimeError('Verification email could not be sent. Check your email provider configuration and try again.') from exc
