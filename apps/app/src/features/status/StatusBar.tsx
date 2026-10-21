import type { SaveStatus } from "@notemax/core";
import { createStore } from "@/platform/store";
import "./status.css";

/**
 * The open page's save state. It flips on every batch of keystrokes, so it
 * lives here, where only the status bar watches it, instead of in the app's
 * state, where each flip would redraw the whole app.
 */
export const pageStatus = createStore<SaveStatus>({ state: "saved" });

const labels: Record<SaveStatus["state"], string> = {
  saved: "Saved on this device",
  saving: "Saving...",
  error: "Not saved",
};

const severity: Record<SaveStatus["state"], number> = { saved: 0, saving: 1, error: 2 };
const worst = (a: SaveStatus, b: SaveStatus) => (severity[b.state] > severity[a.state] ? b : a);

// A common estimate for silent reading of prose.
const WORDS_PER_MINUTE = 230;

function wordsLabel(words: number): string {
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  return `${words.toLocaleString()} ${words === 1 ? "word" : "words"}, ${minutes} min read`;
}

export function StatusBar({
  workspaceStatus,
  words,
  persistent,
  readyMs,
}: {
  workspaceStatus: SaveStatus;
  /** In the open page, or null when it has none or they are not counted yet. */
  words: number | null;
  persistent: boolean | undefined;
  readyMs: number | undefined;
}) {
  const status = worst(workspaceStatus, pageStatus.use());
  return (
    <footer className="status-bar" data-state={status.state} role="status">
      {!!words && <span className="status-words">{wordsLabel(words)}</span>}
      <span>
        {labels[status.state]}
        {status.state === "error" && `: ${status.message}. Retrying, keep this tab open.`}
      </span>
      {persistent === false && <span className="warning">The browser may clear these notes if disk space runs low.</span>}
      {import.meta.env.DEV && readyMs !== undefined && <span>ready in {Math.round(readyMs)} ms</span>}
    </footer>
  );
}
