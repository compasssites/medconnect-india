import type { APIRoute } from "astro";
import { app } from "../../api";

export const ALL: APIRoute = async ({ request, locals }) => {
  return app.fetch(request, (locals as App.Locals).runtime.env);
};
