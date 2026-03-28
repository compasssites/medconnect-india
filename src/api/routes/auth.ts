import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { sendOtpSchema, verifyOtpSchema } from "../validators/schemas";
import { generateOtp, sendOtp } from "../../lib/auth/otp";
import { createSession, destroySession, getSessionUser } from "../../lib/auth/session";
import { getUserByPhone } from "../../lib/db/queries";
import type { HonoEnv } from "../index";

const app = new Hono<HonoEnv>();

// POST /api/auth/send-otp
// MVP: returns { success, otp } — otp is shown on screen instead of sent via SMS.
// When MSG91_AUTH_KEY is set in production, swap sendOtp() to call MSG91 and stop returning otp.
app.post("/send-otp", zValidator("json", sendOtpSchema), async (c) => {
  const { phone } = c.req.valid("json");

  const otp = generateOtp();
  await c.env.SESSIONS.put(`otp:${phone}`, otp, { expirationTtl: 600 });

  const { devOtp } = await sendOtp(phone, otp);

  // Always return success. Return devOtp only when no SMS key configured (MVP/dev).
  const hasSms = Boolean(c.env.MSG91_AUTH_KEY);
  return c.json({ success: true, ...(hasSms ? {} : { otp: devOtp }) });
});

// POST /api/auth/verify-otp
app.post("/verify-otp", zValidator("json", verifyOtpSchema), async (c) => {
  const { phone, otp } = c.req.valid("json");

  const storedOtp = await c.env.SESSIONS.get(`otp:${phone}`);
  if (!storedOtp || storedOtp !== otp) {
    return c.json({ error: "Invalid or expired OTP" }, 400);
  }
  await c.env.SESSIONS.delete(`otp:${phone}`);

  const user = await getUserByPhone(c.env.DB, phone);
  const sessionToken = await createSession(c.env.SESSIONS, user?.id ?? null, phone);

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
