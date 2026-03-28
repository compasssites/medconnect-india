/**
 * Durable Object export for wrangler.
 * The ChatRoom class must be exported from the Worker entrypoint.
 * When using Astro's Cloudflare adapter, export it from this file
 * and reference it in wrangler.toml if needed as a separate worker,
 * OR export it alongside the main worker handler.
 *
 * With Astro's Cloudflare adapter, the _worker.js is auto-generated.
 * Durable Objects must be re-exported from it — the adapter handles this
 * when the class is imported anywhere in the build graph.
 *
 * Ensure src/lib/chat/ChatRoom.ts is imported by at least one page/route
 * so it ends up in the bundle (it is imported by src/api/index.ts).
 */
export { ChatRoom } from "../src/lib/chat/ChatRoom";
