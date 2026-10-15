-- Cloudflare workerd rejects PBKDF2 iteration counts above 100,000.
-- Refresh the seeded administrator hash for the supported iteration count.
UPDATE users
SET password_hash = 'vEiRzGYsUJflWA6cWwRtg7f5Pv5QfiFnKuL9RiXsSt0'
WHERE id = 'admin_root'
  AND password_salt = 'RYzcl7QJPExAFwJ11EEF1Q';
