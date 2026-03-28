import { Hono } from "hono";
import { ulid } from "ulid";
import type { HonoEnv } from "../index";

const app = new Hono<HonoEnv>();

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_SIZE_MB = 20;

// POST /api/upload
app.post("/", async (c) => {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return c.json({ error: "No file provided" }, 400);
  if (!ALLOWED_TYPES.has(file.type)) {
    return c.json({ error: "File type not allowed" }, 400);
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return c.json({ error: `File too large (max ${MAX_SIZE_MB}MB)` }, 400);
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const key = `uploads/${user.id}/${ulid()}.${ext}`;

  await c.env.FILES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: {
      uploadedBy: user.id,
      originalName: file.name,
    },
  });

  return c.json({ key, url: `/api/files/${key}` }, 201);
});

// GET /api/upload/:key* — serve file from R2
app.get("/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const obj = await c.env.FILES.get(key);
  if (!obj) return c.json({ error: "Not found" }, 404);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=3600");

  return new Response(obj.body, { headers });
});

export { app as uploadRoutes };
