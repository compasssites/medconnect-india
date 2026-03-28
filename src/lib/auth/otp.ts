/**
 * OTP generation and delivery via MSG91.
 * MSG91 docs: https://docs.msg91.com/reference/send-otp
 */

export function generateOtp(): string {
  // 6-digit OTP — crypto.getRandomValues for edge-safe randomness
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1_000_000).padStart(6, "0");
}

export async function sendOtpViaMSG91(
  authKey: string,
  templateId: string,
  phone: string, // +91XXXXXXXXXX
  otp: string
): Promise<void> {
  // MSG91 expects phone without leading +
  const mobile = phone.startsWith("+") ? phone.slice(1) : phone;

  const payload = {
    template_id: templateId,
    mobile,
    authkey: authKey,
    otp,
  };

  const res = await fetch("https://control.msg91.com/api/v5/otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "unknown error");
    throw new Error(`MSG91 error ${res.status}: ${body}`);
  }
}

export async function verifyOtpViaMSG91(
  authKey: string,
  phone: string,
  otp: string
): Promise<boolean> {
  const mobile = phone.startsWith("+") ? phone.slice(1) : phone;

  const url = new URL("https://control.msg91.com/api/v5/otp/verify");
  url.searchParams.set("authkey", authKey);
  url.searchParams.set("mobile", mobile);
  url.searchParams.set("otp", otp);

  const res = await fetch(url.toString());
  const body = await res.json<{ type: string }>();
  return body?.type === "success";
}
