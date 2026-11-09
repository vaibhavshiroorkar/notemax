import "./excalidrawAssets";
import { exportToSvg } from "@excalidraw/excalidraw";
import type { StoredElement, StoredFile } from "./board-sync";

// Loaded only when a note shows a drawing, like the rest of Excalidraw.

/** A drawing as a picture, for showing it in a note while nobody draws on it. */
export function drawingSvg(elements: readonly StoredElement[], files: Record<string, StoredFile>, dark: boolean): Promise<SVGSVGElement> {
  return exportToSvg({
    elements: elements.filter((element) => !element.isDeleted) as never,
    // No background, so the drawing sits on the page like ink.
    appState: { exportBackground: false, exportWithDarkMode: dark } as never,
    files: files as never,
    exportPadding: 12,
  });
}
