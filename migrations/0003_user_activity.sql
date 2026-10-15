PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    event_type TEXT NOT NULL,
    path TEXT,
    ip_hash TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS user_activities_user_created
    ON user_activities(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_activities_created
    ON user_activities(created_at DESC);

CREATE INDEX IF NOT EXISTS user_activities_event_created
    ON user_activities(event_type, created_at DESC);
