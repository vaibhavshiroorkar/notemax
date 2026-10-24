import type { Plugin } from "@/plugins/types";
import { BoardPane } from "./BoardPane";
import { BOARD_FORMATS } from "./formats";
import { acceptDroppedBoards, pickExcalidraw } from "./import";

/** Drawing boards, made with Excalidraw. Everything Excalidraw-specific stays in this folder. */
export const boardsPlugin: Plugin = {
  id: "boards",
  name: "Boards",
  description: "Drawing boards made with Excalidraw",
  kinds: [{ kind: "board", label: "New board", icon: "board", other: true }],
  pageViews: [{ kind: "board", component: BoardPane }],
  exporters: BOARD_FORMATS,
  commands: [
    { id: "boards.new", title: "New board", keywords: ["draw", "sketch", "whiteboard", "excalidraw", "diagram"], run: (app) => app.create("board") },
    { id: "boards.open-file", title: "Open an Excalidraw file as a board", keywords: ["import", "excalidraw", "file", "drawing"], run: pickExcalidraw },
  ],
  contextMenu: [
    { id: "boards.open-file", inside: "new", title: "Board from an Excalidraw file...", group: "create", icon: "board", targets: ["sidebar"], run: (_target, app) => pickExcalidraw(app) },
  ],
  // The app from the start stays good for this: it creates and opens pages, nothing that changes.
  start: (app) => acceptDroppedBoards(() => app),
};
