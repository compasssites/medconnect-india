import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { app } from "../../api";

export const ALL: APIRoute = async ({ request }) => {
  return app.fetch(request, env as unknown as Bindings);
};
