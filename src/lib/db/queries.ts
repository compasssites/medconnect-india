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

const safeUserColumns = {
  id: users.id,
  email: users.email,
  phone: users.phone,
  name: users.name,
  role: users.role,
  avatarUrl: users.avatarUrl,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

// ─── User queries ────────────────────────────────────────────────────────────

export async function getUserByEmail(d1: D1Database, email: string) {
  const db = getDb(d1);
  return db.select(safeUserColumns).from(users).where(eq(users.email, email)).get();
}

export async function getUserById(d1: D1Database, id: string) {
  const db = getDb(d1);
  return db.select(safeUserColumns).from(users).where(eq(users.id, id)).get();
}

export async function getUserAuthByEmail(d1: D1Database, email: string) {
  const db = getDb(d1);
  return db
    .select({
      ...safeUserColumns,
      passwordHash: users.passwordHash,
      passwordSalt: users.passwordSalt,
      passwordIterations: users.passwordIterations,
      passwordUpdatedAt: users.passwordUpdatedAt,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .where(eq(users.email, email))
    .get();
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
      return db.select(safeUserColumns).from(users).where(eq(users.id, existing.id)).get();
    }
    return db.select(safeUserColumns).from(users).where(eq(users.id, existing.id)).get();
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

  return db.select(safeUserColumns).from(users).where(eq(users.id, adminId)).get();
}

export async function hasAdminAccount(d1: D1Database) {
  const db = getDb(d1);
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.role, "admin"))
    .get();
  return (row?.count ?? 0) > 0;
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

export type AdminDoctorFilters = {
  name?: string;
  specialization?: string;
  city?: string;
  state?: string;
  consultationMode?: "online" | "offline" | "both";
  availability?: "all" | "available" | "unavailable";
  status?: "all" | "active" | "flagged" | "suspended" | "deleted";
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
  if (params.name) {
    conditions.push(
      or(
        like(users.name, `%${params.name}%`),
        like(doctorProfiles.specialization, `%${params.name}%`)
      )!
    );
  }
  if (params.consultationMode && params.consultationMode !== "both") {
    conditions.push(
      sql`(${doctorProfiles.consultationMode} = ${params.consultationMode} OR ${doctorProfiles.consultationMode} = 'both')`
    );
  }
  conditions.push(eq(doctorProfiles.isVerified, true));
  conditions.push(sql`${doctorProfiles.deletedAt} IS NULL`);
  conditions.push(eq(doctorProfiles.isSuspended, false));

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
    .where(
      and(
        eq(doctorProfiles.slug, slug),
        eq(doctorProfiles.isVerified, true),
        eq(doctorProfiles.isSuspended, false),
        sql`${doctorProfiles.deletedAt} IS NULL`
      )
    )
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
    .where(
      and(
        eq(doctorProfiles.isVerified, true),
        eq(doctorProfiles.isSuspended, false),
        sql`${doctorProfiles.deletedAt} IS NULL`
      )
    )
    .all();
}

export async function countVerifiedDoctors(d1: D1Database) {
  const db = getDb(d1);
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(doctorProfiles)
    .where(
      and(
        eq(doctorProfiles.isVerified, true),
        eq(doctorProfiles.isSuspended, false),
        sql`${doctorProfiles.deletedAt} IS NULL`
      )
    )
    .get();
  return row?.count ?? 0;
}

export async function listAdminManagedDoctors(
  d1: D1Database,
  filters: AdminDoctorFilters = {}
) {
  const db = getDb(d1);
  const conditions = [eq(users.role, "doctor"), eq(doctorProfiles.isVerified, true)];

  if (filters.name) conditions.push(like(users.name, `%${filters.name}%`));
  if (filters.specialization) conditions.push(like(doctorProfiles.specialization, `%${filters.specialization}%`));
  if (filters.city) conditions.push(like(doctorProfiles.city, `%${filters.city}%`));
  if (filters.state) conditions.push(eq(doctorProfiles.state, filters.state));
  if (filters.consultationMode) conditions.push(eq(doctorProfiles.consultationMode, filters.consultationMode));
  if (filters.availability === "available") conditions.push(eq(doctorProfiles.isAvailable, true));
  if (filters.availability === "unavailable") conditions.push(eq(doctorProfiles.isAvailable, false));

  switch (filters.status ?? "active") {
    case "flagged":
      conditions.push(eq(doctorProfiles.isFlagged, true));
      conditions.push(sql`${doctorProfiles.deletedAt} IS NULL`);
      break;
    case "suspended":
      conditions.push(eq(doctorProfiles.isSuspended, true));
      conditions.push(sql`${doctorProfiles.deletedAt} IS NULL`);
      break;
    case "deleted":
      conditions.push(sql`${doctorProfiles.deletedAt} IS NOT NULL`);
      break;
    case "all":
      break;
    case "active":
    default:
      conditions.push(eq(doctorProfiles.isSuspended, false));
      conditions.push(sql`${doctorProfiles.deletedAt} IS NULL`);
      break;
  }

  return db
    .select({
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
      },
      profile: doctorProfiles,
    })
    .from(doctorProfiles)
    .innerJoin(users, eq(doctorProfiles.userId, users.id))
    .where(and(...conditions))
    .orderBy(sql`lower(${users.name}) asc`)
    .all();
}

export async function countUsersByRole(
  d1: D1Database,
  role: User["role"]
) {
  const db = getDb(d1);
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.role, role))
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
