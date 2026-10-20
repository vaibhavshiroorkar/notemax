import type { SaveStatus } from "@notemax/core";
import "./status.css";

const labels: Record<SaveStatus["state"], string> = {
  saved: "Saved on this device",
  saving: "Saving...",
  error: "Not saved",
};

export function StatusBar({
  status,
  persistent,
  readyMs,
}: {
  status: SaveStatus;
  persistent: boolean | undefined;
  readyMs: number | undefined;
}) {
  return (
    <footer className="status-bar" data-state={status.state} role="status">
      <span>
        {labels[status.state]}
        {status.state === "error" && `: ${status.message}. Retrying, keep this tab open.`}
      </span>
      {persistent === false && (
        <span className="warning">The browser may clear these notes if disk space runs low.</span>
      )}
      {import.meta.env.DEV && readyMs !== undefined && <span>ready in {Math.round(readyMs)} ms</span>}
    </footer>
  );
}
