import { isDesktop } from "@/platform/platform";
import type { Plugin } from "@/plugins/types";
import { DownloadView } from "./DownloadView";
import { GetAppCard, GetAppHome } from "./GetAppCard";
import { DOWNLOAD_VIEW, inAndroidApp } from "./offer";
import "./get-app.css";

export const getAppPlugin: Plugin = {
  id: "get-app",
  name: "Get the app",
  description: "The Windows and Android downloads, in a tab of their own",
  views: [{ id: DOWNLOAD_VIEW, title: "Get the app", icon: "download", component: DownloadView }],
  floating: [{ id: "get-app.card", component: GetAppCard }],
  // An app has no use for a card telling it to get the app.
  homeSections: isDesktop || inAndroidApp ? [] : [{ id: "get-app.home", title: "Get the app", order: 90, open: (app) => app.openView(DOWNLOAD_VIEW), component: GetAppHome }],
  commands: [
    {
      id: "get-app.open",
      title: "Get the Windows or Android app",
      keywords: ["download", "install", "desktop", "windows", "android", "phone", "apk", "app"],
      run: (app) => app.openView(DOWNLOAD_VIEW),
    },
  ],
};
