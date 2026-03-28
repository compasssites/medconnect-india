import { getUserById } from "../db/queries";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

type PendingSession = {
  email: string;
  userId: null;
  expiresAt: number;
};

type ActiveSession = {
  userId: string;
  email: string;
  expiresAt: number;
};

type Session = PendingSession | ActiveSession;

/**
 * Creates a session after OTP verification.
 * If userId is null, it's a "pending" session (new user who hasn't set role yet).
 */
export async function createSession(
  kv: KVNamespace,
  userId: string | null,
  email: string
): Promise<string> {
  const token = generateToken();
  const session: Session = {
    userId: userId as string,
    email,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  };

  await kv.put(`session:${token}`, JSON.stringify(session), {
    expirationTtl: SESSION_TTL_SECONDS,
  });

  return token;
}

export async function getSession(kv: KVNamespace, token: string): Promise<Session | null> {
  const raw = await kv.get(`session:${token}`);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as Session;
    if (Date.now() > session.expiresAt) {
      await kv.delete(`session:${token}`);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function getSessionUser(
  kv: KVNamespace,
  db: D1Database,
  token: string
) {
  const session = await getSession(kv, token);
  if (!session || !session.userId) return null;
  return getUserById(db, session.userId);
}

export async function updateSessionUserId(
  kv: KVNamespace,
  token: string,
  userId: string
): Promise<void> {
  const session = await getSession(kv, token);
  if (!session) return;

  const updated: ActiveSession = {
    ...(session as ActiveSession),
    userId,
  };

  const ttl = Math.max(1, Math.floor((updated.expiresAt - Date.now()) / 1000));
  await kv.put(`session:${token}`, JSON.stringify(updated), {
    expirationTtl: ttl,
  });
}

export async function destroySession(kv: KVNamespace, token: string): Promise<void> {
  await kv.delete(`session:${token}`);
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
