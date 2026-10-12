ALTER TABLE tutor_messages ADD COLUMN visual TEXT;
CREATE TABLE study_visuals (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
 mime TEXT NOT NULL, file_key TEXT NOT NULL, created TEXT NOT NULL
);
CREATE INDEX study_visuals_owner ON study_visuals(user_id);
