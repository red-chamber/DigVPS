CREATE TABLE IF NOT EXISTS site_access (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	paused INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0, 1)),
	updated_by TEXT,
	updated_at INTEGER NOT NULL,
	FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO site_access (id, paused, updated_by, updated_at)
VALUES (1, 0, NULL, unixepoch());
