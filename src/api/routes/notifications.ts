import { Hono } from "hono";
import { markNotificationRead, markAllNotificationsRead, listNotificationsForUser, countUnreadNotifications } from "../../lib/notifications";
import type { HonoEnv } from "../index";

const app = new Hono<HonoEnv>();

app.get("/", async (c) => {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const limit = Math.max(1, Math.min(25, Number(c.req.query("limit") || "12")));
  const items = await listNotificationsForUser(c.env.DB, user.id, limit);
  const unreadCount = await countUnreadNotifications(c.env.DB, user.id);
  return c.json({ notifications: items, unreadCount });
});

app.post("/read-all", async (c) => {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  await markAllNotificationsRead(c.env.DB, user.id);
  return c.json({ success: true });
});

app.post("/:id/read", async (c) => {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  await markNotificationRead(c.env.DB, user.id, c.req.param("id"));
  return c.json({ success: true });
});

app.get("/stream", async (c) => {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const encoder = new TextEncoder();
  let active = true;
  const sendSnapshot = async (controller: ReadableStreamDefaultController<Uint8Array>) => {
    const [items, unreadCount] = await Promise.all([
      listNotificationsForUser(c.env.DB, user.id, 8),
      countUnreadNotifications(c.env.DB, user.id),
    ]);
    controller.enqueue(
      encoder.encode(`event: snapshot\ndata: ${JSON.stringify({ notifications: items, unreadCount })}\n\n`)
    );
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const signal = c.req.raw.signal;
      signal.addEventListener("abort", () => {
        active = false;
        try {
          controller.close();
        } catch {}
      });

      await sendSnapshot(controller);
      while (active && !signal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, 12000));
        if (!active || signal.aborted) break;
        await sendSnapshot(controller);
      }
    },
    cancel() {
      active = false;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});

export { app as notificationRoutes };
