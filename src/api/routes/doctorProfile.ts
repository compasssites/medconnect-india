import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { users, doctorProfiles, doctorApprovalRequests } from "../../lib/db/schema";
import { countVerifiedDoctors, getDoctorProfileByUserId, hasAdminAccount } from "../../lib/db/queries";
import { ulid } from "ulid";
import { generateDoctorSlug } from "../../lib/utils/slug";
import { createNotification, notifyAdmins } from "../../lib/notifications";
import type { HonoEnv } from "../index";

const app = new Hono<HonoEnv>();

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  experienceYears: z.number().int().min(0).max(60).optional(),
  bio: z.string().max(1000).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  registrationNumber: z.string().min(2).max(50).optional(),
  registrationCouncil: z.string().min(2).max(100).optional(),
  languages: z.array(z.string()).optional(),
  clinicName: z.string().max(200).optional(),
  clinicAddress: z.string().max(500).optional(),
  consultationMode: z.enum(["online", "offline", "both"]).optional(),
  consultationFee: z.number().int().min(0).optional(),
  paymentMode: z.enum(["prepaid", "postpaid", "flexible"]).optional(),
  upiId: z.string().regex(/^[a-zA-Z0-9._-]+@[a-zA-Z]{2,}$/).optional().or(z.literal("")),
  terms: z.string().max(2000).optional(),
  availableHours: z.record(z.string(), z.array(z.string())).optional(),
});

const reviewApprovalSchema = z.object({
  notes: z.string().max(500).optional(),
});

const adminDoctorUpdateSchema = z.object({
  name: z.string().min(2).max(100),
  specialization: z.string().min(2).max(100),
  qualification: z.string().min(2).max(200),
  registrationNumber: z.string().min(2).max(50),
  registrationCouncil: z.string().min(2).max(100),
  city: z.string().max(100).optional().or(z.literal("")),
  state: z.string().max(100).optional().or(z.literal("")),
  consultationFee: z.number().int().min(0).optional(),
  consultationMode: z.enum(["online", "offline", "both"]).optional(),
  paymentMode: z.enum(["prepaid", "postpaid", "flexible"]).optional(),
  isAvailable: z.boolean().optional(),
});

const adminModerationSchema = z.object({
  reason: z.string().max(500).optional(),
});

const optionalPhoneSchema = z
  .string()
  .trim()
  .regex(/^\+91[6-9]\d{9}$/, "Enter a valid Indian mobile number")
  .optional()
  .or(z.literal(""));

const completeProfileSchema = z.object({
  name: z.string().min(2).max(100),
  phone: optionalPhoneSchema,
  specialization: z.string().min(2).max(100),
  qualification: z.string().min(2).max(200),
  registrationNumber: z.string().min(2).max(50),
  registrationCouncil: z.string().min(2).max(100),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  recommendedByUserId: z.string().min(1).optional(),
});

// PUT /api/doctors/profile
app.put("/profile", zValidator("json", updateProfileSchema), async (c) => {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user || user.role !== "doctor") return c.json({ error: "Forbidden" }, 403);

  const data = c.req.valid("json");
  const db = drizzle(c.env.DB);
  const now = Math.floor(Date.now() / 1000);

  if (data.name) {
    await db.update(users).set({ name: data.name, updatedAt: now }).where(eq(users.id, user.id));
  }

  const profileUpdate: Record<string, unknown> = { updatedAt: now };
  if (data.experienceYears !== undefined) profileUpdate.experienceYears = data.experienceYears;
  if (data.bio !== undefined) profileUpdate.bio = data.bio;
  if (data.city !== undefined) profileUpdate.city = data.city;
  if (data.state !== undefined) profileUpdate.state = data.state;
  if (data.registrationNumber !== undefined) profileUpdate.registrationNumber = data.registrationNumber;
  if (data.registrationCouncil !== undefined) profileUpdate.registrationCouncil = data.registrationCouncil;
  if (data.languages !== undefined) profileUpdate.languages = JSON.stringify(data.languages);
  if (data.clinicName !== undefined) profileUpdate.clinicName = data.clinicName;
  if (data.clinicAddress !== undefined) profileUpdate.clinicAddress = data.clinicAddress;
  if (data.consultationMode !== undefined) profileUpdate.consultationMode = data.consultationMode;
  if (data.consultationFee !== undefined) profileUpdate.consultationFee = data.consultationFee;
  if (data.paymentMode !== undefined) profileUpdate.paymentMode = data.paymentMode;
  if (data.upiId !== undefined) profileUpdate.upiId = data.upiId || null;
  if (data.terms !== undefined) profileUpdate.terms = data.terms;
  if (data.availableHours !== undefined) profileUpdate.availableHours = JSON.stringify(data.availableHours);

  await db.update(doctorProfiles).set(profileUpdate as Parameters<typeof db.update>[0]).where(eq(doctorProfiles.userId, user.id));

  return c.json({ success: true });
});

