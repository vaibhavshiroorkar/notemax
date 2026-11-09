import { newKey, setProp, unlockKey, type KeyCheck, type TreeNode } from "@notemax/core";
import { forgetDoc } from "@/data/docCache";
import { workspaceList } from "@/features/workspaces/list";
import { getPref, onPrefChangedElsewhere, removePref, setPref, workspaceNow } from "@/platform/prefs";
import { createStore } from "@/platform/store";
import type { AppContext } from "@/plugins/types";

// A lock on pages, to keep out casual eyes. One password opens every locked
// page. Only a check of it is kept, made the way the sync passphrase is
// checked, and it follows the person to every device with the settings. The
// text itself stays as it was on disk: this is a gate, not encryption.

const PREF = "lockCheck";
/** With no key pressed or pointer moved for this long, locked pages close again. */
export const IDLE_MS = 5 * 60 * 1000;

export const isLocked = (node: TreeNode | undefined) => node?.props.locked === true;

/** A whole workspace behind the password. The same password opens it and every locked page. */
export const workspaceLocked = (id: string) => workspaceList.get().some((w) => w.id === id && w.locked);

/** A locked workspace not opened yet: its list, pages and Home cards stay hidden. */
export const lockedOut = (id: string) => workspaceLocked(id) && !unlocked.get();

/** Watches lockedOut for one workspace. */
export function useLockedOut(id: string): boolean {
  const open = unlocked.use();
  const list = workspaceList.use();
  return !open && list.some((w) => w.id === id && w.locked);
}

/**
 * Locked and not opened with the password: its text must not show anywhere, in
 * lists, search or previews. Every page of the shown workspace counts while
 * that workspace is locked.
 */
export const isHidden = (node: TreeNode | undefined) => !!node && (isLocked(node) || workspaceLocked(workspaceNow())) && !unlocked.get();

function readCheck(): KeyCheck | null {
  try {
    const value = JSON.parse(getPref(PREF) ?? "null");
    return value && typeof value.salt === "string" ? value : null;
  } catch {
    return null;
  }
}

/** Whether a lock password is set. */
export const hasPassword = createStore(readCheck() !== null);
onPrefChangedElsewhere(PREF, () => hasPassword.set(readCheck() !== null));

/** True while locked pages are open, after the password was typed. */
export const unlocked = createStore(false);

export async function setPassword(password: string) {
  const { check } = await newKey(password);
  setPref(PREF, JSON.stringify(check));
  hasPassword.set(true);
  unlocked.set(true);
}

/** Opens every locked page until they are locked again. False for a wrong password. */
export async function unlock(password: string): Promise<boolean> {
  const check = readCheck();
  if (!check) return false;
  const ok = (await unlockKey(password, check)) !== null;
  if (ok) unlocked.set(true);
  return ok;
}

/** Locks every locked page again, and drops their open copies so nothing stays readable in memory. */
export function relock(app: AppContext) {
  unlocked.set(false);
  // After the pages have swapped their editors for the lock screen, so the last keystrokes are saved first.
  setTimeout(() => {
    const all = workspaceLocked(app.workspace);
    for (const node of app.tree.byId.values()) if (all || isLocked(node)) void forgetDoc(node.id, app.workspace);
  }, 0);
}

/** Forgets the password, after the person proved they mean it. Locked pages stay marked, and the next password opens them. */
export function forgetPassword() {
  removePref(PREF);
  hasPassword.set(false);
  unlocked.set(false);
}

export const setLocked = (app: AppContext, id: string, on: boolean) => setProp(app.doc, id, "locked", on ? true : null);

/** Relocks after a while with no key pressed or pointer moved. Returns a function that stops watching. */
export function watchIdle(app: AppContext): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const reset = () => {
    clearTimeout(timer);
    if (unlocked.get()) timer = setTimeout(() => relock(app), IDLE_MS);
  };
  const events = ["keydown", "pointerdown", "pointermove", "wheel"] as const;
  for (const name of events) addEventListener(name, reset, { passive: true, capture: true });
  const stop = unlocked.subscribe(reset);
  reset();
  return () => {
    clearTimeout(timer);
    stop();
    for (const name of events) removeEventListener(name, reset, { capture: true });
  };
}
