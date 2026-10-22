import { Extension, Node, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { showToast } from "@/ui/toast";
import { ImageView } from "./ImageView";
import { isImage, saveImage } from "./store";

export type Align = "left" | "center" | "right";

/**
 * A picture in a note. `asset` points to the picture kept on this device;
 * `src` is only for pictures pasted from the web by address. `width` is a
 * share of the text width in percent, so a picture keeps its look when the
 * page width changes. Left and right let the text flow around it.
 */
export const ImageNode = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      asset: { default: null, parseHTML: (el) => el.getAttribute("data-asset") },
      src: { default: null, parseHTML: (el) => (el.getAttribute("data-asset") ? null : el.getAttribute("src")) },
      alt: { default: "", parseHTML: (el) => el.getAttribute("alt") ?? "" },
      width: {
        default: null,
        parseHTML: (el) => {
          const value = Number(el.getAttribute("data-width"));
          return value > 0 && value <= 100 ? value : null;
        },
      },
      align: { default: "center", parseHTML: (el) => (["left", "right"].includes(el.getAttribute("data-align") ?? "") ? el.getAttribute("data-align") : "center") },
    };
  },

  parseHTML() {
    return [{ tag: "img[data-asset]" }, { tag: "img[src]" }];
  },

  renderHTML({ node }) {
    const { asset, src, alt, width, align } = node.attrs;
    return ["img", { "data-asset": asset ?? undefined, src: src ?? undefined, alt, "data-width": width ?? undefined, "data-align": align }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});

/** Keeps the files and puts them at `pos`, one after the other. */
export async function insertImages(editor: Editor, files: File[], pos?: number) {
  let at = pos ?? editor.state.selection.to;
  for (const file of files.filter(isImage)) {
    try {
      const asset = await saveImage(file, file.name || "picture");
      editor.chain().focus().insertContentAt(at, { type: "image", attrs: { asset } }).run();
      // The next one goes after this one.
      at = editor.state.selection.to;
    } catch (error) {
      showToast(`Could not add ${file.name || "the picture"}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

const imageFiles = (data: DataTransfer | null) => [...(data?.files ?? [])].filter(isImage);

/** Pasting or dropping pictures puts them in the note. */
export const ImageInput = Extension.create({
  name: "imageInput",
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("imageInput"),
        props: {
          handlePaste(_view, event) {
            const files = imageFiles(event.clipboardData);
            if (!files.length) return false;
            void insertImages(editor, files);
            return true;
          },
          handleDrop(view, event, _slice, moved) {
            // A picture dragged within the note is moved by the editor itself.
            if (moved) return false;
            const files = imageFiles(event.dataTransfer);
            if (!files.length) return false;
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
            event.preventDefault();
            void insertImages(editor, files, at?.pos);
            return true;
          },
        },
      }),
    ];
  },
});
