import type { Plugin } from "@/plugins/types";
import { BoardPane } from "./BoardPane";
import { BOARD_FORMATS } from "./formats";

/** Drawing boards, made with Excalidraw. Everything Excalidraw-specific stays in this folder. */
export const boardsPlugin: Plugin = {
  id: "boards",
  name: "Boards",
  description: "Drawing boards made with Excalidraw",
  kinds: [{ kind: "board", label: "New board", icon: "board" }],
  pageViews: [{ kind: "board", component: BoardPane }],
  exporters: BOARD_FORMATS,
  commands: [{ id: "boards.new", title: "New board", keywords: ["draw", "sketch", "whiteboard", "excalidraw", "diagram"], run: (app) => app.create("board") }],
};
