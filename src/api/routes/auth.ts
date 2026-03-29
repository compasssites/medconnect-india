import { Hono } from "hono";
import type { Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { deleteCookie, getCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  loginSchema,
  resetPasswordSchema,
  sendCodeSchema,
  verifyCodeSchema,
} from "../validators/schemas";
import { generateOtp, sendOtp } from "../../lib/auth/otp";
import {
  hashPassword,
  isSupportedPasswordIterations,
  verifyPassword,
} from "../../lib/auth/password";
import { createSession, destroySession, getSessionUser } from "../../lib/auth/session";
import { verifyTurnstileToken } from "../../lib/auth/turnstile";
import { getUserAuthByEmail, getUserByEmail } from "../../lib/db/queries";
import { users } from "../../lib/db/schema";
import type { HonoEnv } from "../index";

const app = new Hono<HonoEnv>();
const CODE_TTL_SECONDS = 60 * 10;

async function hasEmailProviderConfigured(env: HonoEnv["Bindings"]) {
  const maybeGet = async (value: unknown) => {
    if (!value) return undefined;
    if (typeof value === "string") return value;
    if (
      typeof value === "object" &&
      value !== null &&
      "get" in value &&
      typeof (value as { get: unknown }).get === "function"
    ) {
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

function setSessionCookie(c: Context<HonoEnv>, token: string) {
  c.header(
    "Set-Cookie",
    `session=${encodeURIComponent(token)}; Max-Age=${60 * 60 * 24 * 30}; Path=/; SameSite=Lax; Secure; HttpOnly`
  );
}

function getCodeKey(purpose: "register" | "reset-password", email: string) {
  return `auth-code:${purpose}:${email}`;
}

async function sendEmailCode(
  env: HonoEnv["Bindings"],
  purpose: "register" | "reset-password",
  email: string
) {
  const code = generateOtp();
  await env.SESSIONS.put(getCodeKey(purpose, email), code, { expirationTtl: CODE_TTL_SECONDS });
  const { devOtp } = await sendOtp(email, code, env);
  const hasEmailProvider = await hasEmailProviderConfigured(env);
  return hasEmailProvider ? {} : { code: devOtp };
}

async function ensureTurnstile(
  c: Context<HonoEnv>,
  token: string | undefined,
  action: "login" | "register" | "reset-password"
) {
  const error = await verifyTurnstileToken({
    env: c.env,
    token,
    expectedAction: action,
    expectedHostname: new URL(c.req.url).hostname,
    remoteIp: c.req.header("CF-Connecting-IP") ?? undefined,
  });

  if (error) {
    return c.json({ error }, 400);
  }

  return null;
}

// POST /api/auth/login
app.post("/login", zValidator("json", loginSchema), async (c) => {
  try {
    const { email, password, turnstileToken } = c.req.valid("json");
    const turnstileResponse = await ensureTurnstile(c, turnstileToken, "login");
    if (turnstileResponse) return turnstileResponse;

    const normalizedEmail = email.trim().toLowerCase();
    const user = await getUserAuthByEmail(c.env.DB, normalizedEmail);

    if (!user) {
      return c.json({ error: "Invalid email or password" }, 400);
    }

    if (!user.passwordHash || !user.passwordSalt) {
      return c.json({ error: "Password not set yet. Use Forgot password to create one." }, 400);
    }

    if (!isSupportedPasswordIterations(user.passwordIterations)) {
      return c.json(
        { error: "This password needs a one-time reset. Use Forgot password to set a new one." },
        400
      );
    }

    const isValidPassword = await verifyPassword(
      password,
      user.passwordHash,
      user.passwordSalt,
      user.passwordIterations ?? undefined
    );

    if (!isValidPassword) {
      return c.json({ error: "Invalid email or password" }, 400);
    }

    const sessionToken = await createSession(c.env.SESSIONS, user.id, normalizedEmail);
    setSessionCookie(c, sessionToken);

    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error("login failed", error);
    return c.json(
      {
        error: error instanceof Error ? `Sign-in failed: ${error.message}` : "Sign-in failed",
      },
      500
    );
  }
});

// POST /api/auth/send-registration-code
app.post("/send-registration-code", zValidator("json", sendCodeSchema), async (c) => {
  const { email, turnstileToken } = c.req.valid("json");
  const turnstileResponse = await ensureTurnstile(c, turnstileToken, "register");
  if (turnstileResponse) return turnstileResponse;

  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail === c.env.ADMIN_EMAIL?.trim().toLowerCase()) {
    return c.json({ error: "Use sign in or password reset for the admin account" }, 400);
  }

  const existingUser = await getUserByEmail(c.env.DB, normalizedEmail);
  if (existingUser) {
    return c.json({ error: "An account already exists for this email. Sign in instead." }, 400);
  }

  const payload = await sendEmailCode(c.env, "register", normalizedEmail);
  return c.json({ success: true, ...payload });
});

// POST /api/auth/verify-registration-code
app.post("/verify-registration-code", zValidator("json", verifyCodeSchema), async (c) => {
  try {
    const { email, code } = c.req.valid("json");
    const normalizedEmail = email.trim().toLowerCase();

    const storedCode = await c.env.SESSIONS.get(getCodeKey("register", normalizedEmail));
    if (!storedCode || storedCode !== code) {
      return c.json({ error: "Invalid or expired code" }, 400);
    }

    const existingUser = await getUserByEmail(c.env.DB, normalizedEmail);
    if (existingUser) {
      await c.env.SESSIONS.delete(getCodeKey("register", normalizedEmail));
      return c.json({ error: "An account already exists for this email. Sign in instead." }, 400);
    }

    await c.env.SESSIONS.delete(getCodeKey("register", normalizedEmail));
    const sessionToken = await createSession(c.env.SESSIONS, null, normalizedEmail);
    setSessionCookie(c, sessionToken);

    return c.json({ success: true });
  } catch (error) {
    console.error("verify-registration-code failed", error);
    return c.json(
      {
        error: error instanceof Error ? `Verification failed: ${error.message}` : "Verification failed",
      },
      500
    );
  }
});

// POST /api/auth/send-reset-code
app.post("/send-reset-code", zValidator("json", sendCodeSchema), async (c) => {
  const { email, turnstileToken } = c.req.valid("json");
  const turnstileResponse = await ensureTurnstile(c, turnstileToken, "reset-password");
  if (turnstileResponse) return turnstileResponse;

  const normalizedEmail = email.trim().toLowerCase();
  const user = await getUserByEmail(c.env.DB, normalizedEmail);

  if (!user) {
    return c.json({ error: "No account found for this email" }, 404);
  }

  const payload = await sendEmailCode(c.env, "reset-password", normalizedEmail);
  return c.json({ success: true, ...payload });
});

// POST /api/auth/reset-password
app.post("/reset-password", zValidator("json", resetPasswordSchema), async (c) => {
  try {
    const { email, code, password } = c.req.valid("json");
    const normalizedEmail = email.trim().toLowerCase();

    const storedCode = await c.env.SESSIONS.get(getCodeKey("reset-password", normalizedEmail));
    if (!storedCode || storedCode !== code) {
      return c.json({ error: "Invalid or expired code" }, 400);
    }

    const user = await getUserByEmail(c.env.DB, normalizedEmail);
    if (!user) {
      await c.env.SESSIONS.delete(getCodeKey("reset-password", normalizedEmail));
      return c.json({ error: "No account found for this email" }, 404);
    }

    const passwordData = await hashPassword(password);
    const now = Math.floor(Date.now() / 1000);
    const db = drizzle(c.env.DB);

    await db
      .update(users)
      .set({
        passwordHash: passwordData.hash,
        passwordSalt: passwordData.salt,
        passwordIterations: passwordData.iterations,
        passwordUpdatedAt: now,
        emailVerifiedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    await c.env.SESSIONS.delete(getCodeKey("reset-password", normalizedEmail));

    const sessionToken = await createSession(c.env.SESSIONS, user.id, normalizedEmail);
    setSessionCookie(c, sessionToken);

    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error("reset-password failed", error);
    return c.json(
      {
        error: error instanceof Error ? `Reset failed: ${error.message}` : "Reset failed",
      },
      500
    );
  }
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
