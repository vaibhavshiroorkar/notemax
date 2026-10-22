import { isDesktop } from "./platform";

const hooks: (() => Promise<void>)[] = [];

/**
 * Work to finish before the desktop app quits from its tray, like saving open
 * pages and sending waiting edits. Hooks run in the order they were added.
 */
export function beforeQuit(hook: () => Promise<void>): () => void {
  hooks.push(hook);
  return () => void hooks.splice(hooks.indexOf(hook), 1);
}

/** Listens for Quit from the tray, in the main window only. The tray quits anyway if this takes too long. */
export async function listenForQuit() {
  if (!isDesktop) return;
  const [{ listen }, { invoke }] = await Promise.all([import("@tauri-apps/api/event"), import("@tauri-apps/api/core")]);
  await listen("quit-requested", async () => {
    for (const hook of [...hooks]) await hook().catch(() => {});
    await invoke("quit_now");
  });
}
