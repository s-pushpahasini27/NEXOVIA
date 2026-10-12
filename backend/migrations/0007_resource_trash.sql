ALTER TABLE resources ADD COLUMN deleted_at TEXT;
CREATE INDEX resources_visible ON resources(user_id,deleted_at);
