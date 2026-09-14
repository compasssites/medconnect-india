import { AwsClient } from "aws4fetch";

// Email sender — supports AWS SES and Cloudflare Email Routing behind one switch.
// MAIL_PROVIDER env var: "cloudflare" | "ses" | "auto" (default: "cloudflare" during the
// 2026-09 SES quota-abuse incident). Flip back to "ses" once AWS SES recovers — no code change.
// Cloudflare send uses the native `send_email` Worker binding (EMAIL), already verified for
// mycompass.in via Email Routing (proven in production by other Compass apps).

type SecretValue = string | { get(): Promise<string> } | undefined;

type OtpEmailEnv = {
  AWS_SES_ACCESS_KEY_ID?: SecretValue;
  AWS_SES_SECRET_ACCESS_KEY?: SecretValue;
  AWS_SES_REGION?: SecretValue;
  SES_FROM_EMAIL?: SecretValue;
  AWS_ACCESS_KEY_ID?: SecretValue;
  AWS_SECRET_ACCESS_KEY?: SecretValue;
  AWS_REGION?: SecretValue;
  AWS_SES_FROM_EMAIL?: SecretValue;
  MAIL_PROVIDER?: string;
  EMAIL?: { send(message: Record<string, unknown>): Promise<unknown> };
};

async function resolveSecret(value: SecretValue): Promise<string | undefined> {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  return value.get();
}

export function generateOtp(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1_000_000).padStart(6, "0");
}

class SesProviderError extends Error {
  constructor(message: string, public isProviderLevel: boolean) {
    super(message);
  }
}

// Quota/throttle/pause/availability failures are provider-level (safe to fall back to
// Cloudflare in "auto" mode). Validation errors (bad recipient, malformed message) are not.
function classifySesError(status: number, body: string): boolean {
  if (status === 401 || status === 403 || status === 429 || status >= 500) return true;
  return /Throttling|SendingPausedException|AccountSuspended|TooManyRequestsException|LimitExceeded|ServiceUnavailable/i.test(body);
}

function otpContent(otp: string) {
  return {
    subject: "Your MedConnect verification code",
    text: `Your MedConnect verification code is ${otp}. It expires in 10 minutes.`,
    html: `<html><body style="font-family:Arial,sans-serif;color:#0f172a"><p>Your MedConnect verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:0.24em;margin:16px 0">${otp}</p><p>This code expires in 10 minutes.</p></body></html>`,
  };
}

async function sendOtpViaSes(email: string, otp: string, env: OtpEmailEnv): Promise<boolean> {
  const accessKeyId =
    (await resolveSecret(env?.AWS_SES_ACCESS_KEY_ID)) ??
    (await resolveSecret(env?.AWS_ACCESS_KEY_ID));
  const secretAccessKey =
    (await resolveSecret(env?.AWS_SES_SECRET_ACCESS_KEY)) ??
    (await resolveSecret(env?.AWS_SECRET_ACCESS_KEY));
  const region =
    (await resolveSecret(env?.AWS_SES_REGION)) ??
    (await resolveSecret(env?.AWS_REGION));
  const from =
    (await resolveSecret(env?.SES_FROM_EMAIL)) ??
    (await resolveSecret(env?.AWS_SES_FROM_EMAIL));

  if (!accessKeyId || !secretAccessKey || !region || !from) {
    return false;
  }

  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "ses",
    region,
  });

  const { subject, text, html } = otpContent(otp);
  const response = await client.fetch(`https://email.${region}.amazonaws.com/v2/email/outbound-emails`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      FromEmailAddress: from,
      Destination: {
        ToAddresses: [email],
      },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Text: { Data: text, Charset: "UTF-8" },
            Html: { Data: html, Charset: "UTF-8" },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new SesProviderError(`Failed to send verification email: ${message}`, classifySesError(response.status, message));
  }

  return true;
}

async function sendOtpViaCloudflare(email: string, otp: string, env: OtpEmailEnv): Promise<boolean> {
  if (!env.EMAIL) return false;
  const from =
    (await resolveSecret(env?.SES_FROM_EMAIL)) ??
    (await resolveSecret(env?.AWS_SES_FROM_EMAIL)) ??
    "forms@mycompass.in";
  const { subject, text, html } = otpContent(otp);
  await env.EMAIL.send({
    from: { name: "MedConnect", email: from },
    to: email,
    subject,
    text,
    html,
  });
  return true;
}

export async function sendOtp(
  email: string,
  otp: string,
  env?: OtpEmailEnv
): Promise<{ devOtp: string }> {
  if (!env) return { devOtp: otp };

  // MAIL_PROVIDER names the PRIMARY; the other provider is always the backup, so a
  // bad day on either side never stops a login code. One fallback attempt only.
  const provider = env.MAIL_PROVIDER || "cloudflare";

  if (provider === "ses" || provider === "auto") {
    try {
      const sent = await sendOtpViaSes(email, otp, env);
      if (sent) return { devOtp: "" };
    } catch (err) {
      // Only provider-level SES failures (quota/throttle/pause) fall through —
      // a bad recipient would fail on Cloudflare too.
      if (!(err instanceof SesProviderError && err.isProviderLevel)) throw err;
      console.warn("[email] SES failed, failing over to Cloudflare:", String(err));
    }
    const sent = await sendOtpViaCloudflare(email, otp, env);
    return { devOtp: sent ? "" : otp };
  }

  try {
    const sent = await sendOtpViaCloudflare(email, otp, env);
    if (sent) return { devOtp: "" };
  } catch (err) {
    // Cloudflare-side failures (binding missing, sender not allowed, daily cap)
    // aren't distinguishable from here — hand the message to SES.
    console.warn("[email] Cloudflare failed, failing over to SES:", String(err));
  }
  const sent = await sendOtpViaSes(email, otp, env);
  return { devOtp: sent ? "" : otp };
}
