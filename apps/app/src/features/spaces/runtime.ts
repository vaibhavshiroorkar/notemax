import { createSyncEngine, importKey, scopedStore, splitScoped, type SharedSpace, type SyncState, type SyncStatus } from "@notemax/core";
import { accountView } from "@/features/account/session";
import { noteRemoteEdit } from "@/features/sync/live";
import { openList, workspaceList } from "@/features/workspaces/list";
import { deviceId } from "@/platform/device";
import { docChannelFor, getRawStore, onLocalWrite } from "@/platform/platform";
import { getPref, removePref, setPref, workspaceNow } from "@/platform/prefs";
import { createStore } from "@/platform/store";
import { locksChanged } from "@/plugins/registry";
import { messageOf } from "@/ui/format";
import { showToast } from "@/ui/toast";
import { atLeast, openSpace, type SpaceInfo } from "./api";
import { setViewOnly } from "./guard";
import { spaceRemote } from "./remote";

// Every shared workspace this device has syncs through Supabase on its own,
// beside Drive. Each window learns its role in each one, so it can lock pages
// for a viewer; only one window at a time moves the files.

export type SpaceView =
  | { state: "opening" }
  | { state: "ready"; info: SpaceInfo; sync?: SyncStatus }
  /** The share was stopped, or this person was taken off it. The pages here stay. */
  | { state: "gone" }
  | { state: "error"; message: string };

/** Each shared workspace's state, by workspace id. */
export const spaceViews = createStore<Record<string, SpaceView>>({});

const viewOf = (workspace: string) => spaceViews.get()[workspace];
function setView(workspace: string, view: SpaceView | undefined) {
  const next = { ...spaceViews.get() };
  if (view) next[workspace] = view;
  else delete next[workspace];
  spaceViews.set(next);
  const info = view?.state === "ready" ? view.info : null;
  setViewOnly(workspace, !!info && !atLeast(info.role, "editor"));
  locksChanged();
}

/** Whether this person may only read the workspace. */
export function isViewOnly(workspace: string): boolean {
  const view = viewOf(workspace);
  return view?.state === "ready" && !atLeast(view.info.role, "editor");
}

/** How often to look for others' edits while the window shows. A poke from them comes sooner. */
const POLL_MS = 20_000;
/** How long after an edit to send it, so a burst of typing goes once. */
const SEND_AFTER_MS = 1000;
/** How often to ask again what this person may do, in case it changed. */
const ROLE_MS = 60_000;
const RETRY_MS = 30_000;

const statePref = (space: string) => `spaceSync:${space}`;

function loadState(space: string): SyncState {
  try {
    const value = JSON.parse(getPref(statePref(space)) ?? "") as SyncState;
    return { cursor: typeof value.cursor === "string" ? value.cursor : null, dirty: Array.isArray(value.dirty) ? value.dirty : [] };
  } catch {
    return { cursor: null, dirty: [] };
  }
}

/** Forgets where sync got to, so joining again reads everything. */
export const forgetSpaceState = (space: string) => removePref(statePref(space));

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
  });

