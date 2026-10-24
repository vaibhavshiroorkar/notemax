import { memo, type CSSProperties, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { canMove, isContainer, type NodeKind, type Tree, type TreeItem } from "@notemax/core";
import { prefetchDoc } from "@/data/docCache";
import { useSelect } from "@/platform/store";
import { registry } from "@/plugins/registry";
import { subtopicsOf } from "@/features/books/reading";
import { SubtopicList } from "@/features/editor/SubtopicList";
import { BOX_FROM, showsSubtopics } from "@/features/editor/subtopics";
import { dragRowMenu } from "@/ui/ContextMenu";
import { Icon } from "@/ui/Icon";
import { dragged, endDrag, placementFor, startDrag, zoneFor, type Placement, type Zone } from "./drag";
import { collapsed, dropTarget, editingId, listedOnRight, markedId, selection, sidebarView, sortItems, toggleCollapsed } from "./state";

/**
 * Actions the rows share. The sidebar makes it once, so it never changes and
 * never makes a row redraw. Anything that changes is read from a store.
 */
export interface RowContext {
  /** The latest tree, for working out where a drop lands. */
  tree(): Tree;
  rename(id: string, title: string): void;
  select(id: string, newTab?: boolean): void;
  /** Ctrl+click and Shift+click pick rows. Returns true when the click did that, so it opens nothing. */
  pick(item: TreeItem, event: MouseEvent): boolean;
  add(kind: NodeKind, parentId: string): void;
  drop(placement: Placement): void;
  /** Right click on a row. */
  menu(id: string, event: MouseEvent): void;
}

export function Rows({ items, depth, ctx }: { items: readonly TreeItem[]; depth: number; ctx: RowContext }) {
  const sort = useSelect(sidebarView, (view) => view.sort);
  if (!items.length) return null;
  // A nested list draws a guide line down from its folder's chevron, so each level is easy to follow.
  const guide = depth > 0 ? ({ "--guide": `${16 + (depth - 1) * 14}px` } as CSSProperties) : undefined;
  return (
    <ul className={guide ? "guided" : undefined} style={guide}>
      {sortItems(items, sort).map((item) => (
        <Row key={item.id} item={item} depth={depth} ctx={ctx} />
      ))}
    </ul>
  );
}

/**
 * What sits under an open row. A note that shows its pages inside as
 * subtopics, with more than a few, lists them in a box with a filter, so it
 * never pushes the rest of the sidebar far down. A click goes to the
 * subtopic on the note's page.
 */
function Inside({ item, depth, ctx }: { item: TreeItem; depth: number; ctx: RowContext }) {
  const subtopics = showsSubtopics(item) ? subtopicsOf(item, "") : [];
  if (subtopics.length < BOX_FROM) return <Rows items={item.children} depth={depth + 1} ctx={ctx} />;
  return <SubtopicList list={subtopics} onOpen={(id) => ctx.select(id)} style={{ marginLeft: 4 + (depth + 1) * 14 }} />;
}

/** Renames a row in place. Every keystroke is saved, so Enter, Esc and clicking away all just finish. */
function NameInput({ item, ctx }: { item: TreeItem; ctx: RowContext }) {
  const folder = item.kind === "folder";
  return (
    <span className="row-title">
      <input
        className="folder-name"
        aria-label={folder ? "Folder name" : "Page name"}
        placeholder={folder ? "Folder name" : "Untitled"}
        value={item.title}
        autoFocus
        onFocus={(event) => event.target.select()}
        onChange={(event) => ctx.rename(item.id, event.target.value)}
        onKeyDown={(event) => (event.key === "Enter" || event.key === "Escape") && editingId.set(null)}
        onBlur={() => editingId.set(null)}
      />
    </span>
  );
}

/** Double-click or F2 on a row renames it right there. */
const renameHere = (id: string) => ({
  onDoubleClick: () => editingId.set(id),
  onKeyDown(event: KeyboardEvent) {
    if (event.key !== "F2") return;
    // Keeps the app-wide F2 (rename the open page) from also running.
    event.stopPropagation();
    event.preventDefault();
    editingId.set(id);
  },
});

// Resting on a note for a moment, or pressing on it, starts loading it, so the
// click usually finds it ready. Passing over rows on the way elsewhere does not.
const HOVER_MS = 80;
let hoverTimer: ReturnType<typeof setTimeout> | undefined;
const prefetchOnHover = (id: string) => ({
  onPointerEnter: () => {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => prefetchDoc(id), HOVER_MS);
  },
  onPointerLeave: () => clearTimeout(hoverTimer),
  onPointerDown: () => prefetchDoc(id),
});

const setDropTarget = (id: string, zone: Zone) => {
  const current = dropTarget.get();
  // Dragover fires many times a second; only a real change is worth telling the rows about.
  if (current?.id !== id || current.zone !== zone) dropTarget.set({ id, zone });
};

