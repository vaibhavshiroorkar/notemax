import { withPageDoc } from "@/features/export/content";
import type { Exporter } from "@/plugins/types";
import { filesOf, readElements } from "./board-sync";

/** What is drawn, without deleted shapes, and the pictures it uses. */
const scene = (id: string, workspace: string) =>
  withPageDoc(
    id,
    (doc) => ({
      elements: readElements(doc).filter((e) => !e.isDeleted),
      files: Object.fromEntries([...filesOf(doc).entries()]),
    }),
    workspace,
  );

/** Pictures need Excalidraw itself to draw them. It loads only when asked. */
async function picture(id: string, type: "png" | "svg", workspace: string): Promise<Blob> {
  const [{ exportToBlob, exportToSvg }, { elements, files }] = await Promise.all([import("./excalidrawAssets").then(() => import("@excalidraw/excalidraw")), scene(id, workspace)]);
  const appState = { exportBackground: true, viewBackgroundColor: "#ffffff", exportWithDarkMode: false };
  const args = { elements: elements as never, appState, files: files as never };
  if (type === "png") return exportToBlob({ ...args, mimeType: "image/png" });
  const svg = await exportToSvg(args);
  return new Blob([svg.outerHTML], { type: "image/svg+xml" });
}

export const BOARD_FORMATS: Exporter[] = [
  { id: "png", label: "Picture (.png)", extension: "png", kinds: ["board"], build: (node, app) => picture(node.id, "png", app.workspace) },
  { id: "svg", label: "Drawing (.svg)", extension: "svg", kinds: ["board"], build: (node, app) => picture(node.id, "svg", app.workspace) },
  {
    id: "excalidraw",
    label: "Excalidraw file (.excalidraw)",
    extension: "excalidraw",
    kinds: ["board"],
    async build(node, app) {
      const { elements, files } = await scene(node.id, app.workspace);
      const file = { type: "excalidraw", version: 2, source: "notemax", elements, appState: { viewBackgroundColor: "#ffffff" }, files };
      return new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    },
  },
];