/** Moves files for one shared workspace until stopped. Runs in one window at a time. */
async function moveFiles(workspace: string, shared: SharedSpace, signal: AbortSignal) {
  const view = viewOf(workspace);
  if (view?.state !== "ready") return;
  const key = await importKey(view.info.key);
  const store = scopedStore(await getRawStore(), workspace);
  // A device that has none of its pages (new, or one that keeps nothing) reads from the start.
  if ((await store.list()).length === 0) forgetSpaceState(shared.space);
  const role = () => {
    const now = viewOf(workspace);
    return now?.state === "ready" ? now.info.role : null;
  };
  const pages = new BroadcastChannel(docChannelFor(workspace));
  let wrote = false;
  let warnedBig = false;
  const engine = createSyncEngine({
    store,
    key,
    device: deviceId(),
    remote: spaceRemote({
      space: shared.space,
      token: shared.token,
      device: deviceId(),
      canWrite: () => atLeast(role(), "editor"),
      onWrite: () => (wrote = true),
      onTooBig: () => {
        if (warnedBig) return;
        warnedBig = true;
        showToast("A file in this workspace is too big to share, like a long video. It stays on your devices.");
      },
    }),
    loadState: () => loadState(shared.space),
    saveState: (state) => setPref(statePref(shared.space), JSON.stringify(state)),
    // Open pages in every window merge it, as they do edits from Drive.
    onRemoteUpdate(docId, update) {
      pages.postMessage({ docId, update });
      if (workspace === workspaceNow()) noteRemoteEdit(docId);
    },
    onStatus(status) {
      const now = viewOf(workspace);
      if (now?.state === "ready") setView(workspace, { ...now, sync: status });
    },
  });

  // The others hear a poke after each send and look at once, instead of at their next poll.
  const { supabase } = await import("@/features/account/client");
  const channel = supabase.channel(`notemax-space-${shared.space}`, { config: { broadcast: { self: false } } });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    clearTimeout(timer);
    timer = undefined;
    engine
      .sync()
      .then(() => {
        if (!wrote) return;
        wrote = false;
        void channel.send({ type: "broadcast", event: "poke", payload: {} });
      })
      .catch(() => {
        // Shown through the status; the next poll tries again.
      });
  };
  const soon = () => (timer ??= setTimeout(run, SEND_AFTER_MS));
  channel.on("broadcast", { event: "poke" }, run).subscribe();

  const stopWrites = onLocalWrite(({ docId }) => {
    const scoped = splitScoped(docId);
    if (scoped.workspace !== workspace) return;
    engine.markDirty(scoped.docId);
    soon();
  });
  const poll = setInterval(() => document.visibilityState === "visible" && run(), POLL_MS);
  const onWake = () => document.visibilityState === "visible" && run();
  const sendWaiting = () => loadState(shared.space).dirty.length > 0 && run();
  window.addEventListener("online", run);
  window.addEventListener("focus", run);
  window.addEventListener("pagehide", sendWaiting);
  document.addEventListener("visibilitychange", onWake);

  // The owner's devices send every page they have that the shared copy lacks,
  // which is the whole workspace the first time. Others send what they edit.
  if (role() === "owner") await engine.catchUp().catch(() => {});
  run();

  await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
  stopWrites();
  clearInterval(poll);
  clearTimeout(timer);
  window.removeEventListener("online", run);
  window.removeEventListener("focus", run);
  window.removeEventListener("pagehide", sendWaiting);
  document.removeEventListener("visibilitychange", onWake);
  pages.close();
  void supabase.removeChannel(channel);
}

/** Learns this person's role, keeps it current, and moves the files while the workspace stays shared. */
function follow(workspace: string, shared: SharedSpace): { stop(): void; refresh(): void } {
  const controller = new AbortController();
  const { signal } = controller;
  setView(workspace, { state: "opening" });

  const learnRole = async () => {
    const info = await openSpace(shared.space, shared.token);
    if (signal.aborted) return;
    const before = viewOf(workspace);
    if (!info) setView(workspace, { state: "gone" });
    else setView(workspace, { state: "ready", info, sync: before?.state === "ready" ? before.sync : undefined });
  };

  void (async () => {
    // Until the role is known, nothing moves. Offline or a server hiccup tries again later.
    while (!signal.aborted && viewOf(workspace)?.state !== "ready") {
      try {
        await learnRole();
        if (viewOf(workspace)?.state === "gone") return;
      } catch (error) {
        if (signal.aborted) return;
        setView(workspace, { state: "error", message: messageOf(error) });
        await sleep(RETRY_MS, signal);
      }
    }
    if (signal.aborted) return;
    const recheck = setInterval(() => void learnRole().catch(() => {}), ROLE_MS);
    // Signing in or out can change the role, like a link that edits only for people signed in.
    const stopAccount = accountView.subscribe(() => void learnRole().catch(() => {}));
    signal.addEventListener("abort", () => {
      clearInterval(recheck);
      stopAccount();
    });
    const body = () => moveFiles(workspace, shared, signal);
    const failed = (error: unknown) => !signal.aborted && setView(workspace, { state: "error", message: messageOf(error) });
    if (navigator.locks) void navigator.locks.request(`notemax-space-${shared.space}`, { signal }, body).catch(failed);
    else void body().catch(failed);
  })();

  return {
    stop() {
      controller.abort();
      setView(workspace, undefined);
    },
    refresh: () => void learnRole().catch(() => {}),
  };
}

const running = new Map<string, { space: string; token: string | null; stop(): void; refresh(): void }>();

/** Watches the list of workspaces and keeps one follower per shared workspace. */
export function startSpaces() {
  void openList();
  const update = () => {
    const wanted = new Map(workspaceList.get().flatMap((w) => (w.shared ? [[w.id, w.shared] as const] : [])));
    for (const [id, run] of running) {
      const now = wanted.get(id);
      if (now && now.space === run.space && now.token === run.token) continue;
      run.stop();
      running.delete(id);
    }
    for (const [id, shared] of wanted) if (!running.has(id)) running.set(id, { ...shared, ...follow(id, shared) });
  };
  workspaceList.subscribe(update);
  update();
}

/** Asks the server again at once what this person may do, as after changing the link. */
export const refreshSpace = (workspace: string) => running.get(workspace)?.refresh();
