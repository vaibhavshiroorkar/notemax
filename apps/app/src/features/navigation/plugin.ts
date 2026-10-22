import { closeOtherTabs, closeTab, layout } from "@/app/tabs";
import type { Plugin } from "@/plugins/types";

/** Focuses the open page's title with the text selected, ready to type a new one. */
function focusTitle() {
  const title = document.querySelector<HTMLInputElement>(".note-title");
  title?.focus();
  title?.select();
}

export const navigationPlugin: Plugin = {
  id: "navigation",
  name: "Moving around",
  description: "Tabs, back and forward, recent pages, focus mode",
  required: true,
  commands: [
    // Mod+[ and Mod+] as in Notion and in browsers on a Mac. The mouse's side
    // buttons and the browser's own Back work too (app/history.ts). Each tab has its own list.
    { id: "navigation.back", title: "Go back", keywords: ["previous", "history"], shortcut: "Mod+[", when: (app) => app.canGoBack, run: (app) => app.goBack() },
    { id: "navigation.forward", title: "Go forward", keywords: ["next", "history"], shortcut: "Mod+]", when: (app) => app.canGoForward, run: (app) => app.goForward() },
    // A browser keeps Ctrl+T, Ctrl+W and Ctrl+Tab for itself, so on the web
    // these work from the tab bar and Ctrl+K; the desktop app gets the keys.
    { id: "navigation.new-tab", title: "New tab", keywords: ["tab", "open"], shortcut: "Mod+T", run: (app) => app.newTab() },
    { id: "navigation.close-tab", title: "Close tab", keywords: ["tab"], shortcut: "Mod+W", run: (app) => app.closeTab() },
    { id: "navigation.reopen-tab", title: "Reopen closed tab", keywords: ["tab", "undo"], shortcut: "Mod+Shift+T", run: (app) => app.reopenClosedTab() },
    { id: "navigation.next-tab", title: "Next tab", keywords: ["tab", "switch"], shortcut: "Mod+Tab", run: (app) => app.cycleTab(1) },
    { id: "navigation.previous-tab", title: "Previous tab", keywords: ["tab", "switch"], shortcut: "Mod+Shift+Tab", run: (app) => app.cycleTab(-1) },
    { id: "navigation.rename", title: "Rename the open page", keywords: ["title"], shortcut: "F2", when: (app) => app.activeId !== null, run: focusTitle },
    {
      id: "navigation.focus",
      title: "Focus mode",
      keywords: ["zen", "distraction", "hide"],
      shortcut: "Mod+Shift+F",
      run: (app) => app.toggleFocusMode(),
    },
  ],
  contextMenu: [
    { id: "navigation.tab-close", title: "Close tab", group: "open", keys: "Mod+W", targets: ["tab"], run: (target) => target.type === "tab" && closeTab(target.tabId) },
    {
      id: "navigation.tab-close-others",
      title: "Close other tabs",
      group: "open",
      targets: ["tab"],
      disabled: () => layout.get().panes[0].tabs.length < 2,
      run: (target) => target.type === "tab" && closeOtherTabs(target.tabId),
    },
    { id: "navigation.tab-reopen", title: "Reopen closed tab", group: "create", keys: "Mod+Shift+T", targets: ["tab"], run: (_target, app) => app.reopenClosedTab() },
    { id: "navigation.tab-new", title: "New tab", group: "create", keys: "Mod+T", targets: ["tab"], run: (_target, app) => app.newTab() },
  ],
};
