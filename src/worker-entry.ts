/**
 * Custom worker entrypoint.
 * Re-exports ChatRoom so wrangler can find the Durable Object class.
 * The Astro handler is the default export — added by the adapter automatically.
 */
export { ChatRoom } from "./lib/chat/ChatRoom";
