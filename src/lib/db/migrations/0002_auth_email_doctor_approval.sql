-- Migrate auth to email-first and add doctor approval workflow

PRAGMA foreign_keys=off;

CREATE TABLE IF NOT EXISTS users_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  phone TEXT UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('doctor', 'patient')),
  avatar_url TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO users_new (id, email, phone, name, role, avatar_url, created_at, updated_at)
SELECT
  id,
  COALESCE(email, lower(replace(replace(phone, '+', 'legacy-'), ' ', '')) || '@legacy.medconnect.local'),
  phone,
  name,
  role,
  avatar_url,
  created_at,
  updated_at
FROM (
  SELECT
    id,
    NULL AS email,
    phone,
    name,
    role,
    avatar_url,
    created_at,
    updated_at
  FROM users
);

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

CREATE TABLE IF NOT EXISTS doctor_approval_requests (
  id TEXT PRIMARY KEY,
  doctor_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  recommended_by_user_id TEXT REFERENCES users(id),
  reviewed_by_user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  review_notes TEXT,
  requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_doctor_approval_requests_recommended_by
  ON doctor_approval_requests(recommended_by_user_id);
CREATE INDEX IF NOT EXISTS idx_doctor_approval_requests_status
  ON doctor_approval_requests(status);

UPDATE doctor_profiles
SET is_verified = 1,
    verified_at = COALESCE(verified_at, unixepoch())
WHERE NOT EXISTS (
  SELECT 1
  FROM doctor_profiles
  WHERE is_verified = 1
);

PRAGMA foreign_keys=on;