// Memoized: the tree keeps unchanged items as the same objects, so a row redraws
// only when its own item, or something inside it, changed.
const Row = memo(function Row({ item, depth, ctx }: { item: TreeItem; depth: number; ctx: RowContext }) {
  const open = useSelect(collapsed, (closed) => !closed.has(item.id));
  const editing = useSelect(editingId, (id) => id === item.id);
  const current = useSelect(markedId, (id) => id === item.id);
  const selected = useSelect(selection, (picked) => picked.has(item.id));
  // A picked row fades with the one being dragged, since they all move together.
  const isDragged = useSelect(dragged, (d) => !!d && (d.id === item.id || (selected && selection.get().has(d.id))));
  const dropZone = useSelect(dropTarget, (target) => (target?.id === item.id ? target.zone : undefined));
  const onRight = useSelect(listedOnRight, (id) => id === item.id);

  // A book's chapters are listed in the book panel on the right, not here, and
  // so are the subtopics of a page while "On this page" lists them there.
  const hasChildren = item.kind !== "book" && item.children.length > 0 && !onRight;
  // A folder always shows its arrow, even empty, so it reads as a folder without an icon.
  const foldable = hasChildren || item.kind === "folder";
  const title = item.title || "Untitled";

  const allowedPlacement = (event: DragEvent) => {
    const moving = dragged.get();
    if (!moving) return null;
    const tree = ctx.tree();
    const placement = placementFor(tree, moving, item, zoneFor(event, item, moving));
    return placement && !canMove(tree, moving.id, placement.parentId) ? placement : null;
  };

  return (
    <li>
      <div
        className="row"
        data-id={item.id}
        data-kind={item.kind}
        data-drop={dropZone}
        data-dragging={isDragged || undefined}
        aria-current={current ? "page" : undefined}
        aria-selected={selected || undefined}
        style={{ paddingLeft: 4 + depth * 14 }}
        // Off while naming, so selecting text in the name box does not start a drag.
        draggable={!editing}
        onDragStart={(event) => {
          // Firefox only starts a drag when some data is set.
          event.dataTransfer.setData("text/plain", item.id);
          event.dataTransfer.effectAllowed = "move";
          startDrag(item);
        }}
        onDragEnd={endDrag}
        onContextMenu={dragRowMenu((event) => ctx.menu(item.id, event))}
        // Shift+click picks a range; without this it would also select the text between.
        // A middle press in a list that scrolls would start the browser's autoscroll and never click.
        onMouseDown={(event) => (event.shiftKey || event.button === 1) && event.preventDefault()}
        // A middle click opens the page in a new tab, as in a browser.
        onAuxClick={(event) => event.button === 1 && item.kind !== "folder" && ctx.select(item.id, true)}
        onDragOver={(event) => {
          const moving = dragged.get();
          if (!moving) return;
          if (!allowedPlacement(event)) return dropTarget.get() && dropTarget.set(null);
          // Calling preventDefault is how a drop target says "you may drop here".
          event.preventDefault();
          setDropTarget(item.id, zoneFor(event, item, moving));
        }}
        onDrop={(event) => {
          event.preventDefault();
          const placement = allowedPlacement(event);
          if (placement) ctx.drop(placement);
        }}
      >
        {foldable ? (
          <button
            className="icon-button row-fold"
            data-icon={item.kind !== "folder" || undefined}
            aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
            onClick={() => toggleCollapsed(item.id)}
          >
            {/* A page with pages inside keeps its icon, and shows the arrow while pointed at. */}
            {item.kind !== "folder" && <Icon name={item.kind === "note" ? "note" : registry.iconOf(item.kind)} />}
            <Icon name={open ? "chevron-down" : "chevron-right"} />
          </button>
        ) : (
          // The icon sits where a folder has its arrow, so every title starts at the same place.
          <span className="row-icon" aria-hidden="true">
            <Icon name={item.kind === "note" ? "note" : registry.iconOf(item.kind)} />
          </span>
        )}
        {editing ? (
          <NameInput item={item} ctx={ctx} />
        ) : item.kind === "folder" ? (
          // Folders have no page of their own: clicking one opens or closes it.
          <button
            className="row-title"
            aria-expanded={open}
            title="Double-click or F2 to rename"
            onClick={(event) => ctx.pick(item, event) || toggleCollapsed(item.id)}
            {...renameHere(item.id)}
          >
            <span>{title}</span>
          </button>
        ) : item.kind === "book" ? (
          // A book opens its own page, with the chapters in order. It is renamed there.
          <button className="row-title" onClick={(event) => ctx.pick(item, event) || ctx.select(item.id)} {...renameHere(item.id)}>
            <span>{title}</span>
          </button>
        ) : item.kind === "note" ? (
          <button className="row-title" onClick={(event) => ctx.pick(item, event) || ctx.select(item.id)} {...prefetchOnHover(item.id)} {...renameHere(item.id)}>
            {title}
          </button>
        ) : (
          // Other pages, like boards. Their icon comes from their plugin.
          <button className="row-title" onClick={(event) => ctx.pick(item, event) || ctx.select(item.id)} {...prefetchOnHover(item.id)} {...renameHere(item.id)}>
            <span>{title}</span>
          </button>
        )}
        {registry
          .rowMarks()
          .filter((mark) => mark.when(item))
          .map((mark) => {
            const label = typeof mark.label === "string" ? mark.label : mark.label(item);
            return (
              <span key={mark.id} className="row-mark" data-mark={mark.id} role="img" title={label} aria-label={label}>
                <Icon name={mark.icon} />
              </span>
            );
          })}
        {item.kind === "book" && item.children.length > 0 && (
          <span className="row-count" title={`${item.children.length} ${item.children.length === 1 ? "chapter" : "chapters"}`}>
            {item.children.length}
          </span>
        )}
        {isContainer(item.kind) && (
          <button
            className="icon-button row-action"
            aria-label={item.kind === "book" ? `Add chapter to ${title}` : `Add note inside ${title}`}
            title={item.kind === "book" ? "Add chapter" : "Add note inside"}
            onClick={() => ctx.add("note", item.id)}
          >
            <Icon name="plus" />
          </button>
        )}
        {/* The page menu, with Move to trash in it. On a phone it is the way to the menu, since a long press drags. */}
        <button className="icon-button row-action" aria-label={`More for ${title}`} aria-haspopup="menu" title="More" onClick={(event) => ctx.menu(item.id, event)}>
          <Icon name="more" />
        </button>
      </div>
      {hasChildren && open && <Inside item={item} depth={depth} ctx={ctx} />}
    </li>
  );
});
