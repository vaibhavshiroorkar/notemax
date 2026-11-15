import type { Update } from "@tauri-apps/plugin-updater";
import { isDesktop, isPhoneApp } from "@/platform/platform";
import { APP_VERSION } from "@/version";
import { beforeQuit, runQuitHooks } from "@/platform/quit";
import { autoUpdate } from "@/platform/behavior";
import { createStore } from "@/platform/store";
import { messageOf } from "@/ui/format";
import { showToast } from "@/ui/toast";

export type UpdateState =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "latest"; at: number }
  | { state: "downloading"; version: string }
  | { state: "ready"; version: string }
  | { state: "error"; message: string };

export const updateState = createStore<UpdateState>({ state: "idle" });

// The desktop's downloaded update, waiting to be installed.
let pending: Update | null = null;


/** A new version of the website waiting to take over, if any. */
async function waitingWorker(): Promise<ServiceWorker | null> {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  await registration.update();
  // A fresh download takes a moment to install before it waits.
  const installing = registration.installing;
  if (installing) {
    await new Promise<void>((resolve) => {
      const done = () => installing.state !== "installing" && resolve();
      installing.addEventListener("statechange", done);
      setTimeout(resolve, 15_000);
    });
  }
  return registration.waiting && navigator.serviceWorker.controller ? registration.waiting : null;
}

/** Looks for a new version. The desktop app also downloads it, so Restart only has to install. */
export async function checkForUpdate(): Promise<void> {
  const now = updateState.get().state;
  if (now === "checking" || now === "downloading") return;
  updateState.set({ state: "checking" });
  try {
    if (isPhoneApp) {
      const newer = await newerApk();
      return updateState.set(newer ? { state: "ready", version: newer.version } : { state: "latest", at: Date.now() });
    }
    if (!isDesktop) {
      if (!import.meta.env.PROD) return updateState.set({ state: "latest", at: Date.now() });
      const worker = await waitingWorker();
      return updateState.set(worker ? { state: "ready", version: "" } : { state: "latest", at: Date.now() });
    }
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return updateState.set({ state: "latest", at: Date.now() });
    updateState.set({ state: "downloading", version: update.version });
    await update.download();
    pending = update;
    updateState.set({ state: "ready", version: update.version });
  } catch (error) {
    updateState.set({ state: "error", message: messageOf(error) });
  }
}

/** Puts the new version in place now: the website reloads, the desktop app installs and starts again. */
export async function installUpdate(): Promise<void> {
  if (isPhoneApp) {
    // Android installs an app only from a file the person opens, so the browser downloads it.
    const newer = await newerApk();
    if (!newer) return;
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(`${SITE}/android/${newer.file}`);
    return;
  }
  if (!isDesktop) {
    const worker = await waitingWorker();
    if (!worker) return location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
    worker.postMessage("update");
    return;
  }
  if (!pending) return;
  try {
    // Installing ends the app, so pages are saved and edits sent first, as on Quit.
    await runQuitHooks({ withLast: false });
    await pending.install();
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (error) {
    updateState.set({ state: "error", message: messageOf(error) });
  }
}

const HOURS_6 = 6 * 60 * 60 * 1000;
const SITE = "https://notemax.pages.dev";

/** The newer Android app on the website, or null when this one is the newest. */
async function newerApk(): Promise<{ version: string; file: string } | null> {
  const response = await fetch(`${SITE}/android/latest.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`could not look for updates (${response.status})`);
  const latest = (await response.json()) as { version: string; file: string };
  return isNewer(latest.version, APP_VERSION) ? latest : null;
}

/** Whether version a (like "0.120.0") comes after version b. */
export const isNewer = (a: string, b: string) => {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
};

/**
 * The desktop app looks on its own a little after it opens, and every few
 * hours, while Update automatically is on. A downloaded update installs when
 * the app quits, so nothing closes under someone's typing.
 */
export function startDesktopUpdates() {
  if (isPhoneApp && !import.meta.env.DEV) {
    // The phone app cannot install by itself; it says when a new one is out.
    const look = () =>
      void checkForUpdate().then(() => {
        const now = updateState.get();
        if (now.state === "ready") showToast(`Notemax ${now.version} is out`, { label: "Get it", run: () => void installUpdate() });
      });
    setTimeout(look, 20_000);
    setInterval(look, HOURS_6);
    return;
  }
  if (!isDesktop || import.meta.env.DEV) return;
  const look = () => autoUpdate.get() && void checkForUpdate();
  setTimeout(look, 20_000);
  setInterval(look, HOURS_6);
  // Last, since installing ends the app before any later hook could run.
  beforeQuit(
    async () => {
      if (pending && autoUpdate.get()) await pending.install();
    },
    { last: true },
  );
}
