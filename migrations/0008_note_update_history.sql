PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS note_update_history (
	event_id TEXT PRIMARY KEY,
	note_id TEXT NOT NULL,
	slug TEXT NOT NULL,
	title TEXT NOT NULL,
	category TEXT NOT NULL DEFAULT '',
	tags_json TEXT NOT NULL DEFAULT '[]',
	updated_at INTEGER NOT NULL,
	FOREIGN KEY (note_id) REFERENCES published_notes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS note_update_history_note_updated
	ON note_update_history(note_id, updated_at DESC);

INSERT OR IGNORE INTO note_update_history (
	event_id,
	note_id,
	slug,
	title,
	category,
	tags_json,
	updated_at
)
SELECT
	'dynamic:' || note.slug || ':updated:' || note.updated_at,
	note.id,
	note.slug,
	note.title,
	note.category,
	note.tags_json,
	note.updated_at
FROM published_notes AS note
WHERE note.updated_at <> note.published_at
	AND NOT EXISTS (
		SELECT 1
		FROM note_update_history AS history
		WHERE history.note_id = note.id
			AND history.updated_at = note.updated_at
	);
