import type { Plugin } from "@/plugins/types";
import { BoardPane } from "./BoardPane";
import { openNextDrawing } from "./drawing-data";
import { DrawingNode } from "./drawing-node";
import { BOARD_FORMATS } from "./formats";
import { acceptDroppedBoards, pickExcalidraw } from "./import";

/** Drawing boards, made with Excalidraw. Everything Excalidraw-specific stays in this folder. */
export const boardsPlugin: Plugin = {
  id: "boards",
  name: "Boards",
  description: "Drawing boards made with Excalidraw",
  // Drawings always show, even with this plugin off; only adding new ones stops.
  contentExtensions: () => [DrawingNode],
  slashItems: [
    {
      title: "Drawing",
      hint: "sketch",
      description: "A small Excalidraw board in the note",
      icon: "board",
      group: "Blocks",
      keywords: ["draw", "sketch", "board", "whiteboard", "excalidraw", "diagram", "doodle", "canvas"],
      apply: (chain) => {
        openNextDrawing();
        return chain.insertContent({ type: "drawing" });
      },
    },
  ],
  kinds: [{ kind: "board", label: "New board", icon: "board", other: true }],
  pageViews: [{ kind: "board", component: BoardPane }],
  exporters: BOARD_FORMATS,
  commands: [
    { id: "boards.new", title: "New board", keywords: ["draw", "sketch", "whiteboard", "excalidraw", "diagram"], run: (app) => app.create("board") },
    { id: "boards.open-file", title: "Open an Excalidraw file as a board", keywords: ["import", "excalidraw", "file", "drawing"], run: pickExcalidraw },
  ],
  // The app from the start stays good for this: it creates and opens pages, nothing that changes.
  start: (app) => acceptDroppedBoards(() => app),
};
