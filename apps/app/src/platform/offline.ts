import { showToast } from "@/ui/toast";
import { isDesktop } from "./platform";

/**
 * Lets the web app open with no network (see sw.js). A new version waits until
 * the user says to reload, so it never swaps the app out from under typing.
 */
export function startOffline() {
  if (isDesktop || !import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const offer = (worker: ServiceWorker) =>
        showToast("A new version of Notemax is ready.", {
          label: "Reload",
          run: () => {
            navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
            worker.postMessage("update");
          },
        });
      // A first install has no controller yet and needs no reload.
      if (registration.waiting && navigator.serviceWorker.controller) offer(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) offer(worker);
        });
      });
      // Phones keep an installed app open for days; look for updates when it comes back.
      document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void registration.update());
    } catch (err) {
      console.warn("[notemax] offline support is not available", err);
    }
  });
}
