import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { getUserById } from "../../lib/db/queries";
import type { HonoEnv } from "../index";

export const authMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  const sessionToken = getCookie(c, "session");
  if (!sessionToken) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const sessionJson = await c.env.SESSIONS.get(`session:${sessionToken}`);
  if (!sessionJson) {
    return c.json({ error: "Session expired" }, 401);
  }

  let session: { userId: string; expiresAt: number };
  try {
    session = JSON.parse(sessionJson);
  } catch {
    return c.json({ error: "Invalid session" }, 401);
  }

  if (Date.now() > session.expiresAt) {
    await c.env.SESSIONS.delete(`session:${sessionToken}`);
    return c.json({ error: "Session expired" }, 401);
  }

  const user = await getUserById(c.env.DB, session.userId);
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }

  // Attach user to context
  c.set("user" as never, user);
  await next();
});
