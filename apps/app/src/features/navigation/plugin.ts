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
  commands: [
    // Mod+[ and Mod+] as in Notion and in browsers on a Mac. The mouse's side
    // buttons and the browser's own Back work too, since pages are history entries.
    { id: "navigation.back", title: "Go back", keywords: ["previous", "history"], shortcut: "Mod+[", when: (app) => app.canGoBack, run: (app) => app.goBack() },
    { id: "navigation.forward", title: "Go forward", keywords: ["next", "history"], shortcut: "Mod+]", when: (app) => app.canGoForward, run: (app) => app.goForward() },
    { id: "navigation.rename", title: "Rename the open page", keywords: ["title"], shortcut: "F2", when: (app) => app.activeId !== null, run: focusTitle },
    {
      id: "navigation.focus",
      title: "Focus mode",
      keywords: ["zen", "distraction", "hide"],
      shortcut: "Mod+Shift+F",
      run: (app) => app.toggleFocusMode(),
    },
  ],
};
