export const PASSWORD_ITERATION_LIMIT = 100_000;
const PASSWORD_ITERATIONS = PASSWORD_ITERATION_LIMIT;
const PASSWORD_KEY_LENGTH = 32;

function encodeBase64(value: Uint8Array) {
  return Buffer.from(value).toString("base64");
}

function decodeBase64(value: string) {
  return new Uint8Array(Buffer.from(value, "base64"));
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    PASSWORD_KEY_LENGTH * 8
  );

  return new Uint8Array(bits);
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index] ^ right[index];
  }
  return mismatch === 0;
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveKey(password, salt, PASSWORD_ITERATIONS);

  return {
    hash: encodeBase64(hash),
    salt: encodeBase64(salt),
    iterations: PASSWORD_ITERATIONS,
    updatedAt: Math.floor(Date.now() / 1000),
  };
}

export async function verifyPassword(
  password: string,
  expectedHash: string,
  salt: string,
  iterations = PASSWORD_ITERATIONS
) {
  const derivedHash = await deriveKey(password, decodeBase64(salt), iterations);
  return timingSafeEqual(derivedHash, decodeBase64(expectedHash));
}

export function isSupportedPasswordIterations(iterations?: number | null) {
  return !iterations || iterations <= PASSWORD_ITERATION_LIMIT;
}
