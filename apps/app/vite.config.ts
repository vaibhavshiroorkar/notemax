import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const fromHere = (file: string) => new URL(file, import.meta.url).pathname.replace(/^\/(\w:)/, "$1");

export default defineConfig({
  plugins: [react()],
  // "@/ui/Icon" instead of "../../ui/Icon", so files can move between folders freely.
  resolve: { alias: { "@": fromHere("src") } },
  // Tauri expects a fixed port, so fail instead of silently picking another one.
  server: { port: 5173, strictPort: true },
  build: {
    rolldownOptions: {
      // The capture window gets its own small page, so it never waits for the editor to load.
      input: { main: fromHere("index.html"), capture: fromHere("capture.html") },
    },
  },
});
