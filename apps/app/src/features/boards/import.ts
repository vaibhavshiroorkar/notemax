import { ROOT, createNode, openLocalDoc } from "@notemax/core";
import { DOC_CHANNEL, getStore } from "@/platform/platform";
import type { AppContext } from "@/plugins/types";
import { writeElements, writeFiles, type StoredElement, type StoredFile } from "./board-sync";

const isExcalidrawFile = (file: File) => /\.excalidraw(\.json)?$/i.test(file.name);

/** Turns an .excalidraw file into a board of its own, named after the file, and opens it. */
export async function importExcalidraw(app: AppContext, file: File) {
  let data: { type?: string; elements?: StoredElement[]; files?: Record<string, StoredFile> };
  try {
    data = JSON.parse(await file.text());
  } catch {
    return app.notify(`"${file.name}" is not an Excalidraw file`);
  }
  if (data.type !== "excalidraw" || !Array.isArray(data.elements)) return app.notify(`"${file.name}" is not an Excalidraw file`);
  const id = createNode(app.doc, "board", ROOT, file.name.replace(/\.excalidraw(\.json)?$/i, ""));
  const local = await openLocalDoc(await getStore(), id, { broadcast: DOC_CHANNEL });
  try {
    writeElements(
      local.doc,
      data.elements.filter((element) => !element.isDeleted),
    );
    writeFiles(local.doc, data.files ?? {});
  } finally {
    await local.close();
  }
  app.open(id);
}

/** Asks for one or more .excalidraw files, then opens each as a board. */
export function pickExcalidraw(app: AppContext) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".excalidraw,application/json";
  input.multiple = true;
  input.onchange = () => {
    for (const file of input.files ?? []) void importExcalidraw(app, file);
  };
  input.click();
}

/** .excalidraw files dropped anywhere outside a note or board open as boards. */
export function acceptDroppedBoards(app: () => AppContext) {
  window.addEventListener("dragover", (event) => {
    if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
  });
  window.addEventListener("drop", (event) => {
    const files = [...(event.dataTransfer?.files ?? [])].filter(isExcalidrawFile);
    if (event.defaultPrevented || !files.length) {
      // A file dropped where nothing takes it must not replace the app in the window.
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
      return;
    }
    event.preventDefault();
    for (const file of files) void importExcalidraw(app(), file);
  });
}
