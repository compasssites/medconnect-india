import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// ─── Users ─────────────────────────────────────────────────────────────────

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(), // ULID
    email: text("email").notNull().unique(),
    phone: text("phone").unique(), // optional contact number
    name: text("name").notNull(),
    role: text("role", { enum: ["doctor", "patient", "admin"] }).notNull(),
    avatarUrl: text("avatar_url"),
    passwordHash: text("password_hash"),
    passwordSalt: text("password_salt"),
    passwordIterations: integer("password_iterations", { mode: "number" }),
    passwordUpdatedAt: integer("password_updated_at", { mode: "number" }),
    emailVerifiedAt: integer("email_verified_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("idx_users_email").on(t.email), index("idx_users_phone").on(t.phone)]
);

// ─── Doctor Profiles ────────────────────────────────────────────────────────

export const doctorProfiles = sqliteTable(
  "doctor_profiles",
  {
    id: text("id").primaryKey(), // ULID
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id),
    slug: text("slug").notNull().unique(),
    specialization: text("specialization").notNull(),
    qualification: text("qualification").notNull(),
    registrationNumber: text("registration_number").notNull(),
    registrationCouncil: text("registration_council").notNull(),
    experienceYears: integer("experience_years"),
    bio: text("bio"),
    // JSON arrays stored as TEXT: '["Hindi","English"]'
    languages: text("languages"),
    city: text("city"),
    state: text("state"),
    clinicName: text("clinic_name"),
    clinicAddress: text("clinic_address"),

    // Consultation settings
    consultationFee: integer("consultation_fee"), // whole INR
    consultationMode: text("consultation_mode", {
      enum: ["online", "offline", "both"],
    })
      .notNull()
      .default("both"),
    paymentMode: text("payment_mode", {
      enum: ["prepaid", "postpaid", "flexible"],
    })
      .notNull()
      .default("prepaid"),
    upiId: text("upi_id"),
    terms: text("terms"),

    // Availability
    isAvailable: integer("is_available", { mode: "boolean" })
      .notNull()
      .default(true),
    // JSON: '{"mon":["09:00-12:00"],"tue":["09:00-12:00"]}'
    availableHours: text("available_hours"),

    // Verification
    isVerified: integer("is_verified", { mode: "boolean" })
      .notNull()
      .default(false),
    verifiedAt: integer("verified_at", { mode: "number" }),

    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_doctor_profiles_specialization").on(t.specialization),
    index("idx_doctor_profiles_city").on(t.city),
    index("idx_doctor_profiles_state").on(t.state),
    index("idx_doctor_profiles_is_available").on(t.isAvailable),
    index("idx_doctor_profiles_slug").on(t.slug),
  ]
);

// ─── Patient Profiles ───────────────────────────────────────────────────────

export const patientProfiles = sqliteTable("patient_profiles", {
  id: text("id").primaryKey(), // ULID
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  dateOfBirth: text("date_of_birth"), // ISO date string
  gender: text("gender", { enum: ["male", "female", "other"] }),
  bloodGroup: text("blood_group"),
  city: text("city"),
  state: text("state"),
  medicalHistory: text("medical_history"),
  createdAt: integer("created_at", { mode: "number" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "number" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const doctorApprovalRequests = sqliteTable(
  "doctor_approval_requests",
  {
    id: text("id").primaryKey(),
    doctorUserId: text("doctor_user_id")
      .notNull()
      .unique()
      .references(() => users.id),
    recommendedByUserId: text("recommended_by_user_id").references(() => users.id),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .notNull()
      .default("pending"),
    reviewNotes: text("review_notes"),
    requestedAt: integer("requested_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch())`),
    reviewedAt: integer("reviewed_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_doctor_approval_requests_recommended_by").on(t.recommendedByUserId),
    index("idx_doctor_approval_requests_status").on(t.status),
  ]
);

// ─── Consultations ──────────────────────────────────────────────────────────

export const consultations = sqliteTable(
  "consultations",
  {
    id: text("id").primaryKey(), // ULID
    doctorId: text("doctor_id")
      .notNull()
      .references(() => users.id),
    patientId: text("patient_id")
      .notNull()
      .references(() => users.id),
    status: text("status", {
      enum: [
        "requested",
        "accepted",
        "rejected",
        "in_progress",
        "completed",
        "cancelled",
      ],
    })
      .notNull()
      .default("requested"),

    // Patient's request
    chiefComplaint: text("chief_complaint").notNull(),
    symptoms: text("symptoms"),
    durationOfSymptoms: text("duration_of_symptoms"),
    existingConditions: text("existing_conditions"),
    currentMedications: text("current_medications"),
    // JSON array of R2 file keys
    attachedFiles: text("attached_files"),

    // Doctor's response
    consultationMode: text("consultation_mode", {
      enum: ["online", "offline"],
    }),
    consultationFee: integer("consultation_fee"), // agreed fee in INR
    paymentMode: text("payment_mode", { enum: ["prepaid", "postpaid"] }),
    doctorNotes: text("doctor_notes"),
    prescriptionUrl: text("prescription_url"), // R2 key

    // Timestamps
    requestedAt: integer("requested_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch())`),
    acceptedAt: integer("accepted_at", { mode: "number" }),
    startedAt: integer("started_at", { mode: "number" }),
    completedAt: integer("completed_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_consultations_doctor_id").on(t.doctorId),
    index("idx_consultations_patient_id").on(t.patientId),
    index("idx_consultations_status").on(t.status),
  ]
);

// ─── Inferred types ─────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type DoctorProfile = typeof doctorProfiles.$inferSelect;
export type NewDoctorProfile = typeof doctorProfiles.$inferInsert;
export type PatientProfile = typeof patientProfiles.$inferSelect;
export type NewPatientProfile = typeof patientProfiles.$inferInsert;
export type Consultation = typeof consultations.$inferSelect;
export type NewConsultation = typeof consultations.$inferInsert;
export type DoctorApprovalRequest = typeof doctorApprovalRequests.$inferSelect;
export type NewDoctorApprovalRequest = typeof doctorApprovalRequests.$inferInsert;
