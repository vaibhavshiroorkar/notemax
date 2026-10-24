import { NodeSelection } from "@tiptap/pm/state";
import { imageBlob } from "@/features/images/store";
import { saveFile } from "@/features/export/save";
import type { ContextTarget, Plugin } from "@/plugins/types";
import { VideoInput, VideoNode, insertVideos, pickVideos } from "./video-node";

/** The video the right click selected. */
function videoOf(target: ContextTarget): { asset: string | null; name: string } | null {
  if (target.type !== "editor") return null;
  const { selection } = target.editor.state;
  if (!(selection instanceof NodeSelection) || selection.node.type.name !== "video") return null;
  return selection.node.attrs as { asset: string | null; name: string };
}

export const videoPlugin: Plugin = {
  id: "video",
  name: "Video",
  description: "Paste, drop or pick videos and play them in the note",
  // Videos always show, even with this plugin off; only adding new ones stops.
  contentExtensions: () => [VideoNode],
  editorExtensions: () => [VideoInput],
  slashItems: [
    {
      title: "Video",
      hint: "paste or drop",
      description: "From your device",
      icon: "video",
      group: "Media",
      keywords: ["video", "movie", "clip", "film", "upload", "mp4"],
      apply: (chain) =>
        chain.command(({ editor }) => {
          void pickVideos().then((files) => insertVideos(editor, files));
          return true;
        }),
    },
  ],
  contextMenu: [
    {
      id: "video.insert",
      title: "Insert video...",
      group: "insert",
      targets: ["editor"],
      when: (target) => !videoOf(target),
      run(target) {
        if (target.type !== "editor") return;
        void pickVideos().then((files) => insertVideos(target.editor, files));
      },
    },
    {
      id: "video.download",
      title: "Download video",
      group: "image",
      targets: ["editor"],
      when: (target) => !!videoOf(target)?.asset,
      async run(target, app) {
        const video = videoOf(target)!;
        const file = await imageBlob(video.asset!, app.workspace);
        if (!file) return app.notify("This video is not on this device.");
        await saveFile(file.blob, file.name || video.name || "video");
      },
    },
  ],
};
