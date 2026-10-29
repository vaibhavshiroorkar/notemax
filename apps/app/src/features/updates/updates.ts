import type { Update } from "@tauri-apps/plugin-updater";
import { isDesktop } from "@/platform/platform";
import { beforeQuit } from "@/platform/quit";
import { autoUpdate } from "@/platform/behavior";
import { createStore } from "@/platform/store";

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

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

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
    updateState.set({ state: "error", message: message(error) });
  }
}

/** Puts the new version in place now: the website reloads, the desktop app installs and starts again. */
export async function installUpdate(): Promise<void> {
  if (!isDesktop) {
    const worker = await waitingWorker();
    if (!worker) return location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
    worker.postMessage("update");
    return;
  }
  if (!pending) return;
  try {
    await pending.install();
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (error) {
    updateState.set({ state: "error", message: message(error) });
  }
}

const HOURS_6 = 6 * 60 * 60 * 1000;

/**
 * The desktop app looks on its own a little after it opens, and every few
 * hours, while Update automatically is on. A downloaded update installs when
 * the app quits, so nothing closes under someone's typing.
 */
export function startDesktopUpdates() {
  if (!isDesktop || import.meta.env.DEV) return;
  const look = () => autoUpdate.get() && void checkForUpdate();
  setTimeout(look, 20_000);
  setInterval(look, HOURS_6);
  beforeQuit(async () => {
    if (pending && autoUpdate.get()) await pending.install();
  });
}
