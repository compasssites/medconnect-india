/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

type Bindings = {
  DB: D1Database;
  FILES: R2Bucket;
  SESSIONS: KVNamespace;
  CHAT_ROOMS: DurableObjectNamespace;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
  AWS_SES_FROM_EMAIL?: string;
  SESSION_SECRET: string;
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
      role: "doctor" | "patient";
    };
  }
}
