ALTER TABLE call_sessions ADD COLUMN answered_at TEXT;
ALTER TABLE messages ADD COLUMN event_type TEXT;
ALTER TABLE messages ADD COLUMN call_id TEXT;
ALTER TABLE messages ADD COLUMN call_media TEXT;
ALTER TABLE messages ADD COLUMN call_duration INTEGER;
ALTER TABLE messages ADD COLUMN call_status TEXT;
CREATE UNIQUE INDEX idx_messages_call_event ON messages(call_id,event_type) WHERE call_id IS NOT NULL;
ALTER TABLE profiles ADD COLUMN avatar_source TEXT DEFAULT '' NOT NULL;
ALTER TABLE profiles ADD COLUMN avatar_updated TEXT DEFAULT '' NOT NULL;
