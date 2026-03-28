import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { users, doctorProfiles, doctorApprovalRequests } from "../../lib/db/schema";
import type { HonoEnv } from "../index";

const app = new Hono<HonoEnv>();

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  experienceYears: z.number().int().min(0).max(60).optional(),
  bio: z.string().max(1000).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
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

async function getReviewerContext(c: Context<HonoEnv>) {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user || user.role !== "doctor") {
    return { error: c.json({ error: "Forbidden" }, 403) };
  }

  const db = drizzle(c.env.DB);
  const reviewerProfile = await db.select().from(doctorProfiles).where(eq(doctorProfiles.userId, user.id)).get();
  if (!reviewerProfile?.isVerified) {
    return { error: c.json({ error: "Only approved doctors can review registrations" }, 403) };
  }

  return { db, user };
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
  if (request.recommendedByUserId && request.recommendedByUserId !== reviewer.user.id) {
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
  if (request.recommendedByUserId && request.recommendedByUserId !== reviewer.user.id) {
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

  return c.json({ success: true });
});

export { app as doctorProfileRoutes };
