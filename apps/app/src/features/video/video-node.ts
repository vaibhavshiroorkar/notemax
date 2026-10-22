import { Extension, Node, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { saveAsset } from "@notemax/core";
import { getStore } from "@/platform/platform";
import { showToast } from "@/ui/toast";
import { VideoView } from "./VideoView";

/**
 * Big enough for a few minutes of phone video. The whole file is held in
 * memory while it is saved and synced, so much larger ones would strain a phone.
 */
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

const isVideo = (file: File) => file.type.startsWith("video/");

/**
 * A video in a note. Like a picture it is kept on this device as an asset and
 * syncs with the note; `width` is a share of the text width in percent.
 */
export const VideoNode = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      asset: { default: null, parseHTML: (el) => el.getAttribute("data-asset") },
      name: { default: "", parseHTML: (el) => el.getAttribute("data-name") ?? "" },
      width: {
        default: null,
        parseHTML: (el) => {
          const value = Number(el.getAttribute("data-width"));
          return value > 0 && value <= 100 ? value : null;
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "video[data-asset]" }];
  },

  renderHTML({ node }) {
    const { asset, name, width } = node.attrs;
    return ["video", { "data-asset": asset, "data-name": name, "data-width": width ?? undefined, controls: "" }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoView);
  },
});

/** Keeps the videos and puts them at `pos`, one after the other. */
export async function insertVideos(editor: Editor, files: File[], pos?: number) {
  let at = pos ?? editor.state.selection.to;
  for (const file of files.filter(isVideo)) {
    const name = file.name || "video";
    try {
      if (file.size > MAX_VIDEO_BYTES) throw new Error(`Videos can be up to ${MAX_VIDEO_BYTES / 1024 / 1024} MB.`);
      showToast(`Adding ${name}...`);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const asset = await saveAsset(await getStore(), { bytes, type: file.type, name });
      editor.chain().focus().insertContentAt(at, { type: "video", attrs: { asset, name } }).run();
      at = editor.state.selection.to;
    } catch (error) {
      showToast(`Could not add ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

const videoFiles = (data: DataTransfer | null) => [...(data?.files ?? [])].filter(isVideo);

/** Pasting or dropping videos puts them in the note. */
export const VideoInput = Extension.create({
  name: "videoInput",
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("videoInput"),
        props: {
          handlePaste(_view, event) {
            const files = videoFiles(event.clipboardData);
            if (!files.length) return false;
            void insertVideos(editor, files);
            return true;
          },
          handleDrop(view, event, _slice, moved) {
            if (moved) return false;
            const files = videoFiles(event.dataTransfer);
            if (!files.length) return false;
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
            event.preventDefault();
            void insertVideos(editor, files, at?.pos);
            return true;
          },
        },
      }),
    ];
  },
});

/** A file picker for videos. Resolves to nothing when it is closed. */
export function pickVideos(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.multiple = true;
    input.onchange = () => resolve([...(input.files ?? [])]);
    input.oncancel = () => resolve([]);
    input.click();
  });
}
