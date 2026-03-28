import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getCookie } from "hono/cookie";
import { drizzle } from "drizzle-orm/d1";
import { ulid } from "ulid";
import { users, doctorProfiles } from "../../lib/db/schema";
import { getSession, updateSessionUserId } from "../../lib/auth/session";
import { generateDoctorSlug } from "../../lib/utils/slug";
import type { HonoEnv } from "../index";

const registerSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("patient"),
    name: z.string().min(2).max(100),
  }),
  z.object({
    role: z.literal("doctor"),
    name: z.string().min(2).max(100),
    specialization: z.string().min(2).max(100),
    qualification: z.string().min(2).max(200),
    registrationNumber: z.string().min(2).max(50),
    registrationCouncil: z.string().min(2).max(100),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
  }),
]);

const app = new Hono<HonoEnv>();

app.post("/", zValidator("json", registerSchema), async (c) => {
  const token = getCookie(c, "session");
  if (!token) return c.json({ error: "Not authenticated" }, 401);

  const session = await getSession(c.env.SESSIONS, token);
  if (!session) return c.json({ error: "Session expired" }, 401);
  if (session.userId) return c.json({ error: "Already registered" }, 400);

  const data = c.req.valid("json");
  const db = drizzle(c.env.DB);
  const now = Math.floor(Date.now() / 1000);
  const userId = ulid();

  await db.insert(users).values({
    id: userId,
    phone: session.phone,
    name: data.name,
    role: data.role,
    createdAt: now,
    updatedAt: now,
  });

  if (data.role === "doctor") {
    const baseSlug = generateDoctorSlug(data.name, data.specialization, data.city);
    // Ensure slug uniqueness by appending part of ULID if needed
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
      createdAt: now,
      updatedAt: now,
    });
  }

  await updateSessionUserId(c.env.SESSIONS, token, userId);

  return c.json({ success: true, role: data.role });
});

export { app as registerRoutes };
