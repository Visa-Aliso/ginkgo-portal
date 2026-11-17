import { defineConfig } from "vite";
import { configPlugin } from "./build/config-plugin.ts";

export default defineConfig({
  plugins: [configPlugin()],
  // Relative asset paths support deployment at either the domain root or a subpath.
  base: "./",
  build: {
    rolldownOptions: { input: { main: "index.html", notes: "notes.html", profile: "profile.html" } },
  },
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
