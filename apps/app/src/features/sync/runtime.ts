import {
  ROOT,
  WELCOME_ID,
  createNode,
  WORKSPACE_DOC_ID,
  createSyncEngine,
  exportKey,
  importKey,
  newKey,
  openLocalDoc,
  readTree,
  unlockKey,
  type DocStore,
  type SyncEngine,
  type SyncState,
} from "@notemax/core";
import * as Y from "yjs";
import { pastWelcomeContent, welcomeContent } from "@/features/editor/welcome";
import { markTemporary } from "@/features/temporary/temporary";
import { DOC_CHANNEL, getRawStore, isDesktop, onLocalWrite } from "@/platform/platform";
import { getPref, removePref, setPref } from "@/platform/prefs";
import { createStore } from "@/platform/store";
import { driveRemote, findFolder, folderHasDocs, readKeyCheck, writeKeyCheck } from "./drive";
import { NeedsSignIn } from "./google";

// Runs sync in this window: reads what other devices wrote, sends this device's
// edits, and says how it is going. The engine itself is in @notemax/core.

export type SyncView =
  | { state: "off" }
  /** Another browser tab of this app is the one syncing. */
  | { state: "elsewhere" }
  | { state: "idle"; lastSynced: number | null }
  | { state: "syncing"; lastSynced: number | null; done?: number; total?: number }
  | { state: "offline"; lastSynced: number | null }
  | { state: "error"; lastSynced: number | null; message: string; signIn?: boolean };

export const syncView = createStore<SyncView>({ state: "off" });

const PREFS = { on: "syncOn", key: "syncKey", folder: "syncFolder", state: "syncState", device: "deviceId" };

/** This device's id in file names. Made once and kept. */
export function deviceId(): string {
  let id = getPref(PREFS.device);
  if (!id) {
    id = `${isDesktop ? "desktop" : "web"}-${Math.random().toString(36).slice(2, 10)}`;
    setPref(PREFS.device, id);
  }
  return id;
}

export const syncIsOn = () => getPref(PREFS.on) === "1" && getPref(PREFS.key) !== null && getPref(PREFS.folder) !== null;

function loadState(): SyncState {
  try {
    const value = JSON.parse(getPref(PREFS.state) ?? "") as SyncState;
    return { cursor: typeof value.cursor === "string" ? value.cursor : null, dirty: Array.isArray(value.dirty) ? value.dirty : [] };
  } catch {
    return { cursor: null, dirty: [] };
  }
}

let engine: SyncEngine | null = null;
let stopRunning: (() => void) | null = null;

/** How long after an edit to send it, so a burst of typing is sent once. */
const SEND_AFTER_MS = 3000;
/** How often to look for other devices' edits while the app is open. */
const POLL_MS = 30_000;

async function runEngine(signal: AbortSignal) {
  const key = await importKey(getPref(PREFS.key)!);
  const folder = getPref(PREFS.folder)!;
  const channel = new BroadcastChannel(DOC_CHANNEL);
  const current = createSyncEngine({
    store: await getRawStore(),
    remote: driveRemote(folder, deviceId()),
    key,
    device: deviceId(),
    loadState,
    saveState: (state) => setPref(PREFS.state, JSON.stringify(state)),
    // Open pages in every window merge it, the way they merge another window's edits.
    onRemoteUpdate: (docId, update) => channel.postMessage({ docId, update }),
    onStatus(status) {
      if (status.state === "error") {
        const offline = !navigator.onLine || /Failed to fetch|NetworkError|network/i.test(status.message);
        syncView.set(offline ? { state: "offline", lastSynced: status.lastSynced } : { ...status, signIn: status.message === new NeedsSignIn().message });
      } else syncView.set(status);
    },
  });
  engine = current;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    clearTimeout(timer);
    timer = undefined;
    current.sync().catch(() => {
      // Shown through the status. The next poll or edit tries again.
    });
  };
  const soon = () => (timer ??= setTimeout(run, SEND_AFTER_MS));
  const changed = (docId: string) => {
    current.markDirty(docId);
    soon();
  };

  // Every window's saved edits, quick capture included. Edits merged in from
  // other devices go straight to the raw store, so they are never sent back.
  const stopWrites = onLocalWrite(changed);
  const poll = setInterval(run, POLL_MS);
  const onWake = () => document.visibilityState === "visible" && run();
  window.addEventListener("online", run);
  window.addEventListener("focus", run);
  document.addEventListener("visibilitychange", onWake);
  run();

  await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
  stopWrites();
  clearInterval(poll);
  clearTimeout(timer);
  window.removeEventListener("online", run);
  window.removeEventListener("focus", run);
  document.removeEventListener("visibilitychange", onWake);
  channel.close();
  engine = null;
}

