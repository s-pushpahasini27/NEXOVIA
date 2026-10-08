# Moving an existing Nexovia database

The Python edition preserves the source application's SQLite schema. This download intentionally includes **no live account database, passwords, session cookies, or uploaded personal files**.

## From an authorized hosted export

Obtain a D1 SQL export of the Nexovia database and download the associated file objects from its R2 bucket using the hosting account's export tools. A deployed webpage is not a database export. This conversion has not performed that export.

1. Stop the Python server.
2. Back up any existing local `data` folder.
3. Run the import helper against a trusted SQLite/D1 SQL dump:

```powershell
.\.venv\Scripts\python.exe tools\import_sql.py C:\path\to\nexovia-export.sql
```

The helper refuses to replace an existing database. It imports into a temporary database, verifies the expected tables/columns, removes the old authentication sessions, and only then installs the database. Do not import SQL from an untrusted source: a SQL dump is executable database code.

4. Copy uploaded objects into `data/uploads/`, keeping each original `file_key` path (usually `<user-id>/<file-id>`). SQL alone does not contain file bytes.
5. Start the server. Log in with an existing Nexovia email/password account. Google-only accounts require the Google OAuth credentials for this deployment.

Records created before the hosted app had its own accounts may be linked only to an old platform user ID. Those records need an explicit account-to-user mapping during a separate migration; the Python app does not automatically claim records by name or email. Google identities and existing auth_accounts preserve their stored IDs. Sessions are intentionally invalidated on import, so users sign in again.

Import is an administrative operation. Do not expose the import helper as a web endpoint. The helper has only been tested using a generated dump of the preserved schema, not a real hosted export.
