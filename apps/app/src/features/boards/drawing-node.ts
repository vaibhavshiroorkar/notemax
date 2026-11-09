import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { DrawingView } from "./DrawingView";

/** A small Excalidraw board inside a note. See drawing-data.ts for how it is kept. */
export const DrawingNode = Node.create({
  name: "drawing",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      elements: { default: "[]", parseHTML: (el) => el.getAttribute("data-elements") ?? "[]" },
      files: { default: "{}", parseHTML: (el) => el.getAttribute("data-files") ?? "{}" },
      height: {
        default: null,
        parseHTML: (el) => {
          const value = Number(el.getAttribute("data-height"));
          return value >= 120 && value <= 2000 ? value : null;
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-drawing]" }];
  },

  renderHTML({ node }) {
    const { elements, files, height } = node.attrs;
    return ["div", { "data-drawing": "", "data-elements": elements, "data-files": files, "data-height": height ?? undefined }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DrawingView, {
      // While drawing, every key, click and paste belongs to Excalidraw, not the note.
      stopEvent: ({ event }) => event.target instanceof Element && !!event.target.closest(".drawing-live"),
    });
  },
});
