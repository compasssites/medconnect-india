import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth";
import { registerRoutes } from "./routes/register";
import { doctorRoutes } from "./routes/doctors";
import { doctorProfileRoutes } from "./routes/doctorProfile";
import { patientRoutes } from "./routes/patients";
import { consultationRoutes } from "./routes/consultation";
import { uploadRoutes } from "./routes/upload";
import { authMiddleware } from "./middleware/auth";
import type { ChatRoom } from "../lib/chat/ChatRoom";

type SecretStoreBinding = {
  get(): Promise<string>;
};

type Bindings = {
  DB: D1Database;
  FILES: R2Bucket;
  SESSIONS: KVNamespace;
  CHAT_ROOMS: DurableObjectNamespace<ChatRoom>;
  AWS_SES_ACCESS_KEY_ID?: string | SecretStoreBinding;
  AWS_SES_SECRET_ACCESS_KEY?: string | SecretStoreBinding;
  AWS_SES_REGION?: string | SecretStoreBinding;
  SES_FROM_EMAIL?: string | SecretStoreBinding;
  AWS_ACCESS_KEY_ID?: string | SecretStoreBinding;
  AWS_SECRET_ACCESS_KEY?: string | SecretStoreBinding;
  AWS_REGION?: string | SecretStoreBinding;
  AWS_SES_FROM_EMAIL?: string | SecretStoreBinding;
  SESSION_SECRET: string;
  APP_URL: string;
};

export type HonoEnv = { Bindings: Bindings };

const app = new Hono<HonoEnv>();

app.use("/api/*", cors({ origin: "*", credentials: true }));

// Public routes
app.route("/api/auth", authRoutes);
app.route("/api/auth/register", registerRoutes);
app.route("/api/doctors", doctorRoutes);

// Protected routes
app.use("/api/consultation/*", authMiddleware);
app.use("/api/upload/*", authMiddleware);
app.use("/api/patients/*", authMiddleware);
app.use("/api/chat/*", authMiddleware);

app.route("/api/consultation", consultationRoutes);
app.route("/api/upload", uploadRoutes);
app.route("/api/patients", patientRoutes);
app.use("/api/doctors/profile", authMiddleware);
app.use("/api/doctors/availability", authMiddleware);
app.use("/api/doctors/approvals/*", authMiddleware);
app.route("/api/doctors", doctorProfileRoutes);

// WebSocket upgrade — proxy to ChatRoom Durable Object
app.get("/api/chat/:consultationId", async (c) => {
  const consultationId = c.req.param("consultationId");
  const id = c.env.CHAT_ROOMS.idFromName(consultationId);
  const stub = c.env.CHAT_ROOMS.get(id);
  return stub.fetch(c.req.raw);
});

export { app };
