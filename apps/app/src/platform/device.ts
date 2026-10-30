import { isDesktop } from "./platform";
import { getPref, setPref } from "./prefs";

const DEVICE = "deviceId";

/** This device's own id: in sync's file names, and to tell its edits from your other devices'. Made once and kept. */
export function deviceId(): string {
  let id = getPref(DEVICE);
  if (!id) {
    id = `${isDesktop ? "desktop" : "web"}-${Math.random().toString(36).slice(2, 10)}`;
    setPref(DEVICE, id);
  }
  return id;
}

/** The device in words, like "Chrome on Android" or "Desktop app on Windows", from what the browser says it is. */
export function deviceLabel(agent = navigator.userAgent): string {
  const system = /Android/.test(agent)
    ? "Android"
    : /iPhone/.test(agent)
      ? "iPhone"
      : /iPad/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1)
        ? "iPad"
        : /Windows/.test(agent)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(agent)
            ? "Mac"
            : /CrOS/.test(agent)
              ? "ChromeOS"
              : /Linux/.test(agent)
                ? "Linux"
                : "";
  if (isDesktop) return system ? `Desktop app on ${system}` : "Desktop app";
  // Order matters: Edge and Opera also say Chrome, and Chrome also says Safari.
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /OPR\/|Opera/.test(agent)
      ? "Opera"
      : /SamsungBrowser/.test(agent)
        ? "Samsung Internet"
        : /Firefox|FxiOS/.test(agent)
          ? "Firefox"
          : /Chrome|CriOS/.test(agent)
            ? "Chrome"
            : /Safari/.test(agent)
              ? "Safari"
              : "A browser";
  return system ? `${browser} on ${system}` : browser;
}
