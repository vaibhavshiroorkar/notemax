import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/core";
import { saveFile } from "@/features/export/save";
import { extOf } from "@/features/export/content";
import type { ContextMenuItem, ContextTarget, Plugin } from "@/plugins/types";
import { askText } from "@/ui/Prompt";
import { ImageInput, ImageNode, insertImages } from "./image-node";
import { imageBlob, pickImages, saveImage } from "./store";

/** The picture the right click selected, with the editor it is in. */
function pictureOf(target: ContextTarget): { editor: Editor; attrs: Record<string, unknown> } | null {
  if (target.type !== "editor") return null;
  const { selection } = target.editor.state;
  if (!(selection instanceof NodeSelection) || selection.node.type.name !== "image") return null;
  return { editor: target.editor, attrs: selection.node.attrs };
}

const set = (target: ContextTarget, attrs: Record<string, unknown>) => pictureOf(target)!.editor.chain().focus().updateAttributes("image", attrs).run();

const choice = (id: string, title: string, attrs: Record<string, unknown>): ContextMenuItem => ({
  id: `images.${id}`,
  title,
  group: "image",
  targets: ["editor"],
  disabled: (target) => Object.entries(attrs).every(([key, value]) => pictureOf(target)?.attrs[key] === value),
  run: (target) => set(target, attrs),
});

/** Copies the picture as a PNG, the one picture type every app takes from the clipboard. */
async function copyPicture(asset: string) {
  const file = await imageBlob(asset);
  if (!file) throw new Error("not on this device");
  const bitmap = await createImageBitmap(file.blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": await canvas.convertToBlob({ type: "image/png" }) })]);
}

export const imagesPlugin: Plugin = {
  id: "images",
  name: "Pictures",
  description: "Paste, drop or pick pictures, then drag their edges to any size",
  // Pictures always show, even with this plugin off; only adding new ones stops.
  contentExtensions: () => [ImageNode],
  editorExtensions: () => [ImageInput],
  shortcutHints: [{ title: "Resize a picture with no snapping", keys: "Alt+drag" }],
  slashItems: [
    {
      title: "Picture",
      hint: "paste or drop",
      description: "From your device",
      icon: "image",
      group: "Media",
      keywords: ["image", "photo", "picture", "img", "upload"],
      apply: (chain) =>
        chain.command(({ editor }) => {
          void pickImages().then((files) => insertImages(editor, files));
          return true;
        }),
    },
  ],
  contextMenu: [
    {
      id: "images.insert",
      title: "Insert picture...",
      group: "insert",
      icon: "image",
      targets: ["editor"],
      when: (target) => !pictureOf(target),
      run(target) {
        if (target.type !== "editor") return;
        void pickImages().then((files) => insertImages(target.editor, files));
      },
    },
    {
      id: "images.align",
      title: "Place",
      group: "image",
      icon: "image",
      targets: ["editor"],
      when: (target) => !!pictureOf(target),
      submenu: () => [choice("left", "Left, text beside it", { align: "left" }), choice("center", "Center", { align: "center" }), choice("right", "Right, text beside it", { align: "right" })],
    },
    {
      id: "images.size",
      title: "Size",
      group: "image",
      targets: ["editor"],
      when: (target) => !!pictureOf(target),
      submenu: () => [
        choice("small", "Small, a quarter", { width: 25 }),
        choice("third", "A third", { width: 33 }),
        choice("half", "Half", { width: 50 }),
        choice("large", "Three quarters", { width: 75 }),
        choice("full", "Full width", { width: 100 }),
        choice("natural", "Its own size", { width: null }),
      ],
    },
    {
      id: "images.alt",
      title: "Description...",
      group: "image",
      targets: ["editor"],
      when: (target) => !!pictureOf(target),
      async run(target) {
        const picture = pictureOf(target)!;
        const alt = await askText({
          title: "Picture description",
          label: "Read aloud by screen readers, and shown when the picture cannot load",
          value: String(picture.attrs.alt ?? ""),
          confirm: "Save",
        });
        if (alt !== null) picture.editor.chain().focus().updateAttributes("image", { alt }).run();
      },
    },
    {
      id: "images.replace",
      title: "Replace...",
      group: "image",
      targets: ["editor"],
      when: (target) => !!pictureOf(target),
      async run(target) {
        const [file] = await pickImages();
        if (!file) return;
        const asset = await saveImage(file, file.name);
        set(target, { asset, src: null });
      },
    },
    {
      id: "images.copy",
      title: "Copy picture",
      group: "image",
      icon: "copy",
      targets: ["editor"],
      when: (target) => !!pictureOf(target)?.attrs.asset,
      run: (target, app) =>
        void copyPicture(String(pictureOf(target)!.attrs.asset)).then(
          () => app.notify("Copied the picture"),
          () => app.notify("Could not copy the picture"),
        ),
    },
    {
      id: "images.download",
      title: "Download picture",
      group: "image",
      icon: "download",
      targets: ["editor"],
      when: (target) => !!pictureOf(target)?.attrs.asset,
      async run(target, app) {
        const file = await imageBlob(String(pictureOf(target)!.attrs.asset));
        if (!file) return app.notify("This picture is not on this device.");
        const base = file.name.replace(/\.[^.]+$/, "") || "picture";
        await saveFile(file.blob, `${base}.${extOf(file.blob.type)}`);
      },
    },
    {
      id: "images.delete",
      title: "Delete picture",
      group: "danger",
      icon: "trash",
      danger: true,
      targets: ["editor"],
      when: (target) => !!pictureOf(target),
      run: (target) => pictureOf(target)!.editor.chain().focus().deleteSelection().run(),
    },
  ],
};
