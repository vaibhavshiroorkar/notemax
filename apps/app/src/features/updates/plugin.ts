import type { Plugin } from "@/plugins/types";
import { UpdatesSection } from "./UpdatesSection";
import { checkForUpdate, startDesktopUpdates } from "./updates";
import "./updates.css";

export const updatesPlugin: Plugin = {
  id: "updates",
  name: "Updates",
  description: "Checking for new versions, and installing them on their own",
  required: true,
  settings: [{ id: "updates", order: 90, group: "Advanced", title: "Updates", icon: "download", keywords: ["update", "version", "upgrade", "new", "install", "auto"], component: UpdatesSection }],
  commands: [{ id: "updates.check", title: "Check for updates", keywords: ["update", "version", "upgrade", "new"], run: () => void checkForUpdate() }],
  start: startDesktopUpdates,
};
