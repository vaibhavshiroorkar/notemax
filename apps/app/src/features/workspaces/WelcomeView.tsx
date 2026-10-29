import { savedStore } from "@/platform/store";
import { formatShortcut } from "@/plugins/shortcuts";
import type { AppContext } from "@/plugins/types";
import { workspaceList, nameOf } from "./list";
import { QuickStart } from "./HomeView";

/** Workspaces that have shown Welcome on this device. */
const welcomed = savedStore<string[]>("welcomed", []);

/** Browser checks get Welcome only when they start empty on purpose (useWorkspace.ts). */
function quietForChecks(): boolean {
  if (!import.meta.env.DEV || !navigator.webdriver) return false;
  try {
    return localStorage.getItem("notemax:checks:empty") !== "1";
  } catch {
    return true;
  }
}

/** True once for a workspace with no pages at all, and marks it shown. */
export function welcomeDue(app: AppContext): boolean {
  if (app.tree.byId.size > 0 || welcomed.get().includes(app.workspace) || quietForChecks()) return false;
  welcomed.set([...welcomed.get(), app.workspace]);
  return true;
}

/**
 * The tab a new workspace opens on, once. It is not a page, so nothing lands
 * in the sidebar; closing the tab is all it takes to be rid of it.
 */
export function WelcomeView({ app }: { app: AppContext; options: Record<string, unknown> }) {
  const workspace = workspaceList.use().find((w) => w.id === app.workspace);
  return (
    <article className="note welcome-view">
      <h1 className="welcome-title">{workspace ? `Welcome to ${nameOf(workspace)}` : "Welcome"}</h1>
      <p className="welcome-lead">Start with a note, a book or anything else. Everything saves as you type.</p>
      <QuickStart app={app} />
      <ul className="welcome-keys">
        <li>
          <kbd>/</kbd> in a note for headings, lists and more
        </li>
        <li>
          <kbd>[[</kbd> to link to another page
        </li>
        <li>
          <kbd>{formatShortcut("Mod+K")}</kbd> to find any page or command
        </li>
        <li>
          <kbd>{formatShortcut("Mod+/")}</kbd> for every shortcut
        </li>
      </ul>
    </article>
  );
}
