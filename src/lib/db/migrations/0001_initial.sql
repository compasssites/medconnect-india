-- MedConnect D1 initial schema
-- Run: wrangler d1 execute medconnect-db --remote --file=src/lib/db/migrations/0001_initial.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('doctor', 'patient')),
  avatar_url TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS doctor_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  specialization TEXT NOT NULL,
  qualification TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  registration_council TEXT NOT NULL,
  experience_years INTEGER,
  bio TEXT,
  languages TEXT,
  city TEXT,
  state TEXT,
  clinic_name TEXT,
  clinic_address TEXT,
  consultation_fee INTEGER,
  consultation_mode TEXT NOT NULL DEFAULT 'both' CHECK(consultation_mode IN ('online', 'offline', 'both')),
  payment_mode TEXT NOT NULL DEFAULT 'prepaid' CHECK(payment_mode IN ('prepaid', 'postpaid', 'flexible')),
  upi_id TEXT,
  terms TEXT,
  is_available INTEGER NOT NULL DEFAULT 1,
  available_hours TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0,
  verified_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS patient_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  date_of_birth TEXT,
  gender TEXT CHECK(gender IN ('male', 'female', 'other')),
  blood_group TEXT,
  city TEXT,
  state TEXT,
  medical_history TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS consultations (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL REFERENCES users(id),
  patient_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN (
    'requested', 'accepted', 'rejected', 'in_progress', 'completed', 'cancelled'
  )),
  chief_complaint TEXT NOT NULL,
  symptoms TEXT,
  duration_of_symptoms TEXT,
  existing_conditions TEXT,
  current_medications TEXT,
  attached_files TEXT,
  consultation_mode TEXT CHECK(consultation_mode IN ('online', 'offline')),
  consultation_fee INTEGER,
  payment_mode TEXT CHECK(payment_mode IN ('prepaid', 'postpaid')),
  doctor_notes TEXT,
  prescription_url TEXT,
  requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
  accepted_at INTEGER,
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_specialization ON doctor_profiles(specialization);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_city ON doctor_profiles(city);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_state ON doctor_profiles(state);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_is_available ON doctor_profiles(is_available);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_slug ON doctor_profiles(slug);
CREATE INDEX IF NOT EXISTS idx_consultations_doctor_id ON consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
