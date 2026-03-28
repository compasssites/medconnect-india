import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { deleteCookie, getCookie } from "hono/cookie";
import { sendOtpSchema, verifyOtpSchema } from "../validators/schemas";
import { generateOtp, sendOtp } from "../../lib/auth/otp";
import { createSession, destroySession, getSessionUser } from "../../lib/auth/session";
import { getUserByEmail } from "../../lib/db/queries";
import type { HonoEnv } from "../index";

const app = new Hono<HonoEnv>();

async function hasEmailProviderConfigured(env: HonoEnv["Bindings"]) {
  const maybeGet = async (value: unknown) => {
    if (!value) return undefined;
    if (typeof value === "string") return value;
    if (typeof value === "object" && value !== null && "get" in value && typeof (value as { get: unknown }).get === "function") {
      return (value as { get(): Promise<string> }).get();
    }
    return undefined;
  };

  const [accessKeyId, secretAccessKey, region, from] = await Promise.all([
    maybeGet(env.AWS_SES_ACCESS_KEY_ID ?? env.AWS_ACCESS_KEY_ID),
    maybeGet(env.AWS_SES_SECRET_ACCESS_KEY ?? env.AWS_SECRET_ACCESS_KEY),
    maybeGet(env.AWS_SES_REGION ?? env.AWS_REGION),
    maybeGet(env.SES_FROM_EMAIL ?? env.AWS_SES_FROM_EMAIL),
  ]);

  return Boolean(accessKeyId && secretAccessKey && region && from);
}

// POST /api/auth/send-otp
app.post("/send-otp", zValidator("json", sendOtpSchema), async (c) => {
  const { email } = c.req.valid("json");
  const normalizedEmail = email.trim().toLowerCase();

  const otp = generateOtp();
  await c.env.SESSIONS.put(`otp:${normalizedEmail}`, otp, { expirationTtl: 600 });

  const { devOtp } = await sendOtp(normalizedEmail, otp, c.env);

  const hasEmailProvider = await hasEmailProviderConfigured(c.env);
  return c.json({ success: true, ...(hasEmailProvider ? {} : { otp: devOtp }) });
});

// POST /api/auth/verify-otp
app.post("/verify-otp", zValidator("json", verifyOtpSchema), async (c) => {
  const { email, otp } = c.req.valid("json");
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedOtp = otp.replace(/\D/g, "").slice(0, 6);

  const storedOtp = await c.env.SESSIONS.get(`otp:${normalizedEmail}`);
  if (!storedOtp || storedOtp !== normalizedOtp) {
    return c.json({ error: "Invalid or expired OTP" }, 400);
  }
  await c.env.SESSIONS.delete(`otp:${normalizedEmail}`);

  const user = await getUserByEmail(c.env.DB, normalizedEmail);
  const sessionToken = await createSession(c.env.SESSIONS, user?.id ?? null, normalizedEmail);

  return c.json({
    success: true,
    isNewUser: !user,
    user: user ?? null,
    sessionToken,
  });
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
