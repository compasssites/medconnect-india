import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { setCookie, deleteCookie } from "hono/cookie";
import { sendOtpSchema, verifyOtpSchema } from "../validators/schemas";
import { generateOtp, sendOtpViaMSG91 } from "../../lib/auth/otp";
import { createSession, destroySession, getSessionUser } from "../../lib/auth/session";
import { getUserByPhone } from "../../lib/db/queries";
import type { HonoEnv } from "../index";

const app = new Hono<HonoEnv>();

// POST /api/auth/send-otp
app.post("/send-otp", zValidator("json", sendOtpSchema), async (c) => {
  const { phone } = c.req.valid("json");

  const otp = generateOtp();
  const otpKey = `otp:${phone}`;
  // Store OTP in KV with 10-minute TTL
  await c.env.SESSIONS.put(otpKey, otp, { expirationTtl: 600 });

  await sendOtpViaMSG91(c.env.MSG91_AUTH_KEY, c.env.MSG91_TEMPLATE_ID, phone, otp);

  return c.json({ success: true });
});

// POST /api/auth/verify-otp
app.post("/verify-otp", zValidator("json", verifyOtpSchema), async (c) => {
  const { phone, otp } = c.req.valid("json");

  const otpKey = `otp:${phone}`;
  const storedOtp = await c.env.SESSIONS.get(otpKey);

  if (!storedOtp || storedOtp !== otp) {
    return c.json({ error: "Invalid or expired OTP" }, 400);
  }

  await c.env.SESSIONS.delete(otpKey);

  const user = await getUserByPhone(c.env.DB, phone);
  const sessionToken = await createSession(c.env.SESSIONS, user?.id ?? null, phone);

  setCookie(c, "session", sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return c.json({
    success: true,
    isNewUser: !user,
    user: user ?? null,
  });
});

// POST /api/auth/logout
app.post("/logout", async (c) => {
  const { getCookie } = await import("hono/cookie");
  const sessionToken = getCookie(c, "session");
  if (sessionToken) {
    await destroySession(c.env.SESSIONS, sessionToken);
  }
  deleteCookie(c, "session", { path: "/" });
  return c.json({ success: true });
});

// GET /api/auth/me
app.get("/me", async (c) => {
  const { getCookie } = await import("hono/cookie");
  const sessionToken = getCookie(c, "session");
  if (!sessionToken) return c.json({ user: null });

  const user = await getSessionUser(c.env.SESSIONS, c.env.DB, sessionToken);
  return c.json({ user });
});

export { app as authRoutes };
