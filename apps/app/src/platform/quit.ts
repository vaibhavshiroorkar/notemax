import { isDesktop } from "./platform";

const hooks: (() => Promise<void>)[] = [];
const lastHooks: (() => Promise<void>)[] = [];

/**
 * Work to finish before the desktop app quits from its tray, like saving open
 * pages and sending waiting edits. Hooks run in the order they were added.
 * A `last` hook runs after all the others, like installing an update, which
 * ends the app: everything else must be saved and sent by then.
 */
export function beforeQuit(hook: () => Promise<void>, { last = false } = {}): () => void {
  const list = last ? lastHooks : hooks;
  list.push(hook);
  return () => void list.splice(list.indexOf(hook), 1);
}

/** Runs the work for quitting, without quitting: before an update installs from a click, too. */
export async function runQuitHooks({ withLast = true } = {}) {
  for (const hook of [...hooks, ...(withLast ? lastHooks : [])]) await hook().catch(() => {});
}

/** Listens for Quit from the tray, in the main window only. The tray quits anyway if this takes too long. */
export async function listenForQuit() {
  if (!isDesktop) return;
  const [{ listen }, { invoke }] = await Promise.all([import("@tauri-apps/api/event"), import("@tauri-apps/api/core")]);
  await listen("quit-requested", async () => {
    await runQuitHooks();
    await invoke("quit_now");
  });
}
