import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VoltexAI - Vite config. The dev server proxies /api and the websocket to the
// FastAPI backend so the frontend can call relative paths in development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true, ws: true },
    },
  },
  build: { outDir: "dist", sourcemap: false },
});
