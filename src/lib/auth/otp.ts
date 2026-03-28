import { AwsClient } from "aws4fetch";

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

export async function sendOtp(
  email: string,
  otp: string,
  env?: OtpEmailEnv
): Promise<{ devOtp: string }> {
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
    return { devOtp: otp };
  }

  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "ses",
    region,
  });

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
          Subject: {
            Data: "Your MedConnect sign-in code",
            Charset: "UTF-8",
          },
          Body: {
            Text: {
              Data: `Your MedConnect sign-in code is ${otp}. It expires in 10 minutes.`,
              Charset: "UTF-8",
            },
            Html: {
              Data: `<html><body style="font-family:Arial,sans-serif;color:#0f172a"><p>Your MedConnect sign-in code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:0.24em;margin:16px 0">${otp}</p><p>This code expires in 10 minutes.</p></body></html>`,
              Charset: "UTF-8",
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to send OTP email: ${message}`);
  }

  return { devOtp: "" };
}
