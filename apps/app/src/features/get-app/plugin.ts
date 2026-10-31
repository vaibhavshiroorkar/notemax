import { isDesktop } from "@/platform/platform";
import type { Plugin } from "@/plugins/types";
import { GetAppCard } from "./GetAppCard";
import { openDownloadPage } from "./offer";
import "./get-app.css";

export const getAppPlugin: Plugin = {
  id: "get-app",
  name: "Get the app",
  description: "Offers the Windows and Android apps in the browser version",
  floating: [{ id: "get-app.card", component: GetAppCard }],
  commands: [
    {
      id: "get-app.open",
      title: "Get the Windows or Android app",
      keywords: ["download", "install", "desktop", "windows", "android", "phone", "app"],
      when: () => !isDesktop,
      run: openDownloadPage,
    },
  ],
};