/** Starts sync in this window when it is on. In a browser, only one tab syncs at a time. */
export function startSync() {
  if (!syncIsOn() || stopRunning) return;
  const controller = new AbortController();
  stopRunning = () => controller.abort();
  const body = () => runEngine(controller.signal);
  if (navigator.locks) {
    syncView.set({ state: "elsewhere" });
    // Waits while another tab holds the lock, and takes over when that tab closes.
    void navigator.locks.request("notemax-sync", { signal: controller.signal }, body).catch(() => {});
  } else void body();
}

export function stopSync() {
  stopRunning?.();
  stopRunning = null;
  syncView.set({ state: "off" });
}

export function syncNow() {
  void engine?.sync().catch(() => {});
}

/** What the folder in Drive looks like, so Settings can ask for the right thing. */
export async function folderState(): Promise<{ folder: string | null; hasPassphrase: boolean }> {
  const folder = await findFolder(false);
  return { folder, hasPassphrase: folder ? (await readKeyCheck(folder)) !== null : false };
}

/** True when this device has only the untouched Welcome note, so nothing would be lost by replacing it. */
async function onlyWelcome(): Promise<boolean> {
  const local = await openLocalDoc(await getRawStore(), WORKSPACE_DOC_ID);
  try {
    const tree = readTree(local.doc);
    return tree.byId.size <= 1 && (tree.byId.size === 0 || tree.byId.has(WELCOME_ID)) && tree.trash.length === 0;
  } finally {
    await local.close();
  }
}

const plainText = (html: string) => (new DOMParser().parseFromString(html, "text/html").body.textContent ?? "").replace(/s+/g, "");

/**
 * The Welcome note when someone wrote in it, so taking the notes from Drive
 * does not throw that writing away. Null while it says what it came with.
 */
async function writtenWelcome(store: DocStore): Promise<{ title: string; updates: Uint8Array[] } | null> {
  const { updates } = await store.load(WELCOME_ID);
  if (!updates.length) return null;
  const body = new Y.Doc();
  updates.forEach((update) => Y.applyUpdate(body, update));
  const text = plainText(body.getXmlFragment("content").toString());
  body.destroy();
  if (!text || [welcomeContent, ...pastWelcomeContent].some((seed) => plainText(seed) === text)) return null;
  const local = await openLocalDoc(store, WORKSPACE_DOC_ID);
  try {
    return { title: readTree(local.doc).byId.get(WELCOME_ID)?.title || "Welcome", updates };
  } finally {
    await local.close();
  }
}

/**
 * Turns sync on with a passphrase: the existing one for a folder that has one,
 * or a new one. Returns "reload" when this device took the notes from Drive in
 * place of its own empty start, and the app should start over to show them.
 */
export async function turnOnSync(passphrase: string): Promise<"started" | "reload"> {
  const folder = (await findFolder(true))!;
  const check = await readKeyCheck(folder);
  let key: CryptoKey;
  if (check) {
    const unlocked = await unlockKey(passphrase, check);
    if (!unlocked) throw new Error("That passphrase does not match the one your other devices use.");
    key = unlocked;
  } else {
    const made = await newKey(passphrase);
    await writeKeyCheck(folder, made.check);
    key = made.key;
  }

  setPref(PREFS.key, await exportKey(key));
  setPref(PREFS.folder, folder);
  setPref(PREFS.state, JSON.stringify({ cursor: null, dirty: [] } satisfies SyncState));

  // A new device: take the notes from Drive instead of merging in a second Welcome note.
  const adopt = (await folderHasDocs(folder, deviceId())) && (await onlyWelcome());
  const store = await getRawStore();
  const written = adopt ? await writtenWelcome(store) : null;
  if (adopt) {
    for (const docId of await store.list()) await store.remove(docId);
  }
  const first = createSyncEngine({
    store,
    remote: driveRemote(folder, deviceId()),
    key,
    device: deviceId(),
    loadState,
    saveState: (state) => setPref(PREFS.state, JSON.stringify(state)),
    onRemoteUpdate: () => {},
    onStatus: (status) => syncView.set(status),
  });
  if (!adopt) await first.markAllDirty();
  await first.sync();
  if (written) {
    // Kept as a temporary page of its own beside the Welcome note from Drive.
    const id = crypto.randomUUID();
    await store.append(id, Y.mergeUpdates(written.updates));
    const local = await openLocalDoc(store, WORKSPACE_DOC_ID);
    try {
      createNode(local.doc, "note", ROOT, `${written.title} (from this browser)`, id);
      markTemporary(local.doc, [id]);
    } finally {
      await local.close();
    }
    first.markDirty(WORKSPACE_DOC_ID);
    first.markDirty(id);
    await first.sync();
  }
  setPref(PREFS.on, "1");
  if (adopt) return "reload";
  startSync();
  return "started";
}

/** Stops syncing on this device. Its notes stay; the files in Drive stay for other devices. */
export function turnOffSync() {
  stopSync();
  for (const key of [PREFS.on, PREFS.key, PREFS.folder, PREFS.state]) removePref(key);
}
