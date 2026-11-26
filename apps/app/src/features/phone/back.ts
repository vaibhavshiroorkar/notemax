import { canGoBack, layout } from "@/app/tabs";
import type { AppContext } from "@/plugins/types";

/**
 * Android's Back gesture. The web view's own history cannot carry it: Chrome
 * skips history entries a page adds without a tap, so Back closed the app
 * from any page. Tauri hands Back to the page while a listener is registered,
 * and otherwise does what Android does, which puts the app in the background.
 * So a listener is registered only while the open tab has a page to go back to.
 */
export async function startBackGesture(app: AppContext): Promise<() => void> {
  const { onBackButtonPress } = await import("@tauri-apps/api/app");
  let listener: { unregister(): Promise<void> } | null = null;
  let wanted = false;
  let busy = Promise.resolve();

  // Registering and unregistering take a round trip each, so they run in order.
  const follow = () => {
    const want = canGoBack(layout.get());
    if (want === wanted) return;
    wanted = want;
    busy = busy
      .then(async () => {
        if (want && !listener) listener = await onBackButtonPress(() => app.goBack());
        else if (!want && listener) {
          await listener.unregister();
          listener = null;
        }
      })
      .catch((err) => console.warn("[notemax] the Back gesture could not follow the tabs", err));
  };
  follow();
  const stop = layout.subscribe(follow);
  return () => {
    stop();
    void busy.then(() => listener?.unregister());
  };
}
