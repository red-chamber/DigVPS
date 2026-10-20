CREATE TABLE IF NOT EXISTS whiteboards (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
 description TEXT NOT NULL, category TEXT NOT NULL, tags_json TEXT NOT NULL DEFAULT '[]',
 document_json TEXT NOT NULL, author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 revision INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'published',
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS whiteboards_status_updated ON whiteboards(status, updated_at DESC);
CREATE TABLE IF NOT EXISTS whiteboard_assets (
 id TEXT PRIMARY KEY, board_id TEXT NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
 name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS whiteboard_asset_chunks (
 asset_id TEXT NOT NULL REFERENCES whiteboard_assets(id) ON DELETE CASCADE,
 part INTEGER NOT NULL, content BLOB NOT NULL, PRIMARY KEY (asset_id, part)
);
CREATE INDEX IF NOT EXISTS whiteboard_assets_board ON whiteboard_assets(board_id);
