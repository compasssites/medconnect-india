ALTER TABLE doctor_profiles ADD COLUMN is_flagged INTEGER NOT NULL DEFAULT 0;
ALTER TABLE doctor_profiles ADD COLUMN flagged_at INTEGER;
ALTER TABLE doctor_profiles ADD COLUMN flag_reason TEXT;
ALTER TABLE doctor_profiles ADD COLUMN is_suspended INTEGER NOT NULL DEFAULT 0;
ALTER TABLE doctor_profiles ADD COLUMN suspended_at INTEGER;
ALTER TABLE doctor_profiles ADD COLUMN suspension_reason TEXT;
ALTER TABLE doctor_profiles ADD COLUMN deleted_at INTEGER;
ALTER TABLE doctor_profiles ADD COLUMN deleted_reason TEXT;
ALTER TABLE doctor_profiles ADD COLUMN deleted_by_user_id TEXT REFERENCES users(id);
