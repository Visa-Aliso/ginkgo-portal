import { defineConfig } from "vite";
import { configPlugin } from "./build/config-plugin.ts";

export default defineConfig({
  plugins: [configPlugin()],
  // Relative asset paths support deployment at either the domain root or a subpath.
  base: "./",
  build: {
    rolldownOptions: { input: { main: "index.html", notes: "notes.html", profile: "profile.html" } },
    // Keep native light-dark() instead of Lightning CSS's media-query polyfill.
    // The theme is switched at runtime via color-scheme, so the polyfill would
    // concatenate its two custom properties and invalidate every color.
    cssTarget: ["chrome123", "edge123", "firefox120", "safari17.5", "ios17.5"],
  },
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
