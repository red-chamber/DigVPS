CREATE TABLE IF NOT EXISTS public_timeline_events (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	created_by TEXT,
	created_at INTEGER NOT NULL,
	status TEXT NOT NULL DEFAULT 'published'
		CHECK (status IN ('published', 'deleted')),
	FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_public_timeline_events_status_created
	ON public_timeline_events(status, created_at DESC);

CREATE TABLE IF NOT EXISTS hidden_timeline_events (
	event_id TEXT PRIMARY KEY,
	deleted_by TEXT,
	deleted_at INTEGER NOT NULL,
	FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL
);
