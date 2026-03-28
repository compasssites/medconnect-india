import { eq, and, like, sql, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  users,
  doctorProfiles,
  patientProfiles,
  consultations,
  doctorApprovalRequests,
  type User,
  type DoctorProfile,
  type Consultation,
} from "./schema";

export function getDb(d1: D1Database) {
  return drizzle(d1);
}

// ─── User queries ────────────────────────────────────────────────────────────

export async function getUserByEmail(d1: D1Database, email: string) {
  const db = getDb(d1);
  return db.select().from(users).where(eq(users.email, email)).get();
}

export async function getUserById(d1: D1Database, id: string) {
  const db = getDb(d1);
  return db.select().from(users).where(eq(users.id, id)).get();
}

export async function ensureAdminUser(d1: D1Database, email: string) {
  const db = getDb(d1);
  const normalizedEmail = email.trim().toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).get();

  if (existing) {
    if (existing.role !== "admin") {
      await db.update(users).set({ role: "admin", updatedAt: now }).where(eq(users.id, existing.id));
      await db.delete(doctorProfiles).where(eq(doctorProfiles.userId, existing.id));
      await db.delete(patientProfiles).where(eq(patientProfiles.userId, existing.id));
      await db.delete(doctorApprovalRequests).where(eq(doctorApprovalRequests.doctorUserId, existing.id));
      return db.select().from(users).where(eq(users.id, existing.id)).get();
    }
    return existing;
  }

  const adminId = crypto.randomUUID();
  await db.insert(users).values({
    id: adminId,
    email: normalizedEmail,
    phone: null,
    name: "MedConnect Admin",
    role: "admin",
    createdAt: now,
    updatedAt: now,
  });

  return db.select().from(users).where(eq(users.id, adminId)).get();
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
  conditions.push(eq(doctorProfiles.isVerified, true));

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
      user: { id: users.id, name: users.name, avatarUrl: users.avatarUrl },
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

export async function listApprovedDoctors(d1: D1Database) {
  const db = getDb(d1);
  return db
    .select({
      userId: users.id,
      name: users.name,
      specialization: doctorProfiles.specialization,
      city: doctorProfiles.city,
      slug: doctorProfiles.slug,
    })
    .from(doctorProfiles)
    .innerJoin(users, eq(doctorProfiles.userId, users.id))
    .where(eq(doctorProfiles.isVerified, true))
    .all();
}

export async function countVerifiedDoctors(d1: D1Database) {
  const db = getDb(d1);
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(doctorProfiles)
    .where(eq(doctorProfiles.isVerified, true))
    .get();
  return row?.count ?? 0;
}

export async function getDoctorApprovalRequestForDoctor(d1: D1Database, doctorUserId: string) {
  const db = getDb(d1);
  return db
    .select()
    .from(doctorApprovalRequests)
    .where(eq(doctorApprovalRequests.doctorUserId, doctorUserId))
    .get();
}

export async function getPendingApprovalRequestsForReviewer(d1: D1Database, reviewerUserId?: string) {
  const db = getDb(d1);

  const baseQuery = db
    .select({
      request: doctorApprovalRequests,
      doctor: {
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
      },
      profile: doctorProfiles,
    })
    .from(doctorApprovalRequests)
    .innerJoin(users, eq(doctorApprovalRequests.doctorUserId, users.id))
    .innerJoin(doctorProfiles, eq(doctorProfiles.userId, users.id));

  if (!reviewerUserId) {
    return baseQuery.where(eq(doctorApprovalRequests.status, "pending")).all();
  }

  return baseQuery
    .where(
      and(
        eq(doctorApprovalRequests.status, "pending"),
        or(
          eq(doctorApprovalRequests.recommendedByUserId, reviewerUserId),
          sql`${doctorApprovalRequests.recommendedByUserId} IS NULL`
        )
      )
    )
    .all();
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
