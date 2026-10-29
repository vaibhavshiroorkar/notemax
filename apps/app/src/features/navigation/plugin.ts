import { activePane, activateTab, arrange, arrangementOf, canSplit, closeOtherTabs, closePane, closeTab, layout, splitActive, splitTab, type Arrangement } from "@/app/tabs";
import { isDesktop } from "@/platform/platform";
import { registry } from "@/plugins/registry";
import { matchesShortcut, shortcutFor } from "@/plugins/shortcuts";
import type { AppContext, Command, ContextMenuItem, Plugin } from "@/plugins/types";

/** Focuses the open page's title with the text selected, ready to type a new one. */
function focusTitle() {
  const title = document.querySelector<HTMLInputElement>(".note-title");
  title?.focus();
  title?.select();
}

const ARRANGEMENTS: { kind: Arrangement; title: string }[] = [
  { kind: "one", title: "One pane" },
  { kind: "side", title: "Two, side by side" },
  { kind: "stacked", title: "Two, one above the other" },
  { kind: "three", title: "Three: one left, two right" },
  { kind: "four", title: "Four: two by two" },
];

const LAYOUT_ITEMS: ContextMenuItem[] = ARRANGEMENTS.map(({ kind, title }) => ({
  id: `navigation.layout.${kind}`,
  title,
  group: "layout",
  targets: ["layout"],
  // The shape the panes are in now shows greyed out.
  disabled: () => arrangementOf() === kind,
  run: () => arrange(kind),
}));

const LAYOUT_COMMANDS: Command[] = ARRANGEMENTS.map(({ kind, title }) => ({
  id: `navigation.layout-${kind}`,
  title: `Layout: ${title.toLowerCase()}`,
  keywords: ["split", "pane", "layout", "view", "grid"],
  run: () => arrange(kind),
}));

/** Ctrl+1 to Ctrl+8 pick that tab and Ctrl+9 the last, as in a browser. */
function pickTab(digit: number) {
  const tabs = activePane().tabs;
  const tab = digit === 9 ? tabs.at(-1) : tabs[digit - 1];
  if (tab) activateTab(tab.id);
}

async function toggleFullScreen() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const window = getCurrentWindow();
  await window.setFullscreen(!(await window.isFullscreen()));
}

/**
 * Keys people expect from any app, kept off the command list so the palette
 * stays short. A browser keeps some of them (Ctrl+1, Ctrl+PageDown) for its
 * own tabs, so on the web they reach the app only where the browser lets go.
 */
function everydayKeys(app: AppContext) {
  window.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.altKey) return;
    const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? event.metaKey : event.ctrlKey;
    if (event.key === "F11" && isDesktop && !mod && !event.shiftKey) {
      event.preventDefault();
      void toggleFullScreen();
      return;
    }
    if (!mod || event.shiftKey) return;
    // A key someone gave to a command in Settings is that command's.
    if (registry.commands(app).some((command) => matchesShortcut(event, shortcutFor(command) || "-"))) return;
    const digit = /^Digit([1-9])$/.exec(event.code);
    if (digit) pickTab(Number(digit[1]));
    else if (event.key === "PageDown") app.cycleTab(1);
    else if (event.key === "PageUp") app.cycleTab(-1);
    // The search key of Notion, Obsidian and code editors, beside Ctrl+K.
    else if (event.code === "KeyP") app.openPalette();
    // Everything saves as it is typed, so Ctrl+S only says so, instead of saving the web page.
    else if (event.code === "KeyS") app.notify("Saved. Notemax saves as you type.");
    else return;
    event.preventDefault();
  });
}

export const navigationPlugin: Plugin = {
  id: "navigation",
  name: "Moving around",
  description: "Tabs, back and forward, recent pages, focus mode",
  required: true,
  shortcutHints: [
    { title: "Go back", keys: "Alt+Left" },
    { title: "Go forward", keys: "Alt+Right" },
    { title: "Go to a tab by its number (1 to 8, 9 for the last)", keys: "Mod+1" },
    { title: "Search notes and commands", keys: "Mod+P" },
    { title: "Next tab", keys: "Mod+PageDown" },
    { title: "Previous tab", keys: "Mod+PageUp" },
    ...(isDesktop ? [{ title: "Full screen", keys: "F11" }] : []),
  ],
  start: everydayKeys,
  commands: [
    // Mod+[ and Mod+] as in Notion and in browsers on a Mac. Alt+arrows, the
    // mouse's side buttons and the browser's own Back work too (app/history.ts). Each tab has its own list.
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
    // Split view: the open page again beside or below, in a pane of its own.
    { id: "navigation.split-right", title: "Split right", keywords: ["split", "side by side", "pane", "column"], when: () => canSplit(), run: () => splitActive("right") },
    { id: "navigation.split-down", title: "Split down", keywords: ["split", "pane", "row", "below"], when: () => canSplit(), run: () => splitActive("bottom") },
    ...LAYOUT_COMMANDS,
    { id: "navigation.close-pane", title: "Close this pane", keywords: ["split", "pane"], when: () => layout.get().panes.length > 1, run: () => closePane() },
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
      disabled: () => activePane().tabs.length < 2,
      run: (target) => target.type === "tab" && closeOtherTabs(target.tabId),
    },
    ...LAYOUT_ITEMS,
    { id: "navigation.tab-split-right", title: "Move to a new pane on the right", group: "layout", targets: ["tab"], disabled: () => !canSplit(), run: (target) => target.type === "tab" && splitTab(target.tabId, activePane().id, "right") },
    { id: "navigation.tab-split-down", title: "Move to a new pane below", group: "layout", targets: ["tab"], disabled: () => !canSplit(), run: (target) => target.type === "tab" && splitTab(target.tabId, activePane().id, "bottom") },
    { id: "navigation.tab-reopen", title: "Reopen closed tab", group: "create", keys: "Mod+Shift+T", targets: ["tab"], run: (_target, app) => app.reopenClosedTab() },
    { id: "navigation.tab-new", title: "New tab", group: "create", keys: "Mod+T", targets: ["tab"], run: (_target, app) => app.newTab() },
  ],
};
