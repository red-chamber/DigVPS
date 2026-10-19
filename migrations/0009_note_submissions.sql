PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS note_submissions (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	title TEXT NOT NULL,
	description TEXT NOT NULL,
	markdown TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'pending'
		CHECK (status IN ('pending', 'approved', 'rejected')),
	rejection_reason TEXT,
	submitted_at INTEGER NOT NULL,
	reviewed_at INTEGER,
	reviewed_by TEXT,
	published_note_id TEXT,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
	FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
	FOREIGN KEY (published_note_id) REFERENCES published_notes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS note_submissions_status_submitted
	ON note_submissions(status, submitted_at ASC);

CREATE INDEX IF NOT EXISTS note_submissions_user_submitted
	ON note_submissions(user_id, submitted_at DESC);
