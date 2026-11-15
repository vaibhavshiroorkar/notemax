import { useRef, useState } from "react";
import { ConfirmDialog } from "@/ui/Dialog";
import { InfoTip } from "@/ui/InfoTip";
import { showToast } from "@/ui/toast";
import { messageOf } from "@/ui/format";
import { backUpToFile, lastBackupAt, restoreFromFile } from "./backup";

const whenOf = (time: number) => (time ? new Date(time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Never");

/** A file picked for restoring opens this, from Settings or from the palette. */
export const pickBackupFile = (onPicked: (file: File) => void) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".notemax";
  input.addEventListener("change", () => input.files?.[0] && onPicked(input.files[0]), { once: true });
  input.click();
};

export async function backUpNow() {
  try {
    if (await backUpToFile()) showToast("Saved a backup of everything on this device");
  } catch (err) {
    showToast(`Could not make the backup: ${messageOf(err)}`);
  }
}

export function BackupSection() {
  const last = lastBackupAt.use();
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const restoring = useRef(false);

  const backUp = async () => {
    setBusy(true);
    await backUpNow();
    setBusy(false);
  };
  const restore = async (picked: File) => {
    if (restoring.current) return;
    restoring.current = true;
    setFile(null);
    try {
      await restoreFromFile(picked);
      // Every open page and list reads again from the store.
      location.reload();
    } catch (err) {
      showToast(`Could not restore it: ${messageOf(err)}`);
      restoring.current = false;
    }
  };

  return (
    <>
      <div className="settings-row">
        <span>
          Back up to a file
          <InfoTip label="About backups">
            One file with every workspace, version and picture on this device. Keep it somewhere safe, like a USB stick. It is not sealed with a passphrase, so anyone with the file can read your notes.
          </InfoTip>
        </span>
        <button className="button" onClick={() => void backUp()} disabled={busy}>
          {busy ? "Saving..." : "Back up"}
        </button>
      </div>
      <div className="settings-row">
        <span>Last backup</span>
        <span>{whenOf(last)}</span>
      </div>
      <div className="settings-row">
        <span>
          Restore from a backup
          <InfoTip label="About restoring">Adds what the backup holds to this device. Nothing here is removed, and edits made since the backup stay.</InfoTip>
        </span>
        <button className="button" onClick={() => pickBackupFile(setFile)}>
          Restore
        </button>
      </div>
      {file && (
        <ConfirmDialog
          title="Restore this backup?"
          message={
            <>
              Everything in <strong>{file.name}</strong> will be added to this device. Nothing here is removed. Notemax restarts when it is done.
            </>
          }
          confirmLabel="Restore"
          onConfirm={() => void restore(file)}
          onCancel={() => setFile(null)}
        />
      )}
    </>
  );
}
