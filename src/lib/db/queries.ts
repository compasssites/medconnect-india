import { eq, and, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  users,
  doctorProfiles,
  patientProfiles,
  consultations,
  type User,
  type DoctorProfile,
  type Consultation,
} from "./schema";

export function getDb(d1: D1Database) {
  return drizzle(d1);
}

// ─── User queries ────────────────────────────────────────────────────────────

export async function getUserByPhone(d1: D1Database, phone: string) {
  const db = getDb(d1);
  return db.select().from(users).where(eq(users.phone, phone)).get();
}

export async function getUserById(d1: D1Database, id: string) {
  const db = getDb(d1);
  return db.select().from(users).where(eq(users.id, id)).get();
}

// ─── Doctor queries ──────────────────────────────────────────────────────────

export type DoctorSearchParams = {
  specialization?: string;
  city?: string;
  state?: string;
  name?: string;
  isAvailable?: boolean;
  consultationMode?: "online" | "offline" | "both";
  feeMin?: number;
  feeMax?: number;
  limit?: number;
  offset?: number;
};

export async function searchDoctors(d1: D1Database, params: DoctorSearchParams) {
  const db = getDb(d1);
  const conditions = [];

  if (params.isAvailable !== undefined) {
    conditions.push(eq(doctorProfiles.isAvailable, params.isAvailable));
  }
  if (params.specialization) {
    conditions.push(like(doctorProfiles.specialization, `%${params.specialization}%`));
  }
  if (params.city) {
    conditions.push(like(doctorProfiles.city, `%${params.city}%`));
  }
  if (params.state) {
    conditions.push(like(doctorProfiles.state, `%${params.state}%`));
  }
  if (params.consultationMode && params.consultationMode !== "both") {
    conditions.push(
      sql`(${doctorProfiles.consultationMode} = ${params.consultationMode} OR ${doctorProfiles.consultationMode} = 'both')`
    );
  }

  const query = db
    .select({
      profile: doctorProfiles,
      user: { id: users.id, name: users.name, avatarUrl: users.avatarUrl },
    })
    .from(doctorProfiles)
    .innerJoin(users, eq(doctorProfiles.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(params.limit ?? 20)
    .offset(params.offset ?? 0);

  return query.all();
}

export async function getDoctorBySlug(d1: D1Database, slug: string) {
  const db = getDb(d1);
  return db
    .select({
      profile: doctorProfiles,
      user: { id: users.id, name: users.name, avatarUrl: users.avatarUrl, phone: users.phone },
    })
    .from(doctorProfiles)
    .innerJoin(users, eq(doctorProfiles.userId, users.id))
    .where(eq(doctorProfiles.slug, slug))
    .get();
}

export async function getDoctorProfileByUserId(d1: D1Database, userId: string) {
  const db = getDb(d1);
  return db.select().from(doctorProfiles).where(eq(doctorProfiles.userId, userId)).get();
}

// ─── Consultation queries ────────────────────────────────────────────────────

export async function getConsultationById(d1: D1Database, id: string) {
  const db = getDb(d1);
  return db.select().from(consultations).where(eq(consultations.id, id)).get();
}

export async function getConsultationsForDoctor(
  d1: D1Database,
  doctorId: string,
  status?: Consultation["status"]
) {
  const db = getDb(d1);
  const conditions = [eq(consultations.doctorId, doctorId)];
  if (status) conditions.push(eq(consultations.status, status));
  return db.select().from(consultations).where(and(...conditions)).all();
}

export async function getConsultationsForPatient(
  d1: D1Database,
  patientId: string,
  status?: Consultation["status"]
) {
  const db = getDb(d1);
  const conditions = [eq(consultations.patientId, patientId)];
  if (status) conditions.push(eq(consultations.status, status));
  return db.select().from(consultations).where(and(...conditions)).all();
}
