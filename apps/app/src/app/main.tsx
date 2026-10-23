import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initAppearance } from "@/ui/appearance";
import { leaveLongPressToThePhone } from "@/ui/longPress";
// Shared styles first, so each feature's own stylesheet loads after them.
import "@/ui/ui.css";
// Built-in features register before the first render.
import "@/plugins/builtin";
import { startOffline } from "@/platform/offline";
import { startSettingsSync } from "@/platform/settingsSync";
import { listenForQuit } from "@/platform/quit";
import { loadCommunityPlugins } from "@/plugins/community";
import { App } from "./App";

initAppearance();
startOffline();
// When storage cannot open, the app says why on screen; settings just wait for the next start.
startSettingsSync().catch(() => {});
leaveLongPressToThePhone();
void listenForQuit();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// After the first page shows, so a slow plugin never holds up startup.
void loadCommunityPlugins();
