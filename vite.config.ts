import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  // public/rocket-launch.html loads Three.js from a CDN import map; keep the
  // dependency scanner off it.
  optimizeDeps: { entries: ["index.html"] },
  server: { host: "127.0.0.1", port: 5173 },
});
