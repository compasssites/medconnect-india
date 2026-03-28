import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { users, doctorProfiles } from "../../lib/db/schema";
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

export { app as doctorProfileRoutes };
