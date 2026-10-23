import { withPageDoc } from "@/features/export/content";
import type { Exporter } from "@/plugins/types";
import { filesOf, readElements } from "./board-sync";

/** What is drawn, without deleted shapes, and the pictures it uses. */
const scene = (id: string) =>
  withPageDoc(id, (doc) => ({
    elements: readElements(doc).filter((e) => !e.isDeleted),
    files: Object.fromEntries([...filesOf(doc).entries()]),
  }));

/** Pictures need Excalidraw itself to draw them. It loads only when asked. */
async function picture(id: string, type: "png" | "svg"): Promise<Blob> {
  const [{ exportToBlob, exportToSvg }, { elements, files }] = await Promise.all([import("./excalidrawAssets").then(() => import("@excalidraw/excalidraw")), scene(id)]);
  const appState = { exportBackground: true, viewBackgroundColor: "#ffffff", exportWithDarkMode: false };
  const args = { elements: elements as never, appState, files: files as never };
  if (type === "png") return exportToBlob({ ...args, mimeType: "image/png" });
  const svg = await exportToSvg(args);
  return new Blob([svg.outerHTML], { type: "image/svg+xml" });
}

export const BOARD_FORMATS: Exporter[] = [
  { id: "png", label: "Picture (.png)", extension: "png", kinds: ["board"], build: (node) => picture(node.id, "png") },
  { id: "svg", label: "Drawing (.svg)", extension: "svg", kinds: ["board"], build: (node) => picture(node.id, "svg") },
  {
    id: "excalidraw",
    label: "Excalidraw file (.excalidraw)",
    extension: "excalidraw",
    kinds: ["board"],
    async build(node) {
      const { elements, files } = await scene(node.id);
      const file = { type: "excalidraw", version: 2, source: "notemax", elements, appState: { viewBackgroundColor: "#ffffff" }, files };
      return new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    },
  },
];
