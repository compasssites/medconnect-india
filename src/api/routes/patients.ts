import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { patientProfileSchema } from "../validators/schemas";
import { users, patientProfiles } from "../../lib/db/schema";
import { ulid } from "ulid";
import type { HonoEnv } from "../index";

const app = new Hono<HonoEnv>();

// GET /api/patients/me
app.get("/me", async (c) => {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const db = drizzle(c.env.DB);
  const profile = await db
    .select()
    .from(patientProfiles)
    .where(eq(patientProfiles.userId, user.id))
    .get();

  return c.json({ user, profile: profile ?? null });
});

// PUT /api/patients/me
app.put("/me", zValidator("json", patientProfileSchema), async (c) => {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const data = c.req.valid("json");
  const db = drizzle(c.env.DB);

  // Update name on users table
  await db
    .update(users)
    .set({ name: data.name, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(users.id, user.id));

  // Upsert patient profile
  const existing = await db
    .select()
    .from(patientProfiles)
    .where(eq(patientProfiles.userId, user.id))
    .get();

  const now = Math.floor(Date.now() / 1000);
  if (existing) {
    await db
      .update(patientProfiles)
      .set({ ...data, updatedAt: now })
      .where(eq(patientProfiles.userId, user.id));
  } else {
    await db.insert(patientProfiles).values({
      id: ulid(),
      userId: user.id,
      ...data,
      createdAt: now,
      updatedAt: now,
    });
  }

  return c.json({ success: true });
});

export { app as patientRoutes };
