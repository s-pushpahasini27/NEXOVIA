ALTER TABLE tutor_messages ADD COLUMN provider TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE tutor_messages ADD COLUMN sources TEXT NOT NULL DEFAULT '[]';
CREATE TABLE resource_chunks (
 id INTEGER PRIMARY KEY,
 resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL,
 ordinal INTEGER NOT NULL,
 content TEXT NOT NULL,
 UNIQUE(resource_id, ordinal)
);
CREATE INDEX resource_chunks_owner ON resource_chunks(user_id, resource_id);
CREATE VIRTUAL TABLE resource_search USING fts5(content, content='resource_chunks', content_rowid='id');
CREATE TRIGGER resource_chunks_insert AFTER INSERT ON resource_chunks BEGIN
 INSERT INTO resource_search(rowid,content) VALUES(new.id,new.content);
END;
CREATE TRIGGER resource_chunks_delete AFTER DELETE ON resource_chunks BEGIN
 INSERT INTO resource_search(resource_search,rowid,content) VALUES('delete',old.id,old.content);
END;
CREATE TABLE card_schedule (
 user_id TEXT NOT NULL,
 deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
 card INTEGER NOT NULL,
 interval_days REAL NOT NULL DEFAULT 0,
 repetitions INTEGER NOT NULL DEFAULT 0,
 due TEXT NOT NULL,
 PRIMARY KEY(user_id,deck_id,card)
);
CREATE INDEX card_schedule_due ON card_schedule(user_id,due);
