import { getPref, setPref } from "./prefs";

export type Theme = "system" | "light" | "dark";
const KEY = "theme";

export function getTheme(): Theme {
  const saved = getPref(KEY);
  return saved === "light" || saved === "dark" ? saved : "system";
}

function apply(theme: Theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export function setTheme(theme: Theme) {
  setPref(KEY, theme);
  apply(theme);
}

/**
 * Applies the saved theme now and whenever another window changes it, so the
 * capture box always matches the main window. Call before the first render.
 */
export function initTheme() {
  apply(getTheme());
  window.addEventListener("storage", (event) => {
    if (event.key?.endsWith(KEY)) apply(getTheme());
  });
}
