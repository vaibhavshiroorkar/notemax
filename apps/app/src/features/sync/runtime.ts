import {
  ROOT,
  STARTER_IDS,
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
  isHistoryDocId,
  scopedId,
  splitScoped,
  SETTINGS_DOC_ID,
  WORKSPACES_DOC_ID,
} from "@notemax/core";
import * as Y from "yjs";
import { starterSeeds } from "@/features/editor/welcome";
import { markTemporary } from "@/features/temporary/temporary";
import { WORKSPACES_CHANNEL, docChannelFor, eraseDiskStore, getRawStore, isDesktop, keepOnDisk, memoryOnly, onLocalWrite, setMemoryFill } from "@/platform/platform";
import { workspaceNow } from "@/platform/prefs";
import { beforeQuit } from "@/platform/quit";
import { getPref, removePref, setPref } from "@/platform/prefs";
import { createStore } from "@/platform/store";
import { accountsEnabled } from "@/features/account/config";
import { recordConflict } from "./conflicts";
import { liveOn, liveState, noteRemoteEdit, startLive, type LiveLink } from "./live";
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

const PREFS = { on: "syncOn", key: "syncKey", folder: "syncFolder", state: "syncState", device: "deviceId", lastAt: "syncLastAt" };

/** How far before the last good sync an edit still counts as maybe unsent: edit times are kept to the minute. */
const EDIT_MARGIN_MS = 10 * 60_000;

/**
 * Docs that may hold edits whose mark to send was lost: every workspace's
 * tree, the settings and the list of workspaces, and pages of the open
 * workspace edited since shortly before the last good sync.
 */
async function maybeUnsent(store: DocStore): Promise<string[]> {
  const ids = [SETTINGS_DOC_ID, WORKSPACES_DOC_ID, ...(await store.list()).filter((id) => splitScoped(id).docId === WORKSPACE_DOC_ID)];
  const since = Number(getPref(PREFS.lastAt) ?? 0) - EDIT_MARGIN_MS;
  const local = await openLocalDoc(store, scopedId(workspaceNow(), WORKSPACE_DOC_ID));
  try {
    for (const node of readTree(local.doc).byId.values()) if (node.editedAt > since) ids.push(scopedId(workspaceNow(), node.id));
  } finally {
    await local.close();
  }
  return ids;
}

/** This device's id in file names. Made once and kept. */
function deviceId(): string {
  let id = getPref(PREFS.device);
  if (!id) {
    id = `${isDesktop ? "desktop" : "web"}-${Math.random().toString(36).slice(2, 10)}`;
    setPref(PREFS.device, id);
  }
  return id;
}

export const syncIsOn = () => getPref(PREFS.on) === "1" && getPref(PREFS.key) !== null && getPref(PREFS.folder) !== null;

// A device that keeps no pages starts each session with none, so where sync got to is not kept either.
let memoryState: SyncState = { cursor: null, dirty: [] };

function loadState(): SyncState {
  if (memoryOnly) return memoryState;
  try {
    const value = JSON.parse(getPref(PREFS.state) ?? "") as SyncState;
    return { cursor: typeof value.cursor === "string" ? value.cursor : null, dirty: Array.isArray(value.dirty) ? value.dirty : [] };
  } catch {
    return { cursor: null, dirty: [] };
  }
}

function saveState(state: SyncState) {
  if (memoryOnly) memoryState = state;
  else setPref(PREFS.state, JSON.stringify(state));
}

// The pages of a device that keeps none come from Drive before the app opens.
setMemoryFill(async (store) => {
  const fill = createSyncEngine({
    store,
    remote: driveRemote(getPref(PREFS.folder)!, deviceId()),
    key: await importKey(getPref(PREFS.key)!),
    device: deviceId(),
    loadState,
    saveState,
    onRemoteUpdate: () => {},
    onStatus: (status) => syncView.set(status),
  });
  await fill.sync();
});

let engine: SyncEngine | null = null;
let stopRunning: (() => void) | null = null;

/** How long after an edit to send it, so a burst of typing is sent once. Sooner when Drive holds the only copy. */
const SEND_AFTER_MS = memoryOnly ? 800 : 3000;
/** How often to look for other devices' edits while the app is open. */
const POLL_MS = 30_000;