// PUT /api/doctors/availability
app.put("/availability", async (c) => {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user || user.role !== "doctor") return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{ isAvailable: boolean }>();
  const db = drizzle(c.env.DB);
  await db
    .update(doctorProfiles)
    .set({ isAvailable: body.isAvailable, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(doctorProfiles.userId, user.id));

  return c.json({ success: true });
});

app.post("/complete-profile", zValidator("json", completeProfileSchema), async (c) => {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user || user.role !== "doctor") return c.json({ error: "Forbidden" }, 403);

  const existingProfile = await getDoctorProfileByUserId(c.env.DB, user.id);
  if (existingProfile) return c.json({ error: "Doctor profile already exists" }, 400);

  const data = c.req.valid("json");
  const db = drizzle(c.env.DB);
  const now = Math.floor(Date.now() / 1000);
  const phone = data.phone?.trim() || null;

  if (phone) {
    const existingPhone = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).get();
    if (existingPhone && existingPhone.id !== user.id) {
      return c.json({ error: "That mobile number is already linked to another account" }, 400);
    }
  }

  const verifiedDoctorCount = await countVerifiedDoctors(c.env.DB);
  const adminExists = await hasAdminAccount(c.env.DB);
  const isBootstrapDoctor = verifiedDoctorCount === 0 && !adminExists;
  const needsDoctorRecommendation = verifiedDoctorCount > 0;

  if (needsDoctorRecommendation) {
    if (!data.recommendedByUserId) {
      return c.json({ error: "Please choose an approved doctor for approval" }, 400);
    }

    const recommendedByProfile = await getDoctorProfileByUserId(c.env.DB, data.recommendedByUserId);
    if (!recommendedByProfile || !recommendedByProfile.isVerified) {
      return c.json({ error: "Selected doctor cannot review new registrations right now" }, 400);
    }
  }

  const baseSlug = generateDoctorSlug(data.name, data.specialization, data.city);
  const slug = `${baseSlug}-${user.id.slice(-4).toLowerCase()}`;

  await db.update(users).set({ name: data.name, phone, updatedAt: now }).where(eq(users.id, user.id));

  try {
    await db.insert(doctorProfiles).values({
      id: ulid(),
      userId: user.id,
      slug,
      specialization: data.specialization,
      qualification: data.qualification,
      registrationNumber: data.registrationNumber,
      registrationCouncil: data.registrationCouncil,
      city: data.city ?? null,
      state: data.state ?? null,
      isVerified: isBootstrapDoctor,
      verifiedAt: isBootstrapDoctor ? now : null,
      createdAt: now,
      updatedAt: now,
    });

    await db.delete(doctorApprovalRequests).where(eq(doctorApprovalRequests.doctorUserId, user.id));
    if (!isBootstrapDoctor) {
      await db.insert(doctorApprovalRequests).values({
        id: ulid(),
        doctorUserId: user.id,
        recommendedByUserId: data.recommendedByUserId || null,
        status: "pending",
        requestedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await notifyAdmins(c.env.DB, {
        type: "doctor_approval_pending",
        title: "Doctor profile ready for review",
        body: `${data.name} completed doctor registration and is waiting for approval.`,
        link: "/dashboard/admin",
        entityType: "doctor",
        entityId: user.id,
      });
    }
  } catch (error) {
    await db.delete(doctorApprovalRequests).where(eq(doctorApprovalRequests.doctorUserId, user.id));
    await db.delete(doctorProfiles).where(eq(doctorProfiles.userId, user.id));
    throw error;
  }

  return c.json({
    success: true,
    approvalStatus: isBootstrapDoctor ? "approved" : "pending",
  });
});

