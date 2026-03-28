import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import preact from "@astrojs/preact";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
    // Export ChatRoom DO class from the worker entrypoint
    workerEntryPoint: {
      path: "./src/worker-entry.ts",
      namedExports: ["ChatRoom"],
    },
  }),
  integrations: [
    preact({ include: ["**/chat/**"] }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
