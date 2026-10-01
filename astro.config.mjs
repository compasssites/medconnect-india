import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import preact from "@astrojs/preact";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  compressHTML: true,
  output: "server",
  adapter: cloudflare({ imageService: "compile" }),
  integrations: [
    preact({ include: ["**/chat/**"] }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
