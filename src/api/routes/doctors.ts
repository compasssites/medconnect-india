import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { doctorSearchSchema } from "../validators/schemas";
import { searchDoctors, getDoctorBySlug } from "../../lib/db/queries";
import type { HonoEnv } from "../index";

const app = new Hono<HonoEnv>();

// GET /api/doctors — search/list doctors
app.get("/", zValidator("query", doctorSearchSchema), async (c) => {
  const params = c.req.valid("query");
  const doctors = await searchDoctors(c.env.DB, {
    specialization: params.specialization,
    city: params.city,
    state: params.state,
    name: params.name,
    isAvailable: params.available,
    consultationMode: params.mode,
    feeMin: params.feeMin,
    feeMax: params.feeMax,
    limit: params.limit,
    offset: params.offset,
  });
  return c.json({ doctors });
});

// GET /api/doctors/:slug — individual doctor profile
app.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const doctor = await getDoctorBySlug(c.env.DB, slug);
  if (!doctor) return c.json({ error: "Doctor not found" }, 404);
  return c.json({ doctor });
});

export { app as doctorRoutes };
