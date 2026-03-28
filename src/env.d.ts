/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

type Bindings = {
  DB: D1Database;
  FILES: R2Bucket;
  SESSIONS: KVNamespace;
  CHAT_ROOMS: DurableObjectNamespace;
  MSG91_AUTH_KEY: string;
  MSG91_TEMPLATE_ID: string;
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
      phone: string;
      name: string;
      role: "doctor" | "patient";
    };
  }
}
