import { packBackup, readBackup, restoreBackup, splitScoped } from "@notemax/core";
import { onlyStarter, writtenStarter } from "@/features/sync/runtime";
import { saveFile } from "@/features/export/save";
import { getRawStore, getSharedStore } from "@/platform/platform";
import { savedStore } from "@/platform/store";
import { APP_VERSION } from "@/version";

/** When this device last made a backup file, or 0 for never. Each device keeps its own. */
export const lastBackupAt = savedStore<number>("lastBackupAt", 0);

const day = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Saves every workspace, version and picture on this device in one file. False when the person cancelled. */
export async function backUpToFile(): Promise<boolean> {
  const made = Date.now();
  const bytes = await packBackup(await getRawStore(), { app: APP_VERSION, made });
  const saved = await saveFile(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/octet-stream" }), `Notemax backup ${day(made)}.notemax`);
  if (saved) lastBackupAt.set(made);
  return saved;
}

/**
 * Merges a backup file into this device. Through the shared store, so sync
 * sends what came back like any other edit. Returns how many docs it held.
 */
export async function restoreFromFile(file: File): Promise<number> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Throws on a file that is not a backup, before anything here changes.
  readBackup(bytes);
  const raw = await getRawStore();
  // A device that holds only the untouched starter pages takes the backup's
  // place of them, or each starter page would show its text twice. Settings
  // and the list of workspaces stay; they merge.
  if ((await onlyStarter()) && !(await writtenStarter(raw)).length) {
    for (const docId of await raw.list()) if (splitScoped(docId).workspace !== null) await raw.remove(docId);
  }
  return restoreBackup(await getSharedStore(), bytes);
}
