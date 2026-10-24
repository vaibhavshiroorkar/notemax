import { createContext, useContext } from "react";
import { onWorkspaceChange, workspaceNow } from "@/platform/prefs";
import { createStore } from "@/platform/store";

/** The workspace the sidebar shows, watchable. */
export const shownWorkspace = createStore(workspaceNow());
onWorkspaceChange(() => shownWorkspace.set(workspaceNow()));

/**
 * The workspace of the page being drawn. A tab can hold a page from another
 * workspace than the one shown; everything inside that page reads and saves
 * through this, so nothing of it lands in the shown workspace.
 */
export const PageWorkspace = createContext<string | null>(null);

/** The workspace of the page this component is part of, or the shown one outside any page. */
export function usePageWorkspace(): string {
  const page = useContext(PageWorkspace);
  const shown = shownWorkspace.use();
  return page ?? shown;
}

/**
 * The workspace of the page an element sits in, for code that has an element
 * but no React context, like pasting into a note. Pages from another
 * workspace mark their box with data-workspace.
 */
export function workspaceOf(element: Element | null | undefined): string {
  return element?.closest<HTMLElement>("[data-workspace]")?.dataset.workspace ?? workspaceNow();
}
