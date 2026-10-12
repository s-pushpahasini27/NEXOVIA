ALTER TABLE auth_accounts ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
UPDATE auth_accounts SET email_verified=1 WHERE id IN (SELECT user_id FROM google_identities);
DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM auth_accounts WHERE email_verified=0);
CREATE TABLE email_challenges (
 email TEXT PRIMARY KEY, challenge_hash TEXT UNIQUE NOT NULL,
 user_id TEXT, password_hash TEXT NOT NULL, code_hash TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, expires INTEGER NOT NULL,
 created INTEGER NOT NULL, sent INTEGER NOT NULL
);
CREATE INDEX email_challenges_expiry ON email_challenges(expires);
