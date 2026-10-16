PRAGMA foreign_keys = ON;

-- Keep only the newest existing session for each user.
DELETE FROM sessions AS older
WHERE EXISTS (
    SELECT 1
    FROM sessions AS newer
    WHERE newer.user_id = older.user_id
      AND (
          newer.created_at > older.created_at
          OR (
              newer.created_at = older.created_at
              AND newer.token_hash > older.token_hash
          )
      )
);

-- Enforce one active session record per user at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS sessions_single_user
    ON sessions(user_id);
