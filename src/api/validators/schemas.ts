import { z } from "zod";

// ─── Auth ────────────────────────────────────────────────────────────────────

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");

const codeSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.replace(/\D/g, "").slice(0, 6) : value),
  z.string().length(6).regex(/^\d{6}$/, "Code must be 6 digits")
);

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use 72 characters or fewer")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

const turnstileTokenSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().max(2048).optional()
);

export const sendCodeSchema = z.object({
  email: emailSchema,
  turnstileToken: turnstileTokenSchema,
});

export const verifyCodeSchema = z.object({
  email: emailSchema,
  code: codeSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  turnstileToken: turnstileTokenSchema,
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: codeSchema,
  password: passwordSchema,
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
