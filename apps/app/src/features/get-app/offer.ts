import { isDesktop } from "@/platform/platform";
import { savedStore } from "@/platform/store";

/** The page with the Windows and Android downloads. A static file in public/, so it works without the app. */
export const DOWNLOAD_PAGE = "/download.html";

/** Which app this browser's system can get, if any. Other systems have nothing to download yet. */
export function systemWithApp(agent = navigator.userAgent): "windows" | "android" | null {
  if (/Android/.test(agent)) return "android";
  if (/Windows/.test(agent)) return "windows";
  return null;
}

/** Set once the offer is answered, either way, so it asks only once per browser. */
export const offerAnswered = savedStore("getAppAnswered", false, { decode: (raw) => raw === "1", encode: (value) => (value ? "1" : "0") });

/** An Android phone already running the installed web app has what the offer would give it. */
const installedOnAndroid = () => systemWithApp() === "android" && matchMedia("(display-mode: standalone)").matches;

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

/** True when the browser version should offer the app at all. */
export const mayOffer = () => !isDesktop && systemWithApp() !== null && !installedOnAndroid() && !quietForChecks();

export function openDownloadPage() {
  window.open(DOWNLOAD_PAGE, "_blank", "noopener");
}
