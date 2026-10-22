import { useEffect, useRef, useState } from "react";
import type { SaveStatus } from "@notemax/core";
import { createStore } from "@/platform/store";
import { useOption } from "@/plugins/options";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { Safe } from "@/ui/Safe";
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

/** How long the bar stays after its text last changed. */
const SHOW_MS = 3000;

// A common estimate for silent reading of prose.
const WORDS_PER_MINUTE = 230;

function wordsLabel(words: number): string {
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  return `${words.toLocaleString()} ${words === 1 ? "word" : "words"}, ${minutes} min read`;
}

export function StatusBar({
  app,
  workspaceStatus,
  words,
  persistent,
}: {
  app: AppContext;
  workspaceStatus: SaveStatus;
  /** In the open page, or null when it has none or they are not counted yet. */
  words: number | null;
  persistent: boolean | undefined;
}) {
  const status = worst(workspaceStatus, pageStatus.use());
  const showWords = useOption("notes", "statusWords");
  const bar = useRef<HTMLElement>(null);
  const [quiet, setQuiet] = useState(false);

  // The bar shows when anything in it changes, then fades. Watching its text
  // covers the items plugins add too. Pointing at it brings it back.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      setQuiet(false);
      clearTimeout(timer);
      timer = setTimeout(() => setQuiet(true), SHOW_MS);
    };
    wake();
    const watch = new MutationObserver(wake);
    watch.observe(bar.current!, { childList: true, subtree: true, characterData: true });
    return () => {
      watch.disconnect();
      clearTimeout(timer);
    };
  }, []);

  return (
    // Trouble saving stays until it is fixed.
    <footer ref={bar} className="status-bar" data-state={status.state} data-quiet={(quiet && status.state !== "error") || undefined} role="status">
      {showWords && !!words && <span className="status-words">{wordsLabel(words)}</span>}
      <span className="status-save">
        {labels[status.state]}
        {status.state === "error" && `: ${status.message}. Retrying, keep this tab open.`}
      </span>
      {registry.statusItems().map(({ id, component: Item }) => (
        <Safe key={id} name={id}>
          <Item app={app} />
        </Safe>
      ))}
      {persistent === false && <span className="warning">The browser may clear these notes if disk space runs low.</span>}
    </footer>
  );
}
