import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { sendOtpSchema, verifyOtpSchema } from "../validators/schemas";
import { generateOtp, sendOtp } from "../../lib/auth/otp";
import { createSession, destroySession, getSessionUser } from "../../lib/auth/session";
import { getUserByEmail } from "../../lib/db/queries";
import type { HonoEnv } from "../index";

const app = new Hono<HonoEnv>();

// POST /api/auth/send-otp
app.post("/send-otp", zValidator("json", sendOtpSchema), async (c) => {
  const { email } = c.req.valid("json");
  const normalizedEmail = email.trim().toLowerCase();

  const otp = generateOtp();
  await c.env.SESSIONS.put(`otp:${normalizedEmail}`, otp, { expirationTtl: 600 });

  const { devOtp } = await sendOtp(normalizedEmail, otp, c.env);

  const hasEmailProvider = Boolean(
    c.env.AWS_ACCESS_KEY_ID && c.env.AWS_SECRET_ACCESS_KEY && c.env.AWS_REGION && c.env.AWS_SES_FROM_EMAIL
  );
  return c.json({ success: true, ...(hasEmailProvider ? {} : { otp: devOtp }) });
});

// POST /api/auth/verify-otp
app.post("/verify-otp", zValidator("json", verifyOtpSchema), async (c) => {
  const { email, otp } = c.req.valid("json");
  const normalizedEmail = email.trim().toLowerCase();

  const storedOtp = await c.env.SESSIONS.get(`otp:${normalizedEmail}`);
  if (!storedOtp || storedOtp !== otp) {
    return c.json({ error: "Invalid or expired OTP" }, 400);
  }
  await c.env.SESSIONS.delete(`otp:${normalizedEmail}`);

  const user = await getUserByEmail(c.env.DB, normalizedEmail);
  const sessionToken = await createSession(c.env.SESSIONS, user?.id ?? null, normalizedEmail);

  setCookie(c, "session", sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return c.json({ success: true, isNewUser: !user, user: user ?? null });
});

// POST /api/auth/logout
app.post("/logout", async (c) => {
  const sessionToken = getCookie(c, "session");
  if (sessionToken) await destroySession(c.env.SESSIONS, sessionToken);
  deleteCookie(c, "session", { path: "/" });
  return c.json({ success: true });
});

// GET /api/auth/me
app.get("/me", async (c) => {
  const sessionToken = getCookie(c, "session");
  if (!sessionToken) return c.json({ user: null });
  const user = await getSessionUser(c.env.SESSIONS, c.env.DB, sessionToken);
  return c.json({ user });
});

export { app as authRoutes };
