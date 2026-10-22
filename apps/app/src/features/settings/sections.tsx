import { useEffect, useState } from "react";
import { syncIsOn } from "@/features/sync/runtime";
import { isDesktop, memoryOnly } from "@/platform/platform";
import type { SettingsContext } from "@/plugins/types";

// Must match DB_URL in apps/desktop/src-tauri/src/lib.rs. The SQL plugin keeps
// the file in the app's config folder.
const DB_FILE = "notemax.db";

async function databasePath(): Promise<string> {
  const { appConfigDir, join } = await import("@tauri-apps/api/path");
  return join(await appConfigDir(), DB_FILE);
}

export function StorageSection({ persistent }: SettingsContext) {
  const [dbPath, setDbPath] = useState<string>();

  useEffect(() => {
    if (isDesktop) databasePath().then(setDbPath, () => setDbPath(undefined));
  }, []);

  const elsewhere = syncIsOn() ? " Sync keeps a sealed copy in your Google Drive." : " Nothing leaves it.";
  if (memoryOnly) return <p>Your pages are kept only in memory while Notemax is open, and come from your Google Drive each time it starts. Nothing is saved on this device (Settings, Setup).</p>;
  return (
    <>
      {isDesktop ? (
        <>
          <p>Your notes are saved in one file on this computer.{elsewhere}</p>
          {dbPath && <code className="settings-path">{dbPath}</code>}
        </>
      ) : (
        <>
          <p>Your notes are saved in this browser on this device.{elsewhere}</p>
          {persistent === false && (
            <p className="warning">
              The browser has not promised to keep them. It may clear them if disk space runs low. The desktop app does not have this limit.
            </p>
          )}
        </>
      )}
    </>
  );
}
