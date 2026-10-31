import { isDesktop } from "@/platform/platform";
import { createStore, savedStore } from "@/platform/store";

/** The tab with the Windows and Android downloads. /download on the website opens it too. */
export const DOWNLOAD_VIEW = "download";

export type System = "windows" | "android";

/** Which app this device's system can run, if any. */
export function systemOf(agent = navigator.userAgent): System | null {
  if (/Android/.test(agent)) return "android";
  if (/Windows/.test(agent)) return "windows";
  return null;
}

/**
 * True inside the Android app. The app is the website in a full-screen Chrome
 * window (a Trusted Web Activity), so it looks like an installed web app.
 */
export const inAndroidApp = !isDesktop && systemOf() === "android" && matchMedia("(display-mode: standalone)").matches;

/** Set once the corner card is answered, either way, so it asks only once per browser. */
export const offerAnswered = savedStore("getAppAnswered", false, { decode: (raw) => raw === "1", encode: (value) => (value ? "1" : "0") });

/**
 * Browser checks drive a fresh profile each time, and a card in the corner
 * would sit over what they click. On the dev server, under automation, it
 * stays away unless a check asks for it. The built app always offers.
 */
function quietForChecks(): boolean {
  if (!import.meta.env.DEV || !navigator.webdriver) return false;
  try {
    return localStorage.getItem("notemax:checks:getapp") !== "ask";
  } catch {
    return true;
  }
}

/** True when the corner card should offer the app: a browser on a system that has one. */
export const mayOffer = () => !isDesktop && !inAndroidApp && systemOf() !== null && !quietForChecks();

// The downloads live on the website. The desktop app asks the website for them.
const SITE = isDesktop ? "https://notemax.pages.dev" : "";

export interface Download {
  url: string;
  version: string;
  /** In bytes, when the server said. */
  size?: number;
}

/** Version numbers end in .0 for now, which says nothing. */
const shortVersion = (version: string) => version.replace(/\.0$/, "");

async function sizeOf(url: string): Promise<number | undefined> {
  const head = await fetch(url, { method: "HEAD" }).catch(() => null);
  const size = Number(head?.headers.get("content-length"));
  return size > 0 ? size : undefined;
}

/**
 * The newest Windows installer. The desktop release (scripts/release-desktop.mjs)
 * writes latest.json next to it. Its address is used as a path on this site, so
 * it also works on a preview deploy and on the dev server.
 */
async function findWindows(): Promise<Download | null> {
  const response = await fetch(`${SITE}/desktop/latest.json`, { cache: "no-store" });
  if (!response.ok) return null;
  const latest = (await response.json()) as { version: string; platforms: Record<string, { url: string }> };
  const url = SITE + new URL(latest.platforms["windows-x86_64"].url).pathname;
  return { url, version: shortVersion(latest.version), size: await sizeOf(url) };
}

/**
 * The newest Android app, written by scripts/release-android.mjs. "none" when
 * there is no release yet: the site then answers with the app's own page.
 */
async function findAndroid(): Promise<Download | "none"> {
  const response = await fetch(`${SITE}/android/latest.json`, { cache: "no-store" });
  if (!response.ok || !response.headers.get("content-type")?.includes("json")) return "none";
  const latest = (await response.json()) as { version: string; file: string };
  const url = `${SITE}/android/${latest.file}`;
  return { url, version: shortVersion(latest.version), size: await sizeOf(url) };
}

/** Each download: undefined while asking, null when it could not be reached. Asked once per start. */
export const downloads = createStore<{ windows?: Download | null; android?: Download | "none" | null }>({});
let asked = false;
export function askForDownloads() {
  if (asked) return;
  asked = true;
  void findWindows()
    .catch(() => null)
    .then((windows) => downloads.set({ ...downloads.get(), windows }));
  void findAndroid()
    .catch(() => null)
    .then((android) => downloads.set({ ...downloads.get(), android }));
}

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let installPrompt: InstallPrompt | null = null;
/** True when Chrome on Android can install the web app with one tap. */
export const canInstall = createStore(false);

// Only on Android: on a PC the same prompt would install a browser window,
// which is not what the Android card offers. Chrome's own install bar gives
// way to the card's button.
if (!isDesktop && systemOf() === "android") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as InstallPrompt;
    canInstall.set(true);
  });
  window.addEventListener("appinstalled", () => canInstall.set(false));
}

/** Asks Chrome to install the web app. */
export async function installWebApp() {
  if (!installPrompt) return;
  await installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  if (outcome === "accepted") canInstall.set(false);
  installPrompt = null;
}

export const megabytes = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;
