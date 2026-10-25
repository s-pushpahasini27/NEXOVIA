CREATE TABLE ai_usage_limits (
 scope TEXT NOT NULL,
 "window" INTEGER NOT NULL,
 used INTEGER NOT NULL,
 PRIMARY KEY(scope,"window")
);