async function getReviewerContext(c: Context<HonoEnv>) {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user || !["doctor", "admin"].includes(user.role)) {
    return { error: c.json({ error: "Forbidden" }, 403) };
  }

  const db = drizzle(c.env.DB);
  if (user.role === "admin") {
    return { db, user };
  }

  const reviewerProfile = await db.select().from(doctorProfiles).where(eq(doctorProfiles.userId, user.id)).get();
  if (!reviewerProfile?.isVerified) {
    return { error: c.json({ error: "Only approved doctors can review registrations" }, 403) };
  }

  return { db, user };
}

async function getAdminDoctorContext(c: Context<HonoEnv>) {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user || user.role !== "admin") {
    return { error: c.json({ error: "Forbidden" }, 403) };
  }

  const doctorUserId = c.req.param("doctorUserId");
  const db = drizzle(c.env.DB);
  const doctor = await db
    .select({
      user: {
        id: users.id,
        role: users.role,
        name: users.name,
        email: users.email,
      },
      profile: doctorProfiles,
    })
    .from(users)
    .innerJoin(doctorProfiles, eq(doctorProfiles.userId, users.id))
    .where(and(eq(users.id, doctorUserId), eq(users.role, "doctor")))
    .get();

  if (!doctor) {
    return { error: c.json({ error: "Doctor not found" }, 404) };
  }

  return { db, admin: user, doctor };
}

