import type { Plugin } from "@/plugins/types";
import { MarkdownSection } from "./MarkdownSection";
import { checkNow, mirrorView, startMirror } from "./mirror";

export const markdownFilesPlugin: Plugin = {
  id: "markdown-files",
  name: "Markdown files",
  description: "Keep every note as a plain .md file in a folder, in step both ways, like an Obsidian vault",
  settings: [{ id: "markdown-files", order: 54, group: "Your data", title: "Markdown files", icon: "page", keywords: ["folder", "obsidian", "vault", "files", "md", "backup", "export"], component: MarkdownSection }],
  commands: [
    {
      id: "markdown-files.check",
      title: "Check the Markdown folder now",
      keywords: ["markdown", "folder", "files", "vault"],
      when: () => mirrorView.get().state === "on",
      run: () => void checkNow(),
    },
  ],
  workspaceStart: (app) => void startMirror(app).catch((err) => console.warn("[notemax] could not open the Markdown folder", err)),
};
