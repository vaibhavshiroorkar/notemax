import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Tauri expects a fixed port, so fail instead of silently picking another one.
  server: { port: 5173, strictPort: true },
});
