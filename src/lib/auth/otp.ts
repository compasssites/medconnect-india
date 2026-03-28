/**
 * OTP generation — KV-based, no SMS dependency.
 *
 * MVP mode: OTP is returned in the API response and shown on screen.
 * Production: swap sendOtp to call MSG91/Twilio — the KV storage and
 * verify flow don't need to change at all.
 */

export function generateOtp(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1_000_000).padStart(6, "0");
}

/**
 * No-op in MVP — returns the OTP so the API can echo it back.
 * Replace this body with a real SMS call when ready.
 */
export async function sendOtp(
  _phone: string,
  otp: string,
  _env?: { MSG91_AUTH_KEY?: string; MSG91_TEMPLATE_ID?: string }
): Promise<{ devOtp: string }> {
  // TODO: swap with MSG91/Twilio call in production
  // await sendOtpViaMSG91(env.MSG91_AUTH_KEY, env.MSG91_TEMPLATE_ID, _phone, otp);
  return { devOtp: otp };
}
