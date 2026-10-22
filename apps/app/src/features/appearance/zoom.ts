import { isDesktop } from "@/platform/platform";
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

export const zoomBy = (steps: number) => zoom.set(clampZoom(zoom.get() + steps * ZOOM.step));

/** In the desktop app: applies the saved zoom, and Ctrl with the wheel changes it. */
export function startZoom() {
  if (!isDesktop) return;
  void applyZoom().catch(() => {});
  zoom.subscribe(() => void applyZoom().catch(() => {}));
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