app.post("/approvals/:doctorUserId/approve", async (c) => {
  const reviewer = await getReviewerContext(c);
  if ("error" in reviewer) return reviewer.error;

  const doctorUserId = c.req.param("doctorUserId");
  if (doctorUserId === reviewer.user.id) {
    return c.json({ error: "You cannot review your own registration" }, 400);
  }

  const request = await reviewer.db
    .select()
    .from(doctorApprovalRequests)
    .where(eq(doctorApprovalRequests.doctorUserId, doctorUserId))
    .get();

  if (!request || request.status !== "pending") {
    return c.json({ error: "No pending approval request found" }, 404);
  }
  if (reviewer.user.role !== "admin" && request.recommendedByUserId && request.recommendedByUserId !== reviewer.user.id) {
    return c.json({ error: "This request is assigned to another doctor" }, 403);
  }

  const now = Math.floor(Date.now() / 1000);
  await reviewer.db
    .update(doctorApprovalRequests)
    .set({
      status: "approved",
      reviewedByUserId: reviewer.user.id,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(doctorApprovalRequests.doctorUserId, doctorUserId));

  await reviewer.db
    .update(doctorProfiles)
    .set({
      isVerified: true,
      verifiedAt: now,
      updatedAt: now,
    })
    .where(eq(doctorProfiles.userId, doctorUserId));

  await createNotification(c.env.DB, {
    userId: doctorUserId,
    type: "doctor_approved",
    title: "Doctor profile approved",
    body: "Your profile is now approved and visible in Find Doctors.",
    link: "/dashboard/doctor",
    entityType: "doctor",
    entityId: doctorUserId,
  });

  return c.json({ success: true });
});

app.post("/approvals/:doctorUserId/reject", zValidator("json", reviewApprovalSchema), async (c) => {
  const reviewer = await getReviewerContext(c);
  if ("error" in reviewer) return reviewer.error;

  const doctorUserId = c.req.param("doctorUserId");
  if (doctorUserId === reviewer.user.id) {
    return c.json({ error: "You cannot review your own registration" }, 400);
  }

  const request = await reviewer.db
    .select()
    .from(doctorApprovalRequests)
    .where(eq(doctorApprovalRequests.doctorUserId, doctorUserId))
    .get();

  if (!request || request.status !== "pending") {
    return c.json({ error: "No pending approval request found" }, 404);
  }
  if (reviewer.user.role !== "admin" && request.recommendedByUserId && request.recommendedByUserId !== reviewer.user.id) {
    return c.json({ error: "This request is assigned to another doctor" }, 403);
  }

  const { notes } = c.req.valid("json");
  const now = Math.floor(Date.now() / 1000);
  await reviewer.db
    .update(doctorApprovalRequests)
    .set({
      status: "rejected",
      reviewNotes: notes,
      reviewedByUserId: reviewer.user.id,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(doctorApprovalRequests.doctorUserId, doctorUserId));

  await reviewer.db
    .update(doctorProfiles)
    .set({
      isAvailable: false,
      updatedAt: now,
    })
    .where(eq(doctorProfiles.userId, doctorUserId));

  await createNotification(c.env.DB, {
    userId: doctorUserId,
    type: "doctor_rejected",
    title: "Doctor profile needs changes",
    body: notes ? `Review note: ${notes}` : "Your doctor registration was not approved yet.",
    link: "/dashboard/doctor",
    entityType: "doctor",
    entityId: doctorUserId,
  });

  return c.json({ success: true });
});

app.put("/admin/:doctorUserId", zValidator("json", adminDoctorUpdateSchema), async (c) => {
  const context = await getAdminDoctorContext(c);
  if ("error" in context) return context.error;

  const { db, doctor } = context;
  const data = c.req.valid("json");
  const now = Math.floor(Date.now() / 1000);
  const nextSlug = generateDoctorSlug(data.name, data.specialization, data.city || undefined);
  const slug = `${nextSlug}-${doctor.user.id.slice(-4).toLowerCase()}`;

  await db.update(users).set({ name: data.name, updatedAt: now }).where(eq(users.id, doctor.user.id));
  await db
    .update(doctorProfiles)
    .set({
      slug,
      specialization: data.specialization,
      qualification: data.qualification,
      registrationNumber: data.registrationNumber,
      registrationCouncil: data.registrationCouncil,
      city: data.city || null,
      state: data.state || null,
      consultationFee: data.consultationFee ?? doctor.profile.consultationFee,
      consultationMode: data.consultationMode ?? doctor.profile.consultationMode,
      paymentMode: data.paymentMode ?? doctor.profile.paymentMode,
      isAvailable: data.isAvailable ?? doctor.profile.isAvailable,
      updatedAt: now,
    })
    .where(eq(doctorProfiles.userId, doctor.user.id));

  return c.json({ success: true, slug });
});

app.post("/admin/:doctorUserId/flag", zValidator("json", adminModerationSchema), async (c) => {
  const context = await getAdminDoctorContext(c);
  if ("error" in context) return context.error;

  const { db, doctor } = context;
  const { reason } = c.req.valid("json");
  const now = Math.floor(Date.now() / 1000);

  await db
    .update(doctorProfiles)
    .set({
      isFlagged: true,
      flaggedAt: now,
      flagReason: reason ?? null,
      updatedAt: now,
    })
    .where(eq(doctorProfiles.userId, doctor.user.id));

  await createNotification(c.env.DB, {
    userId: doctor.user.id,
    type: "doctor_flagged",
    title: "Profile flagged for review",
    body: reason ?? "An admin flagged your profile for review.",
    link: "/dashboard/doctor",
    entityType: "doctor",
    entityId: doctor.user.id,
  });

  return c.json({ success: true });
});

app.post("/admin/:doctorUserId/unflag", async (c) => {
  const context = await getAdminDoctorContext(c);
  if ("error" in context) return context.error;

  const { db, doctor } = context;
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(doctorProfiles)
    .set({
      isFlagged: false,
      flaggedAt: null,
      flagReason: null,
      updatedAt: now,
    })
    .where(eq(doctorProfiles.userId, doctor.user.id));

  await createNotification(c.env.DB, {
    userId: doctor.user.id,
    type: "doctor_flag_cleared",
    title: "Profile flag removed",
    body: "The admin review flag has been cleared from your profile.",
    link: "/dashboard/doctor",
    entityType: "doctor",
    entityId: doctor.user.id,
  });

  return c.json({ success: true });
});

app.post("/admin/:doctorUserId/suspend", zValidator("json", adminModerationSchema), async (c) => {
  const context = await getAdminDoctorContext(c);
  if ("error" in context) return context.error;

  const { db, doctor } = context;
  const { reason } = c.req.valid("json");
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(doctorProfiles)
    .set({
      isSuspended: true,
      suspendedAt: now,
      suspensionReason: reason ?? null,
      isAvailable: false,
      updatedAt: now,
    })
    .where(eq(doctorProfiles.userId, doctor.user.id));

  await createNotification(c.env.DB, {
    userId: doctor.user.id,
    type: "doctor_suspended",
    title: "Profile suspended",
    body: reason ?? "Your doctor profile has been suspended by admin.",
    link: "/dashboard/doctor",
    entityType: "doctor",
    entityId: doctor.user.id,
  });

  return c.json({ success: true });
});

app.post("/admin/:doctorUserId/unsuspend", async (c) => {
  const context = await getAdminDoctorContext(c);
  if ("error" in context) return context.error;

  const { db, doctor } = context;
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(doctorProfiles)
    .set({
      isSuspended: false,
      suspendedAt: null,
      suspensionReason: null,
      updatedAt: now,
    })
    .where(eq(doctorProfiles.userId, doctor.user.id));

  await createNotification(c.env.DB, {
    userId: doctor.user.id,
    type: "doctor_unsuspended",
    title: "Suspension lifted",
    body: "Your doctor profile is active again.",
    link: "/dashboard/doctor",
    entityType: "doctor",
    entityId: doctor.user.id,
  });

  return c.json({ success: true });
});

app.post("/admin/:doctorUserId/delete", zValidator("json", adminModerationSchema), async (c) => {
  const context = await getAdminDoctorContext(c);
  if ("error" in context) return context.error;

  const { db, admin, doctor } = context;
  const { reason } = c.req.valid("json");
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(doctorProfiles)
    .set({
      deletedAt: now,
      deletedReason: reason ?? null,
      deletedByUserId: admin.id,
      isAvailable: false,
      updatedAt: now,
    })
    .where(eq(doctorProfiles.userId, doctor.user.id));

  await createNotification(c.env.DB, {
    userId: doctor.user.id,
    type: "doctor_deleted",
    title: "Doctor profile removed",
    body: reason ?? "Your public doctor profile was removed by admin.",
    link: "/dashboard/doctor",
    entityType: "doctor",
    entityId: doctor.user.id,
  });

  return c.json({ success: true });
});

app.post("/admin/:doctorUserId/restore", async (c) => {
  const context = await getAdminDoctorContext(c);
  if ("error" in context) return context.error;

  const { db, doctor } = context;
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(doctorProfiles)
    .set({
      deletedAt: null,
      deletedReason: null,
      deletedByUserId: null,
      updatedAt: now,
    })
    .where(eq(doctorProfiles.userId, doctor.user.id));

  await createNotification(c.env.DB, {
    userId: doctor.user.id,
    type: "doctor_restored",
    title: "Doctor profile restored",
    body: "Your public doctor profile has been restored.",
    link: "/dashboard/doctor",
    entityType: "doctor",
    entityId: doctor.user.id,
  });

  return c.json({ success: true });
});

export { app as doctorProfileRoutes };
