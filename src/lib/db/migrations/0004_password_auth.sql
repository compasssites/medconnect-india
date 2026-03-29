PRAGMA foreign_keys=off;

CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  phone TEXT UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('doctor', 'patient', 'admin')),
  avatar_url TEXT,
  password_hash TEXT,
  password_salt TEXT,
  password_iterations INTEGER,
  password_updated_at INTEGER,
  email_verified_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO users_new (
  id,
  email,
  phone,
  name,
  role,
  avatar_url,
  password_hash,
  password_salt,
  password_iterations,
  password_updated_at,
  email_verified_at,
  created_at,
  updated_at
)
SELECT
  id,
  email,
  phone,
  name,
  role,
  avatar_url,
  NULL,
  NULL,
  NULL,
  NULL,
  COALESCE(created_at, unixepoch()),
  created_at,
  updated_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

PRAGMA foreign_keys=on;