async function runEngine(signal: AbortSignal) {
  const key = await importKey(getPref(PREFS.key)!);
  const folder = getPref(PREFS.folder)!;
  // Each workspace's open pages listen on their own channel, under their own ids.
  const channels = new Map<string, BroadcastChannel>();
  const tellOpenPages = (stored: string, update: Uint8Array) => {
    const { workspace, docId } = splitScoped(stored);
    const name = workspace === null ? WORKSPACES_CHANNEL : docChannelFor(workspace);
    let channel = channels.get(name);
    if (!channel) channels.set(name, (channel = new BroadcastChannel(name)));
    channel.postMessage({ docId, update });
    if (workspace === workspaceNow()) noteRemoteEdit(docId);
  };
  const current = createSyncEngine({
    store: await getRawStore(),
    remote: driveRemote(folder, deviceId()),
    key,
    device: deviceId(),
    loadState,
    saveState,
    // Open pages in every window merge it, the way they merge another window's edits.
    onRemoteUpdate: tellOpenPages,
    // Asked in the workspace it belongs to. Elsewhere both edits are kept all the same.
    onConflict(stored, mine, theirs) {
      const { workspace, docId } = splitScoped(stored);
      if (workspace === workspaceNow()) void recordConflict(docId, mine, theirs).catch(() => {});
    },
    onStatus(status) {
      if (status.state === "idle" && status.lastSynced) setPref(PREFS.lastAt, String(status.lastSynced));
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

  // Live updates while the setting is on. What comes in is kept like a synced
  // edit: in the raw store, so it is not sent back, and merged into open pages.
  const raw = await getRawStore();
  // In an object, since it is set from callbacks.
  const link: { live: LiveLink | null } = { live: null };
  let joining = false;
  const fromLive = (docId: string, update: Uint8Array) => {
    raw
      .append(docId, update)
      .then(() => tellOpenPages(docId, update))
      .catch(() => {});
  };
  const followSetting = () => {
    const want = liveOn.get() && accountsEnabled && !signal.aborted;
    if (want && !link.live && !joining) {
      joining = true;
      startLive(key, deviceId(), fromLive)
        .then((joined) => {
          if (liveOn.get() && !signal.aborted) link.live = joined;
          else joined.stop();
        })
        .catch(() => liveState.set("error"))
        .finally(() => (joining = false));
    } else if (!want && link.live) {
      link.live.stop();
      link.live = null;
    }
  };
  followSetting();
  const stopFollowing = liveOn.subscribe(followSetting);
  // Pictures are big and versions only add up; Drive carries those.
  const goesLive = (stored: string) => {
    const { docId } = splitScoped(stored);
    return !docId.startsWith("asset:") && !isHistoryDocId(docId);
  };

  // Every window's saved edits, quick capture included. Edits merged in from
  // other devices go straight to the raw store, so they are never sent back.
  const stopWrites = onLocalWrite(({ docId, update }) => {
    changed(docId);
    if (update && link.live && goesLive(docId)) link.live.send(docId, update);
  });
  const poll = setInterval(run, POLL_MS);
  // Hidden, the window may never come back (a phone closes it, a laptop sleeps), so edits go out now.
  const sendWaiting = () => loadState().dirty.length > 0 && run();
  const onWake = () => (document.visibilityState === "visible" ? run() : sendWaiting());
  window.addEventListener("pagehide", sendWaiting);
  const stopQuitHook = beforeQuit(async () => {
    if (loadState().dirty.length) await current.sync();
  });
  // Drive holds the only copy, so closing with edits not yet sent asks first, and sends them meanwhile.
  const onLeave = (event: BeforeUnloadEvent) => {
    if (!memoryOnly || !loadState().dirty.length) return;
    run();
    event.preventDefault();
  };
  window.addEventListener("beforeunload", onLeave);
  window.addEventListener("online", run);
  window.addEventListener("focus", run);
  document.addEventListener("visibilitychange", onWake);
  // A device that keeps pages may have lost marks in a forced close. One that keeps none started empty, so it has nothing to find.
  if (memoryOnly) run();
  else
    void maybeUnsent(raw)
      .then((ids) => current.catchUp(ids))
      .catch(() => {})
      .finally(run);

  await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
  stopWrites();
  stopFollowing();
  link.live?.stop();
  clearInterval(poll);
  clearTimeout(timer);
  window.removeEventListener("online", run);
  window.removeEventListener("focus", run);
  document.removeEventListener("visibilitychange", onWake);
  window.removeEventListener("beforeunload", onLeave);
  window.removeEventListener("pagehide", sendWaiting);
  stopQuitHook();
  channels.forEach((channel) => channel.close());
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

function stopSync() {
  stopRunning?.();
  stopRunning = null;
  syncView.set({ state: "off" });
}

export function syncNow() {
  void engine?.sync().catch(() => {});
}

/**
 * Stops keeping pages on this device: sends every waiting edit, then erases
 * the pages from disk. The app must reload after. Throws, erasing nothing,
 * when an edit could not be sent.
 */
export async function stopKeepingPages() {
  if (!engine) throw new Error("Sync runs in another Notemax tab or window. Close the others and try again.");
  await engine.sync();
  if (loadState().dirty.length) throw new Error("Some edits could not be sent to Drive yet, so nothing was erased. Check the connection and try again.");
  stopSync();
  // Set first: if erasing stops part way, the next start still takes the pages from Drive.
  setPref("keepLocal", "0");
  await eraseDiskStore();
}

/** Starts keeping pages on this device again: copies them from memory to disk, with what is still unsent. The app must reload after. */
export async function keepPagesHere() {
  await keepOnDisk();
  const unsent = memoryState.dirty;
  let saved: SyncState = { cursor: null, dirty: [] };
  try {
    saved = { ...saved, ...(JSON.parse(getPref(PREFS.state) ?? "{}") as Partial<SyncState>) };
  } catch {
    // Starting over from no cursor reads Drive again, which only costs time.
  }
  setPref(PREFS.state, JSON.stringify({ cursor: saved.cursor ?? null, dirty: [...new Set([...(saved.dirty ?? []), ...unsent])] } satisfies SyncState));
  setPref("keepLocal", "1");
}

/** What the folder in Drive looks like, so Settings can ask for the right thing. */
export async function folderState(): Promise<{ folder: string | null; hasPassphrase: boolean }> {
  const folder = await findFolder(false);
  return { folder, hasPassphrase: folder ? (await readKeyCheck(folder)) !== null : false };
}

/** True when this device has only the pages a new workspace starts with, so replacing them loses nothing but what writtenStarter keeps. */
async function onlyStarter(): Promise<boolean> {
  const local = await openLocalDoc(await getRawStore(), WORKSPACE_DOC_ID);
  try {
    const tree = readTree(local.doc);
    return [...tree.byId.keys()].every((id) => STARTER_IDS.has(id)) && tree.trash.length === 0;
  } finally {
    await local.close();
  }
}

const plainText = (html: string) => (new DOMParser().parseFromString(html, "text/html").body.textContent ?? "").replace(/\s+/g, "");

interface Written {
  title: string;
  kind: "note" | "board";
  updates: Uint8Array[];
}

/**
 * The starter pages someone wrote or drew in, so taking the notes from Drive
 * does not throw that away. A page that still says what it came with is left out.
 */
async function writtenStarter(store: DocStore): Promise<Written[]> {
  const local = await openLocalDoc(store, WORKSPACE_DOC_ID);
  const tree = readTree(local.doc);
  await local.close();
  const out: Written[] = [];
  for (const id of STARTER_IDS) {
    const node = tree.byId.get(id);
    if (!node || node.kind === "folder") continue;
    const { updates } = await store.load(id);
    if (!updates.length) continue;
    const body = new Y.Doc();
    updates.forEach((update) => Y.applyUpdate(body, update));
    // Boards keep their drawing in an "elements" map; everything else is text.
    const written =
      node.kind === "board"
        ? body.getMap("elements").size > 0
        : ((text) => !!text && !starterSeeds(id).some((seed) => plainText(seed) === text))(plainText(body.getXmlFragment("content").toString()));
    body.destroy();
    if (written) out.push({ title: node.title || "Untitled", kind: node.kind === "board" ? "board" : "note", updates });
  }
  return out;
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

  // A new device: take the notes from Drive instead of merging in a second set of starter pages.
  const adopt = (await folderHasDocs(folder, deviceId())) && (await onlyStarter());
  const store = await getRawStore();
  const written = adopt ? await writtenStarter(store) : [];
  if (adopt) {
    for (const docId of await store.list()) await store.remove(docId);
  }
  const first = createSyncEngine({
    store,
    remote: driveRemote(folder, deviceId()),
    key,
    device: deviceId(),
    loadState,
    saveState,
    onRemoteUpdate: () => {},
    onStatus: (status) => syncView.set(status),
  });
  if (!adopt) await first.markAllDirty();
  await first.sync();
  if (written.length) {
    // Each kept as a temporary page of its own beside the notes from Drive.
    const local = await openLocalDoc(store, WORKSPACE_DOC_ID);
    try {
      for (const page of written) {
        const id = crypto.randomUUID();
        await store.append(id, Y.mergeUpdates(page.updates));
        createNode(local.doc, page.kind, ROOT, `${page.title} (from this browser)`, id);
        markTemporary(local.doc, [id]);
        first.markDirty(id);
      }
    } finally {
      await local.close();
    }
    first.markDirty(WORKSPACE_DOC_ID);
    await first.sync();
  }
  setPref(PREFS.on, "1");
  if (adopt) return "reload";
  startSync();
  return "started";
}

/** Stops syncing on this device. Its notes stay; the files in Drive stay for other devices. */
export async function turnOffSync() {
  // Pages held only in memory need a place to stay once Drive no longer brings them.
  if (memoryOnly) await keepPagesHere();
  stopSync();
  for (const key of [PREFS.on, PREFS.key, PREFS.folder, PREFS.state]) removePref(key);
}
