import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getCookie } from "hono/cookie";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { users, doctorProfiles, doctorApprovalRequests } from "../../lib/db/schema";
import { getSession, updateSessionUserId } from "../../lib/auth/session";
import { generateDoctorSlug } from "../../lib/utils/slug";
import {
  countVerifiedDoctors,
  getDoctorProfileByUserId,
  hasAdminAccount,
} from "../../lib/db/queries";
import type { HonoEnv } from "../index";

const optionalPhoneSchema = z
  .string()
  .trim()
  .regex(/^\+91[6-9]\d{9}$/, "Enter a valid Indian mobile number")
  .optional()
  .or(z.literal(""));

const registerSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("patient"),
    name: z.string().min(2).max(100),
    phone: optionalPhoneSchema,
  }),
  z.object({
    role: z.literal("doctor"),
    name: z.string().min(2).max(100),
    phone: optionalPhoneSchema,
    specialization: z.string().min(2).max(100),
    qualification: z.string().min(2).max(200),
    registrationNumber: z.string().min(2).max(50),
    registrationCouncil: z.string().min(2).max(100),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    recommendedByUserId: z.string().min(1).optional(),
  }),
]);

const app = new Hono<HonoEnv>();

app.post("/", zValidator("json", registerSchema), async (c) => {
  const token = getCookie(c, "session");
  if (!token) return c.json({ error: "Not authenticated" }, 401);

  const session = await getSession(c.env.SESSIONS, token);
  if (!session) return c.json({ error: "Session expired" }, 401);
  if (session.userId) return c.json({ error: "Already registered" }, 400);
  if (c.env.ADMIN_EMAIL && session.email === c.env.ADMIN_EMAIL.trim().toLowerCase()) {
    return c.json({ error: "This email is reserved for the admin account" }, 403);
  }

  const data = c.req.valid("json");
  const db = drizzle(c.env.DB);
  const now = Math.floor(Date.now() / 1000);
  const userId = ulid();
  const phone = data.phone?.trim() || null;
  let isBootstrapDoctor = false;

  if (phone) {
    const existingPhone = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).get();
    if (existingPhone) return c.json({ error: "That mobile number is already linked to another account" }, 400);
  }

  if (data.role === "doctor") {
    const verifiedDoctorCount = await countVerifiedDoctors(c.env.DB);
    const adminExists = await hasAdminAccount(c.env.DB);
    isBootstrapDoctor = verifiedDoctorCount === 0 && !adminExists;
    const needsDoctorRecommendation = verifiedDoctorCount > 0;

    if (needsDoctorRecommendation) {
      if (!data.recommendedByUserId) {
        return c.json({ error: "Please choose an existing doctor for approval" }, 400);
      }

      const recommendedByProfile = await getDoctorProfileByUserId(c.env.DB, data.recommendedByUserId);
      if (!recommendedByProfile || !recommendedByProfile.isVerified) {
        return c.json({ error: "Selected doctor cannot review new registrations right now" }, 400);
      }
    }
  }

  await db.insert(users).values({
    id: userId,
    email: session.email,
    phone,
    name: data.name,
    role: data.role,
    createdAt: now,
    updatedAt: now,
  });

  if (data.role === "doctor") {
    const baseSlug = generateDoctorSlug(data.name, data.specialization, data.city);
    const slug = `${baseSlug}-${userId.slice(-4).toLowerCase()}`;

    await db.insert(doctorProfiles).values({
      id: ulid(),
      userId,
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

    if (!isBootstrapDoctor) {
      await db.insert(doctorApprovalRequests).values({
        id: ulid(),
        doctorUserId: userId,
        recommendedByUserId: data.recommendedByUserId || null,
        status: "pending",
        requestedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  await updateSessionUserId(c.env.SESSIONS, token, userId);

  return c.json({
    success: true,
    role: data.role,
    approvalStatus: data.role === "doctor" ? (isBootstrapDoctor ? "approved" : "pending") : undefined,
  });
});

export { app as registerRoutes };
