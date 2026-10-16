PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS published_notes (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    markdown TEXT NOT NULL,
    rendered_html TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    tags_json TEXT NOT NULL DEFAULT '[]',
    author_id TEXT,
    status TEXT NOT NULL DEFAULT 'published'
        CHECK (status IN ('published', 'archived')),
    published_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS published_notes_status_published
    ON published_notes(status, published_at DESC);

CREATE TABLE IF NOT EXISTS note_comments (
    id TEXT PRIMARY KEY,
    note_key TEXT NOT NULL,
    note_title TEXT NOT NULL,
    user_id TEXT,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at INTEGER NOT NULL,
    moderated_at INTEGER,
    moderated_by TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (moderated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS note_comments_note_status_created
    ON note_comments(note_key, status, created_at ASC);

CREATE INDEX IF NOT EXISTS note_comments_user_created
    ON note_comments(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS note_comments_status_created
    ON note_comments(status, created_at ASC);

CREATE TABLE IF NOT EXISTS note_likes (
    note_key TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (note_key, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS note_likes_note_created
    ON note_likes(note_key, created_at DESC);
