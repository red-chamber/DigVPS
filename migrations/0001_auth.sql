PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    username TEXT UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER,
    created_at INTEGER NOT NULL,
    verified_at INTEGER
);

CREATE TABLE IF NOT EXISTS email_verifications (
    user_id TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    sent_at INTEGER NOT NULL,
    request_ip_hash TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS email_verifications_ip_sent
    ON email_verifications(request_ip_hash, sent_at);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);

-- Initial administrator. Change this password after the account system is enabled.
INSERT OR IGNORE INTO users (
    id,
    email,
    username,
    password_hash,
    password_salt,
    email_verified,
    role,
    created_at,
    verified_at
) VALUES (
    'admin_root',
    'autoverification@163.com',
    'root',
    'vEiRzGYsUJflWA6cWwRtg7f5Pv5QfiFnKuL9RiXsSt0',
    'RYzcl7QJPExAFwJ11EEF1Q',
    1,
    'admin',
    unixepoch(),
    unixepoch()
);
