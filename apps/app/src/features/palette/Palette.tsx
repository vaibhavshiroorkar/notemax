import { useMemo, useRef, useState } from "react";
import { KINDS, ROOT, normalizeTag, searchNodes, type Tree, type TreeNode } from "@notemax/core";
import { recentPages } from "@/data/recent";
import { registry } from "@/plugins/registry";
import { formatShortcut, shortcutFor } from "@/plugins/shortcuts";
import type { AppContext, Command } from "@/plugins/types";
import { Dialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";
import { SuggestionList, type SuggestionListHandle } from "@/ui/suggestion/SuggestionList";
import "./palette.css";

type PaletteItem = { type: "page"; node: TreeNode; where: string } | { type: "command"; command: Command };

/** The folder or book an item sits in, so two pages with one title can be told apart. */
function whereOf(tree: Tree, id: string): string {
  const parentId = tree.items.get(id)?.parentId;
  if (!parentId || parentId === ROOT) return "";
  const parent = tree.items.get(parentId);
  return parent?.title || `Untitled ${parent?.kind ?? "folder"}`;
}

/** Same rule as the / menu: the query matches the start of any word in the title or keywords. */
function matchesCommand(command: Command, q: string): boolean {
  if (!q) return true;
  const title = command.title.toLowerCase();
  return title.includes(q) || [...title.split(/\s+/), ...(command.keywords ?? [])].some((word) => word.startsWith(q));
}

/** Splits "#fanfic dragon" into the tags and the words to look for in titles. */
function splitTags(query: string) {
  const tags: string[] = [];
  const words = query.split(/\s+/).filter((word) => {
    if (!word.startsWith("#")) return true;
    const tag = normalizeTag(word);
    if (tag) tags.push(tag);
    return false;
  });
  return { tags, text: words.join(" ") };
}

const RECENT_SHOWN = 8;
// Everything that opens as a page. Folders only sort things.
const PAGE_KINDS = KINDS.filter((kind) => kind !== "folder");

/** Recently opened notes and books that are still in the sidebar, the open one left out. */
function recentNodes(app: AppContext): TreeNode[] {
  return recentPages
    .get()
    .filter((id) => id !== app.activeId && app.tree.visible.has(id))
    .map((id) => app.tree.byId.get(id)!)
    .filter((node) => node.kind !== "folder")
    .slice(0, RECENT_SHOWN);
}

function search(app: AppContext, query: string): PaletteItem[] {
  // A leading > means commands only, as in most editors.
  const commandsOnly = query.startsWith(">");
  if (!commandsOnly && query.includes("#")) {
    // Tags narrow the pages. Commands have no tags, so they drop out.
    const { tags, text } = splitTags(query);
    return searchNodes(app.tree, text.trim().toLowerCase(), { kinds: PAGE_KINDS, tags, limit: 20 }).map((node) => ({
      type: "page",
      node,
      where: whereOf(app.tree, node.id),
    }));
  }
  const q = (commandsOnly ? query.slice(1) : query).trim().toLowerCase();
  // Before anything is typed, the pages worth offering are the ones opened lately.
  const found = commandsOnly ? [] : q ? searchNodes(app.tree, q, { kinds: PAGE_KINDS }) : recentNodes(app);
  const pages: PaletteItem[] = found.map((node) => ({ type: "page", node, where: whereOf(app.tree, node.id) }));
  const commands: PaletteItem[] = registry
    .commands(app)
    .filter((command) => command.id !== "palette.open" && matchesCommand(command, q))
    .map((command) => ({ type: "command", command }));
  return [...pages, ...commands];
}

/** Ctrl+K: jump to any note or book, or run any command a plugin registered. */
export function Palette({ app, onClose }: { app: AppContext; onClose(): void }) {
  const [query, setQuery] = useState("");
  const list = useRef<SuggestionListHandle>(null);
  // The list resets its selection whenever `items` changes, so only rebuild it when the inputs do.
  const items = useMemo(() => search(app, query), [query, app.tree, app.activeId]);

  const pick = (item: PaletteItem) => {
    onClose();
    if (item.type === "page") app.open(item.node.id);
    else item.command.run(app);
  };

  return (
    <Dialog label="Search notes and commands" onClose={onClose} className="palette">
      <input
        className="palette-input"
        aria-label="Search"
        placeholder="Search pages, #tag to filter, > for commands"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (list.current?.onKeyDown(event.nativeEvent)) event.preventDefault();
        }}
      />
      <SuggestionList
        ref={list}
        items={items}
        command={pick}
        label="Results"
        className="palette-list"
        empty="Nothing found"
        itemKey={(item) => (item.type === "page" ? item.node.id : item.command.id)}
        renderItem={(item) =>
          item.type === "page" ? (
            <>
              <span className="palette-item">
                <Icon name={registry.iconOf(item.node.kind)} />
                <span className="suggest-title">{item.node.title || "Untitled"}</span>
              </span>
              {item.where && <span className="suggest-detail">{item.where}</span>}
            </>
          ) : (
            <>
              <span className="palette-item">
                <Icon name="command" />
                <span className="suggest-title">{item.command.title}</span>
              </span>
              {shortcutFor(item.command) && <kbd>{formatShortcut(shortcutFor(item.command))}</kbd>}
            </>
          )
        }
      />
    </Dialog>
  );
}
