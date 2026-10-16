PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS deleted_static_notes (
    note_key TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    tags_json TEXT NOT NULL DEFAULT '[]',
    deleted_by TEXT,
    deleted_at INTEGER NOT NULL,
    FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS deleted_static_notes_deleted_at
    ON deleted_static_notes(deleted_at DESC);
