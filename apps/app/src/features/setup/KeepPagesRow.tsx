import { useState } from "react";
import { syncIsOn, keepPagesHere, stopKeepingPages } from "@/features/sync/runtime";
import { onlineMode } from "@/platform/mode";
import { memoryOnly } from "@/platform/platform";
import { ConfirmDialog } from "@/ui/Dialog";

/**
 * Settings, Setup: whether this device keeps a copy of the pages. Off, they
 * live only in Google Drive and in memory while Notemax is open. Needs sync.
 */
export function KeepPagesRow() {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const online = onlineMode.use() !== "offline";
  const canChoose = online && syncIsOn();

  const run = async (change: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await change();
      location.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setBusy(false);
    }
  };

  return (
    <>
      <label className="settings-row settings-check">
        <span>
          Keep pages on this device
          <span className="settings-description">
            {!canChoose
              ? "Needs sync. Without it, this device is the only place your pages are."
              : memoryOnly
                ? "Off: pages come from Google Drive each time Notemax opens, and nothing is left behind when it closes."
                : "On: pages are saved here and open without the internet. Turn off for a shared or borrowed computer."}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={!memoryOnly}
          disabled={!canChoose || busy}
          onChange={(event) => (event.target.checked ? void run(keepPagesHere) : setAsking(true))}
        />
      </label>
      {busy && <p className="settings-note">{memoryOnly ? "Saving pages to this device..." : "Sending edits, then erasing..."}</p>}
      {error && <p className="warning">{error}</p>}
      {asking && (
        <ConfirmDialog
          title="Stop keeping pages on this device?"
          message="Notemax sends every edit still waiting to your Google Drive, erases the pages from this device and opens again. From then on it needs the internet to start, and gets your pages from Drive each time."
          confirmLabel="Erase from this device"
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            void run(stopKeepingPages);
          }}
        />
      )}
    </>
  );
}
