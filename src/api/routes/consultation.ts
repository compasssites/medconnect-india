import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  createConsultationSchema,
  acceptConsultationSchema,
  rejectConsultationSchema,
} from "../validators/schemas";
import { consultations } from "../../lib/db/schema";
import {
  getConsultationById,
  getConsultationsForDoctor,
  getConsultationsForPatient,
} from "../../lib/db/queries";
import { ulid } from "ulid";
import { createNotification } from "../../lib/notifications";
import type { HonoEnv } from "../index";

const app = new Hono<HonoEnv>();

// GET /api/consultation — list for current user
app.get("/", async (c) => {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const status = c.req.query("status") as Parameters<typeof getConsultationsForDoctor>[2];
  const list =
    user.role === "doctor"
      ? await getConsultationsForDoctor(c.env.DB, user.id, status)
      : await getConsultationsForPatient(c.env.DB, user.id, status);

  return c.json({ consultations: list });
});

// POST /api/consultation — create request (patient only)
app.post("/", zValidator("json", createConsultationSchema), async (c) => {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user || user.role !== "patient") {
    return c.json({ error: "Only patients can create consultations" }, 403);
  }

  const data = c.req.valid("json");
  const db = drizzle(c.env.DB);
  const now = Math.floor(Date.now() / 1000);
  const id = ulid();

  await db.insert(consultations).values({
    id,
    doctorId: data.doctorId,
    patientId: user.id,
    chiefComplaint: data.chiefComplaint,
    symptoms: data.symptoms,
    durationOfSymptoms: data.durationOfSymptoms,
    existingConditions: data.existingConditions,
    currentMedications: data.currentMedications,
    attachedFiles: data.attachedFiles ? JSON.stringify(data.attachedFiles) : null,
    status: "requested",
    requestedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  await createNotification(c.env.DB, {
    userId: data.doctorId,
    type: "consultation_requested",
    title: "New consultation request",
    body: `${user.name} sent a consultation request: ${data.chiefComplaint}`,
    link: "/dashboard/doctor",
    entityType: "consultation",
    entityId: id,
  });

  return c.json({ success: true, consultationId: id }, 201);
});

// GET /api/consultation/:id
app.get("/:id", async (c) => {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const consultation = await getConsultationById(c.env.DB, c.req.param("id"));
  if (!consultation) return c.json({ error: "Not found" }, 404);

  if (consultation.doctorId !== user.id && consultation.patientId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  return c.json({ consultation });
});

// POST /api/consultation/:id/accept (doctor only)
app.post("/:id/accept", zValidator("json", acceptConsultationSchema), async (c) => {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user || user.role !== "doctor") return c.json({ error: "Forbidden" }, 403);

  const consultation = await getConsultationById(c.env.DB, c.req.param("id"));
  if (!consultation || consultation.doctorId !== user.id) {
    return c.json({ error: "Not found" }, 404);
  }
  if (consultation.status !== "requested") {
    return c.json({ error: "Consultation is not in requested state" }, 400);
  }

  const data = c.req.valid("json");
  const db = drizzle(c.env.DB);
  const now = Math.floor(Date.now() / 1000);

  await db
    .update(consultations)
    .set({
      status: "accepted",
      consultationMode: data.consultationMode,
      consultationFee: data.consultationFee,
      paymentMode: data.paymentMode,
      doctorNotes: data.doctorNotes,
      acceptedAt: now,
      updatedAt: now,
    })
    .where(eq(consultations.id, consultation.id));

  await createNotification(c.env.DB, {
    userId: consultation.patientId,
    type: "consultation_accepted",
    title: "Consultation accepted",
    body: `${user.name} accepted your consultation request.`,
    link: "/dashboard/patient?tab=active",
    entityType: "consultation",
    entityId: consultation.id,
  });

  return c.json({ success: true });
});

// POST /api/consultation/:id/reject (doctor only)
app.post("/:id/reject", zValidator("json", rejectConsultationSchema), async (c) => {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user || user.role !== "doctor") return c.json({ error: "Forbidden" }, 403);

  const consultation = await getConsultationById(c.env.DB, c.req.param("id"));
  if (!consultation || consultation.doctorId !== user.id) {
    return c.json({ error: "Not found" }, 404);
  }
  if (consultation.status !== "requested") {
    return c.json({ error: "Consultation is not in requested state" }, 400);
  }

  const data = c.req.valid("json");
  const db = drizzle(c.env.DB);

  await db
    .update(consultations)
    .set({ status: "rejected", doctorNotes: data.doctorNotes, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(consultations.id, consultation.id));

  await createNotification(c.env.DB, {
    userId: consultation.patientId,
    type: "consultation_rejected",
    title: "Consultation request declined",
    body: data.doctorNotes || `${user.name} declined your consultation request.`,
    link: "/dashboard/patient?tab=history",
    entityType: "consultation",
    entityId: consultation.id,
  });

  return c.json({ success: true });
});

// POST /api/consultation/:id/start (doctor only — opens chat)
app.post("/:id/start", async (c) => {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user || user.role !== "doctor") return c.json({ error: "Forbidden" }, 403);

  const consultation = await getConsultationById(c.env.DB, c.req.param("id"));
  if (!consultation || consultation.doctorId !== user.id) return c.json({ error: "Not found" }, 404);
  if (consultation.status !== "accepted") return c.json({ error: "Must be accepted first" }, 400);

  const db = drizzle(c.env.DB);
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(consultations)
    .set({ status: "in_progress", startedAt: now, updatedAt: now })
    .where(eq(consultations.id, consultation.id));

  await createNotification(c.env.DB, {
    userId: consultation.patientId,
    type: "consultation_started",
    title: "Consultation started",
    body: `${user.name} started your consultation chat.`,
    link: `/consultation/${consultation.id}`,
    entityType: "consultation",
    entityId: consultation.id,
  });

  return c.json({ success: true });
});

// POST /api/consultation/:id/complete (doctor only)
app.post("/:id/complete", async (c) => {
  const user = c.get("user" as never) as App.Locals["user"];
  if (!user || user.role !== "doctor") return c.json({ error: "Forbidden" }, 403);

  const consultation = await getConsultationById(c.env.DB, c.req.param("id"));
  if (!consultation || consultation.doctorId !== user.id) return c.json({ error: "Not found" }, 404);
  if (consultation.status !== "in_progress") return c.json({ error: "Consultation not in progress" }, 400);

  const db = drizzle(c.env.DB);
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(consultations)
    .set({ status: "completed", completedAt: now, updatedAt: now })
    .where(eq(consultations.id, consultation.id));

  await createNotification(c.env.DB, {
    userId: consultation.patientId,
    type: "consultation_completed",
    title: "Consultation completed",
    body: `${user.name} marked the consultation as completed.`,
    link: "/dashboard/patient?tab=history",
    entityType: "consultation",
    entityId: consultation.id,
  });

  return c.json({ success: true });
});

export { app as consultationRoutes };
