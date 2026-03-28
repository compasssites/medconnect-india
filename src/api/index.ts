import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth";
import { doctorRoutes } from "./routes/doctors";
import { patientRoutes } from "./routes/patients";
import { consultationRoutes } from "./routes/consultation";
import { uploadRoutes } from "./routes/upload";
import { authMiddleware } from "./middleware/auth";
import type { ChatRoom } from "../lib/chat/ChatRoom";

type Bindings = {
  DB: D1Database;
  FILES: R2Bucket;
  SESSIONS: KVNamespace;
  CHAT_ROOMS: DurableObjectNamespace<ChatRoom>;
  MSG91_AUTH_KEY: string;
  MSG91_TEMPLATE_ID: string;
  SESSION_SECRET: string;
  APP_URL: string;
};

export type HonoEnv = { Bindings: Bindings };

const app = new Hono<HonoEnv>();

app.use("/api/*", cors({ origin: "*", credentials: true }));

// Public routes
app.route("/api/auth", authRoutes);
app.route("/api/doctors", doctorRoutes);

// Protected routes
app.use("/api/consultation/*", authMiddleware);
app.use("/api/upload/*", authMiddleware);
app.use("/api/patients/*", authMiddleware);
app.use("/api/chat/*", authMiddleware);

app.route("/api/consultation", consultationRoutes);
app.route("/api/upload", uploadRoutes);
app.route("/api/patients", patientRoutes);

// WebSocket upgrade — proxy to ChatRoom Durable Object
app.get("/api/chat/:consultationId", async (c) => {
  const consultationId = c.req.param("consultationId");
  const id = c.env.CHAT_ROOMS.idFromName(consultationId);
  const stub = c.env.CHAT_ROOMS.get(id);
  return stub.fetch(c.req.raw);
});

export { app };
