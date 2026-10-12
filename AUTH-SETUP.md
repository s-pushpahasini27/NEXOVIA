# Nexovia email verification setup

Email/password sign-up requires email delivery. Copy `.env.example` to `.env` and configure an existing SMTP provider:

```env
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_TLS_MODE=starttls
SMTP_FROM=Nexovia <your-approved-sender@example.com>
SMTP_USERNAME=your-provider-username
SMTP_PASSWORD=your-provider-password-or-app-password
```

For a provider requiring implicit TLS, use port 465 and `SMTP_TLS_MODE=ssl`. Nexovia does not create a paid mail service. Keep credentials on the Python server. Never add them to React, screenshots, source control, or the ZIP.

Restart the server after configuration. Sign up with an email you own, read the six-digit code in that inbox, and submit it in the verification form. Complete your profile only after verification succeeds. A missing or failing SMTP provider prevents sign-up; there is no printed-code or verification-bypass mode.

## Security behavior

- A new account and session are created only after verification.
- Codes expire in ten minutes; five incorrect codes exhaust a challenge.
- Challenges are tied to an HttpOnly browser cookie and can be used once.
- A resend requires a sixty-second wait, rotates the browser token, and invalidates the previous challenge.
- Existing authentication rate limits also apply to sending/resending codes.
- OTP hashes use a private server key. Set `AUTH_OTP_SECRET` to a long random value of at least 32 characters, or preserve the automatically generated `data/secrets/otp.key`.
- Passwords keep the existing scrypt format. Sessions are HttpOnly and Secure when `APP_ORIGIN` is HTTPS. Origin checks protect state-changing requests.
- Back up all existing data with the server stopped before updating. The migration preserves accounts, profiles, passwords, plans, and uploaded files. Password users with previously unverified emails must log in and complete verification; their old sessions are revoked. Accounts with an existing verified Google identity remain verified.

## Live checks still required

The automated suite exercises delivery through a loopback SMTP test sink. It does not establish sender-domain approval, real inbox delivery, spam-folder placement, provider quotas, or delivery latency. Test a real inbox and the configured provider before claiming the email flow is verified. Confirm that incorrect, expired, and already-used codes are rejected and that unverified users cannot access the workspace.
