/**
 * Standalone Worker for the ChatRoom Durable Object.
 * Deployed as "medconnect-chat-do" — referenced by the main medconnect worker
 * via durable_objects binding with script_name = "medconnect-chat-do".
 *
 * This worker has no fetch handler of its own — it only exports ChatRoom.
 */
export { ChatRoom } from "../src/lib/chat/ChatRoom";

// Minimal fetch handler required by wrangler
export default {
  fetch(): Response {
    return new Response("ChatRoom DO worker", { status: 200 });
  },
};
