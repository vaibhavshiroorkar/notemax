import { createHash } from "node:crypto";
import { cpSync, createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const fromHere = (file: string) => new URL(file, import.meta.url).pathname.replace(/^\/(\w:)/, "$1");

// Excalidraw downloads its fonts from a CDN unless the page serves them. Notes
// work offline and nothing should leave the device, so the fonts the package
// ships are served from /excalidraw/ in development and copied there on build.
// They load only when a board needs them.
const EXCALIDRAW_FONTS = normalize(fromHere("node_modules/@excalidraw/excalidraw/dist/prod/fonts"));
const FONT_TYPES: Record<string, string> = { ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf" };

function excalidrawFonts(): Plugin {
  return {
    name: "notemax-excalidraw-fonts",
    configureServer(server) {
      server.middlewares.use("/excalidraw/fonts", (req, res, next) => {
        const path = normalize(join(EXCALIDRAW_FONTS, decodeURIComponent((req.url ?? "").split("?")[0])));
        if (!path.startsWith(EXCALIDRAW_FONTS) || !existsSync(path) || !statSync(path).isFile()) return next();
        res.setHeader("Content-Type", FONT_TYPES[extname(path)] ?? "application/octet-stream");
        createReadStream(path).pipe(res);
      });
    },
    writeBundle(options) {
      cpSync(EXCALIDRAW_FONTS, join(options.dir ?? fromHere("dist"), "excalidraw", "fonts"), { recursive: true });
    },
  };
}

// The web app works offline: after one visit, a service worker keeps every
// built file and serves the app from that copy when there is no network. The
// worker is written here because only the build knows the file names.
function serviceWorker(): Plugin {
  return {
    name: "notemax-service-worker",
    apply: "build",
    generateBundle(_options, bundle) {
      // Only what the main page loads at start, so a phone's first visit stays small.
      // Boards and other parts that load later are kept the first time they are used.
      const files = new Set<string>();
      const add = (name: string) => {
        const item = bundle[name];
        if (!item || files.has(name)) return;
        files.add(name);
        if (item.type !== "chunk") return;
        item.imports.forEach(add);
        item.viteMetadata?.importedCss.forEach((css) => files.add(css));
      };
      for (const [name, item] of Object.entries(bundle)) if (item.type === "chunk" && item.isEntry && item.name === "main") add(name);
      if (!files.size) this.error("service worker: the main entry was not found");
      // Any changed file makes a new version, so phones drop what they kept of the old one.
      const version = createHash("sha256").update(Object.keys(bundle).sort().join(" ")).digest("hex").slice(0, 12);
      const source = readFileSync(fromHere("src/platform/sw.js"), "utf8")
        .replace("__VERSION__", version)
        .replace("__FILES__", JSON.stringify(["/", ...[...files].sort().map((name) => `/${name}`)]));
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

// A Content Security Policy for the built app, on the web and in the desktop
// window. Pages show text from other people, like community posts, so if a bug
// ever let some of it become a script tag or an onclick, the browser refuses to
// run it: scripts come only from the app itself. The exceptions each have a user:
// code pages run JavaScript with new Function in a worker that shares this
// policy (unsafe-eval), Python loads from jsdelivr as WebAssembly, and
// community plugins load as blob modules. Pages may fetch any https address,
// since plugins and web pictures can live anywhere. The dev server leaves it
// out: its hot reload needs inline scripts.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob:",
  // Excalidraw still asks esm.sh for its fonts in the built app, though the
  // fonts are served from /excalidraw/ and its asset path is set before it
  // loads. Until that is found, boards keep their fonts from there.
  "font-src 'self' data: https://esm.sh",
  // ipc: is how the desktop window talks to the app around it. Local addresses are for a plugin's dev server.
  "connect-src 'self' https: wss://*.supabase.co data: blob: ipc: http://ipc.localhost http://localhost:* http://127.0.0.1:*",
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

function securityPolicy(): Plugin {
  return {
    name: "notemax-security-policy",
    apply: "build",
    transformIndexHtml: () => [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CSP }, injectTo: "head-prepend" }],
  };
}

export default defineConfig({
  plugins: [react(), excalidrawFonts(), serviceWorker(), securityPolicy()],
  // "@/ui/Icon" instead of "../../ui/Icon", so files can move between folders freely.
  resolve: { alias: { "@": fromHere("src") } },
  // Tauri expects a fixed port, so fail instead of silently picking another one.
  server: { port: 5173, strictPort: true },
  // SQLite finds its .wasm file next to its own script, which pre-bundling would move.
  optimizeDeps: { exclude: ["@sqlite.org/sqlite-wasm"] },
  // SQL pages run in a module worker that imports SQLite.
  worker: { format: "es" },
  build: {
    rolldownOptions: {
      // The capture window gets its own small page, so it never waits for the editor to load.
      input: { main: fromHere("index.html"), capture: fromHere("capture.html") },
    },
  },
});