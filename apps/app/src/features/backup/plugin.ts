import type { Plugin } from "@/plugins/types";
import { BackupSection, backUpNow } from "./BackupSection";

export const backupPlugin: Plugin = {
  id: "backup",
  name: "Backup",
  description: "Everything on this device in one file, and back",
  settings: [
    {
      id: "backup",
      order: 62,
      group: "Your data",
      title: "Backup",
      about: "Without sync, a backup file is the only copy of your notes that is not on this device.",
      icon: "upload",
      keywords: ["backup", "restore", "export", "import", "file", "offline", "copy", "safe"],
      component: BackupSection,
    },
  ],
  commands: [
    { id: "backup.now", title: "Back up everything to a file", keywords: ["backup", "export", "save", "offline"], run: () => void backUpNow() },
    { id: "backup.restore", title: "Restore from a backup", keywords: ["backup", "import", "restore"], run: (app) => app.openSettings("backup") },
  ],
};
