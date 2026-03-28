import { z } from "zod";

// ─── Auth ────────────────────────────────────────────────────────────────────

export const sendOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export const verifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  otp: z.string().length(6).regex(/^\d{6}$/, "OTP must be 6 digits"),
});

// ─── Doctor Profile ──────────────────────────────────────────────────────────

export const doctorProfileSchema = z.object({
  name: z.string().min(2).max(100),
  specialization: z.string().min(2).max(100),
  qualification: z.string().min(2).max(200),
  registrationNumber: z.string().min(2).max(50),
  registrationCouncil: z.string().min(2).max(100),
  experienceYears: z.number().int().min(0).max(60).optional(),
  bio: z.string().max(1000).optional(),
  languages: z.array(z.string()).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  clinicName: z.string().max(200).optional(),
  clinicAddress: z.string().max(500).optional(),
  consultationFee: z.number().int().min(0).optional(),
  consultationMode: z.enum(["online", "offline", "both"]).default("both"),
  paymentMode: z.enum(["prepaid", "postpaid", "flexible"]).default("prepaid"),
  upiId: z
    .string()
    .regex(/^[a-zA-Z0-9._-]+@[a-zA-Z]{2,}$/, "Invalid UPI ID format")
    .optional(),
  terms: z.string().max(2000).optional(),
});

// ─── Patient Profile ─────────────────────────────────────────────────────────

export const patientProfileSchema = z.object({
  name: z.string().min(2).max(100),
  dateOfBirth: z.string().date().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  bloodGroup: z.string().max(5).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  medicalHistory: z.string().max(2000).optional(),
});

// ─── Consultation ────────────────────────────────────────────────────────────

export const createConsultationSchema = z.object({
  doctorId: z.string().min(1),
  chiefComplaint: z.string().min(5).max(500),
  symptoms: z.string().max(2000).optional(),
  durationOfSymptoms: z.string().max(200).optional(),
  existingConditions: z.string().max(1000).optional(),
  currentMedications: z.string().max(1000).optional(),
  attachedFiles: z.array(z.string()).optional(),
});

export const acceptConsultationSchema = z.object({
  consultationMode: z.enum(["online", "offline"]),
  consultationFee: z.number().int().min(0),
  paymentMode: z.enum(["prepaid", "postpaid"]),
  doctorNotes: z.string().max(2000).optional(),
});

export const rejectConsultationSchema = z.object({
  doctorNotes: z.string().max(500).optional(),
});

// ─── Doctor Search ───────────────────────────────────────────────────────────

export const doctorSearchSchema = z.object({
  specialization: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  name: z.string().optional(),
  available: z.coerce.boolean().optional(),
  mode: z.enum(["online", "offline"]).optional(),
  feeMin: z.coerce.number().optional(),
  feeMax: z.coerce.number().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
