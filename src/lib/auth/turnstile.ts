type SecretValue = string | { get(): Promise<string> } | undefined;

type TurnstileEnv = {
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: SecretValue;
  TURNSTILE_ENFORCE_AFTER?: string;
};

type VerifyTurnstileOptions = {
  env: TurnstileEnv;
  token?: string;
  expectedAction?: string;
  expectedHostname?: string;
  remoteIp?: string;
};

type TurnstileVerifyResponse = {
  success: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

export const DEFAULT_TURNSTILE_ENFORCE_AFTER = "2026-04-29T00:00:00Z";

async function resolveSecret(value: SecretValue): Promise<string | undefined> {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  return value.get();
}

export function getTurnstileEnforceAfter(rawValue?: string) {
  const parsed = Date.parse(rawValue ?? "");
  if (Number.isNaN(parsed)) return DEFAULT_TURNSTILE_ENFORCE_AFTER;
  return new Date(parsed).toISOString();
}

export function isTurnstileActive(rawValue?: string, now = Date.now()) {
  return now >= Date.parse(getTurnstileEnforceAfter(rawValue));
}

export function getTurnstileClientConfig(env?: TurnstileEnv) {
  const siteKey = env?.TURNSTILE_SITE_KEY?.trim() ?? "";
  const enforceAfter = getTurnstileEnforceAfter(env?.TURNSTILE_ENFORCE_AFTER);
  return {
    siteKey,
    enforceAfter,
    enabled: Boolean(siteKey) && isTurnstileActive(enforceAfter),
  };
}

export async function verifyTurnstileToken({
  env,
  token,
  expectedAction,
  expectedHostname,
  remoteIp,
}: VerifyTurnstileOptions) {
  if (!isTurnstileActive(env.TURNSTILE_ENFORCE_AFTER)) {
    return null;
  }

  const siteKey = env.TURNSTILE_SITE_KEY?.trim();
  const secretKey = await resolveSecret(env.TURNSTILE_SECRET_KEY);

  if (!siteKey || !secretKey) {
    console.warn("Turnstile enforcement date reached, but site key or secret is missing. Skipping check.");
    return null;
  }

  if (!token) {
    return "Please complete the security check and try again.";
  }

  const formData = new FormData();
  formData.set("secret", secretKey);
  formData.set("response", token);
  if (remoteIp) formData.set("remoteip", remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    const result = (await response.json()) as TurnstileVerifyResponse;
    if (!response.ok || !result.success) {
      console.warn("Turnstile validation rejected request", result["error-codes"] ?? []);
      return "Security check failed. Please try again.";
    }

    if (expectedAction && result.action && result.action !== expectedAction) {
      console.warn("Turnstile action mismatch", { expectedAction, receivedAction: result.action });
      return "Security check failed. Please refresh and try again.";
    }

    if (expectedHostname && result.hostname && result.hostname !== expectedHostname) {
      console.warn("Turnstile hostname mismatch", { expectedHostname, receivedHostname: result.hostname });
      return "Security check failed. Please refresh and try again.";
    }

    return null;
  } catch (error) {
    console.error("Turnstile verification request failed", error);
    return "We could not verify the security check. Please try again.";
  } finally {
    clearTimeout(timeout);
  }
}
