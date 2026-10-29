import { isDesktop } from "@/platform/platform";
import type { AppContext } from "@/plugins/types";
import { savedStore } from "@/platform/store";

// Zoom scales the whole app, apart from text size, which is only the note's
// text. A browser has its own zoom (Ctrl and the mouse wheel) for this. The
// desktop app has none, so it gets one here, through the webview itself so
// that clicks on boards still land where they look.

export const ZOOM = { min: 50, max: 200, step: 10, normal: 100 };
const clampZoom = (percent: number) => Math.min(ZOOM.max, Math.max(ZOOM.min, Math.round(percent)));

/** Percent. Only the desktop app uses it. */
export const zoom = savedStore<number>("zoom", ZOOM.normal, {
  decode(raw) {
    const percent = Number(raw);
    if (!Number.isFinite(percent)) throw new Error(`bad zoom ${raw}`);
    return clampZoom(percent);
  },
  encode: String,
});

async function applyZoom() {
  const { getCurrentWebview } = await import("@tauri-apps/api/webview");
  await getCurrentWebview().setZoom(zoom.get() / 100);
}

/** Tells the new size, once the app is up. The Settings slider shows its own number and skips this. */
let say = (_percent: number) => {};

/** From the keys, the wheel and the palette. */
export function zoomTo(percent: number) {
  zoom.set(clampZoom(percent));
  say(zoom.get());
}
export const zoomBy = (steps: number) => zoomTo(zoom.get() + steps * ZOOM.step);

/**
 * In the desktop app: applies the saved zoom, and Ctrl with the wheel changes
 * it. Ctrl+=, Ctrl+- and Ctrl+0 are commands; Ctrl++ (with Shift) and the
 * keypad's + are caught here, since they are the same key to a person but not
 * to a shortcut.
 */
export function startZoom(app: AppContext) {
  if (!isDesktop) return;
  void applyZoom().catch(() => {});
  say = (percent) => app.notify(`Zoom ${percent}%`);
  zoom.subscribe(() => void applyZoom().catch(() => {}));
  window.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.altKey) return;
    if (event.code === "NumpadAdd" || (event.code === "Equal" && event.shiftKey)) {
      event.preventDefault();
      zoomBy(1);
    }
  });
  window.addEventListener(
    "wheel",
    (event) => {
      // Boards and the graph zoom their own drawing with Ctrl and the wheel.
      if (!event.ctrlKey || (event.target instanceof Element && event.target.closest(".excalidraw, canvas"))) return;
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1 : -1);
    },
    { passive: false },
  );
}
