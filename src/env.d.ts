/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

type SecretStoreBinding = {
  get(): Promise<string>;
};

type Bindings = {
  DB: D1Database;
  FILES: R2Bucket;
  SESSIONS: KVNamespace;
  CHAT_ROOMS: DurableObjectNamespace;
  AWS_SES_ACCESS_KEY_ID?: string | SecretStoreBinding;
  AWS_SES_SECRET_ACCESS_KEY?: string | SecretStoreBinding;
  AWS_SES_REGION?: string | SecretStoreBinding;
  SES_FROM_EMAIL?: string | SecretStoreBinding;
  AWS_ACCESS_KEY_ID?: string | SecretStoreBinding;
  AWS_SECRET_ACCESS_KEY?: string | SecretStoreBinding;
  AWS_REGION?: string | SecretStoreBinding;
  AWS_SES_FROM_EMAIL?: string | SecretStoreBinding;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string | SecretStoreBinding;
  TURNSTILE_ENFORCE_AFTER?: string;
  SESSION_SECRET: string;
  ADMIN_EMAIL?: string;
  APP_URL: string;
};

declare namespace App {
  interface Locals {
    runtime: {
      env: Bindings;
    };
    user?: {
      id: string;
      email: string;
      phone?: string | null;
      name: string;
      role: "doctor" | "patient" | "admin";
    };
  }
}
