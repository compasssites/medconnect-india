/**
 * Custom Cloudflare Worker entrypoint.
 *
 * This replaces @astrojs/cloudflare/entrypoints/server.js.
 * It must export createExports (called by the adapter-generated index.js)
 * AND export ChatRoom so wrangler can register the Durable Object class.
 */
import { App } from "astro/app";
import { handle } from "@astrojs/cloudflare/handler";
import type { SSRManifest } from "astro";

export function createExports(manifest: SSRManifest) {
  const app = new App(manifest);
  const fetch = async (
    request: Request,
    env: unknown,
    context: ExecutionContext
  ) => {
    return await handle(manifest, app, request, env, context);
  };
  return { default: { fetch } };
}

// Export the Durable Object class so wrangler can register it
export { ChatRoom } from "./lib/chat/ChatRoom";
