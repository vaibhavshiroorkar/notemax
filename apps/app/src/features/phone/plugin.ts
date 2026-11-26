import { isPhoneApp } from "@/platform/platform";
import type { AppContext, Plugin } from "@/plugins/types";
import { startBackGesture } from "./back";
import { PHONE_LINK, openPhoneLink } from "./links";

const SEEN_KEY = "notemax:phoneLink";

const act = (app: AppContext, link: string) =>
  openPhoneLink(app, link).catch((err) => {
    console.warn("[notemax] could not open", link, err);
    app.notify("Could not save what was shared");
  });

/** Share to Notemax, and the launcher's shortcuts, in the Android app. */
async function listen(app: AppContext) {
  const { getCurrent, onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
  // A link that started the app. A reload sees it again, so it is used once.
  const first = (await getCurrent())?.find((u) => u.startsWith(PHONE_LINK));
  if (first && sessionStorage.getItem(SEEN_KEY) !== first) {
    sessionStorage.setItem(SEEN_KEY, first);
    await act(app, first);
  }
  // Links while the app runs, like a second share.
  await onOpenUrl((urls) => {
    for (const url of urls) {
      if (!url.startsWith(PHONE_LINK)) continue;
      sessionStorage.setItem(SEEN_KEY, url);
      void act(app, url);
    }
  });
}

export const phonePlugin: Plugin = {
  id: "phone",
  name: "Phone app",
  description: "Share text to Notemax from other apps, shortcuts on the app's icon, and the Back gesture (Android app)",
  required: true,
  start: (app) => {
    if (!isPhoneApp) return;
    void listen(app).catch((err) => console.warn("[notemax] phone links are off", err));
    void startBackGesture(app).catch((err) => console.warn("[notemax] the Back gesture is the system's", err));
  },
};
