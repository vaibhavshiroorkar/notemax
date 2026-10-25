import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import type { TreeNode } from "@notemax/core";
import { workspaceOf } from "@/data/scope";
import { createStore } from "@/platform/store";
import { registry } from "@/plugins/registry";
import { formatShortcut } from "@/plugins/shortcuts";
import type { AppContext, ContextMenuItem, ContextTarget } from "@/plugins/types";
import type { IconName } from "./Icon";
import { Icon } from "./Icon";
import { fromTouch, touchOnly } from "./longPress";
import "./context-menu.css";

interface Open {
  target: ContextTarget;
  x: number;
  y: number;
  /** The workspace of the page the menu was opened in, so its items change that one. */
  workspace?: string;
}

const current = createStore<Open | null>(null);

export function openContextMenu(target: ContextTarget, x: number, y: number, workspace?: string) {
  current.set({ target, x, y, workspace });
}

const closeContextMenu = () => current.set(null);

export function dismissContextMenu(): boolean {
  if (!current.get()) return false;
  closeContextMenu();
  return true;
}

/**
 * The handler for a thing's onContextMenu. A right click opens the menu at the
 * pointer; the keyboard's menu key or Shift+F10 opens it under the focused thing.
 */
export function contextMenuHandler(target: () => ContextTarget | null) {
  return (event: ReactMouseEvent | MouseEvent) => {
    // Shift+right click keeps the browser's own menu.
    if (event.shiftKey) return;
    const t = target();
    if (!t) return;
    event.preventDefault();
    event.stopPropagation();
    let { clientX: x, clientY: y } = event;
    // A button like ... opens its menu below itself, so no item starts under
    // the finger or pointer. From the keyboard the browser reports 0,0 too.
    if (event.type === "click" || (x === 0 && y === 0)) {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      x = event.type === "click" ? rect.left : rect.left + 16;
      y = rect.bottom + 2;
    }
    openContextMenu(t, x, y, workspaceOf(event.currentTarget as Element));
  };
}

/** Items that stand for a list become that list. */
const expand = (items: ContextMenuItem[], target: ContextTarget, app: AppContext): ContextMenuItem[] =>
  items.flatMap((item) => (item.items ? item.items(target, app) : [item]));

/** The menu for a page, from its row in a list, its dot in the graph and so on. */
export const pageMenu = (node: TreeNode | undefined) => contextMenuHandler(() => (node ? { type: "page", node } : null));

/**
 * For rows that drag and have a ... button: on a touch-only screen a long
 * press starts the drag, so it must not also open the menu, nor the menu of
 * the list around the row.
 */
export const dragRowMenu = (handler: (event: ReactMouseEvent) => void) => (event: ReactMouseEvent) => {
  if (!touchOnly()) return handler(event);
  event.preventDefault();
  event.stopPropagation();
};

// Groups the built-in plugins use, top to bottom, so a menu reads the same
// whichever plugin added what. Other groups follow in the order they appear.
const GROUPS = ["open", "clipboard", "create", "edit", "duplicate", "format", "block", "insert", "link", "image", "tags", "layout", "share", "select", "danger"];

/** The shared flyouts items can sit in, with where each shows in the menu. */
const FLYOUTS = new Map<string, { title: string; icon: IconName; group: string }>([
  ["open", { title: "Open", icon: "folder", group: "open" }],
  ["open-in", { title: "Open in", icon: "arrow-right", group: "open" }],
  ["new", { title: "Create", icon: "plus", group: "create" }],
  ["new-inside", { title: "Create inside", icon: "plus", group: "create" }],
  ["copy", { title: "Copy", icon: "copy", group: "edit" }],
  ["options", { title: "Page options", icon: "settings", group: "share" }],
  ["share", { title: "Share", icon: "upload", group: "share" }],
  ["download", { title: "Download", icon: "download", group: "share" }],
]);

/** Items that name a flyout gathered into it, where the first of them was. One alone stays as it is. */
function folded(items: ContextMenuItem[]): ContextMenuItem[] {
  const members = new Map<string, ContextMenuItem[]>();
  for (const item of items) if (item.inside && FLYOUTS.has(item.inside)) members.set(item.inside, [...(members.get(item.inside) ?? []), item]);
  const placed = new Set<string>();
  return items.flatMap((item) => {
    const name = item.inside;
    const inside = name ? members.get(name) : undefined;
    if (!name || !inside || inside.length < 2) return [item];
    if (placed.has(name)) return [];
    placed.add(name);
    const flyout = FLYOUTS.get(name)!;
    return [{ id: `flyout.${name}`, title: flyout.title, icon: flyout.icon, group: flyout.group, targets: item.targets, submenu: () => inside }];
  });
}

/** Plugins' items in their groups, with a line between groups. */
function grouped(items: ContextMenuItem[]): (ContextMenuItem | "line")[] {
  const order: string[] = [];
  const byGroup = new Map<string, ContextMenuItem[]>();
  for (const item of items) {
    if (!byGroup.has(item.group)) {
      byGroup.set(item.group, []);
      order.push(item.group);
    }
    byGroup.get(item.group)!.push(item);
  }
  const rank = (group: string) => (GROUPS.includes(group) ? GROUPS.indexOf(group) : GROUPS.length + order.indexOf(group));
  order.sort((a, b) => rank(a) - rank(b));
  return order.flatMap((group, i) => [...(i ? (["line"] as const) : []), ...byGroup.get(group)!]);
}

/**
 * Draws the menu that is open, if any. Rendered once, by the app. `appFor`
 * gives the context of another workspace whose page is open in a tab, so a
 * menu opened in that page acts there.
 */
export function ContextMenuHost({ app: shownApp, appFor }: { app: AppContext; appFor?(workspace: string): AppContext | undefined }) {
  const open = current.use();
  const app = open?.workspace && open.workspace !== shownApp.workspace ? appFor?.(open.workspace) : shownApp;
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) returnFocus.current ??= document.activeElement as HTMLElement | null;
    else if (returnFocus.current) {
      // Back to where the keyboard was, unless the menu's action moved it on purpose.
      const back = returnFocus.current;
      returnFocus.current = null;
      if (document.activeElement === document.body || document.activeElement === null) back.focus?.({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => current.set(null);
    const onPointer = (event: PointerEvent) => {
      if (!(event.target as Element).closest?.(".context-menu")) close();
    };
    const onScroll = (event: Event) => {
      if (!(event.target as Element).closest?.(".context-menu")) close();
    };
    // When a finger opened the menu it has no focus, so Esc is heard here.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !(event.target as Element).closest?.(".context-menu")) close();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  // A page from a workspace that is no longer open: nothing to act on safely.
  if (!open || !app) return null;
  const items = expand(registry.contextMenu(open.target, app), open.target, app);
  if (!items.length) return null;
  // Inside an open dialog, like the graph, the menu must belong to it: everything
  // outside a modal dialog ignores the pointer. As a popover it also sits above
  // everything and is never clipped.
  const host = [...document.querySelectorAll("dialog[open]")].at(-1) ?? document.body;
  return createPortal(<MenuList key={`${open.x},${open.y}`} items={grouped(folded(items))} target={open.target} app={app} x={open.x} y={open.y} onClose={closeContextMenu} />, host);
}

function MenuList({
  items,
  target,
  app,
  x,
  y,
  onClose,
  onBack,
  parent,
  label = "Menu",
}: {
  items: (ContextMenuItem | "line")[];
  target: ContextTarget;
  app: AppContext;
  x: number;
  y: number;
  onClose(): void;
  /** Set on a submenu: ArrowLeft goes back to the parent. */
  onBack?(): void;
  /** Set on a submenu: the parent menu's box, to open beside it on whichever side has room. */
  parent?: DOMRect;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The tap that opened the menu can land on it too, so for a finger the items wait a moment before they listen.
  const [openedAt] = useState(() => performance.now());
  const [place, setPlace] = useState({ left: x, top: y, ready: false, over: false });
  const [sub, setSub] = useState<{ id: string; x: number; y: number; parent: DOMRect; focus: boolean } | null>(null);

  // Keep the whole menu on screen: flip left or up when it would spill over.
  useLayoutEffect(() => {
    const el = ref.current!;
    el.showPopover?.();
    const { width, height } = el.getBoundingClientRect();
    const margin = 6;
    let left = x;
    let top = y;
    if (parent) {
      // Beside the parent: to the right, else to the left, else (a phone) over it, with Back at the top.
      if (left + width > innerWidth - margin) left = parent.left - width + 1 >= margin ? parent.left - width + 1 : parent.left;
      if (left === parent.left) top = parent.top;
    } else if (left + width > innerWidth - margin) left = innerWidth - width - margin;
    if (top + height > innerHeight - margin) top = Math.max(margin, innerHeight - height - margin);
    setPlace({ left: Math.max(margin, left), top, ready: true, over: !!parent && left === parent.left });
    // Only on first draw: moving later would jump under the pointer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Not when a finger opened it: taking focus from a note puts the phone's
  // keyboard away, which shifts the page and closes the menu again.
  useEffect(() => {
    if (place.ready && !fromTouch()) (ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? ref.current)?.focus();
  }, [place.ready]);

  const buttons = () => [...(ref.current?.querySelectorAll<HTMLElement>(':scope > [role="menuitem"]:not([aria-disabled="true"])') ?? [])];
  const move = (step: number) => {
    const list = buttons();
    if (!list.length) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    list[(i + step + list.length) % list.length].focus();
  };

  const activate = (item: ContextMenuItem, el: HTMLElement, fromKeyboard: boolean) => {
    if (item.disabled?.(target, app)) return;
    if (!fromKeyboard && fromTouch() && performance.now() - openedAt < 350) return;
    if (item.submenu) {
      const rect = el.getBoundingClientRect();
      // From the menu's edge, not the row's, which sits inside the menu's padding.
      const menu = ref.current!.getBoundingClientRect();
      setSub({ id: item.id, x: menu.right - 1, y: rect.top - 5, parent: menu, focus: fromKeyboard });
      return;
    }
    onClose();
    item.run?.(target, app);
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    const el = document.activeElement as HTMLElement;
    const item = items.find((i): i is ContextMenuItem => i !== "line" && i.id === el?.dataset.id);
    if (event.key === "ArrowDown") move(1);
    else if (event.key === "ArrowUp") move(-1);
    else if (event.key === "Home") buttons()[0]?.focus();
    else if (event.key === "End") buttons().at(-1)?.focus();
    else if (event.key === "Escape") (onBack ?? onClose)();
    else if (event.key === "ArrowLeft" && onBack) onBack();
    else if (event.key === "Tab") onClose();
    else if ((event.key === "ArrowRight" && item?.submenu) || ((event.key === "Enter" || event.key === " ") && item)) activate(item!, el, true);
    else if (event.key.length === 1 && /\S/.test(event.key)) {
      // Typing a letter jumps to the next item that starts with it.
      const list = buttons();
      const start = list.indexOf(el);
      const next = [...list.slice(start + 1), ...list.slice(0, start + 1)].find((b) => b.innerText.trim().toLowerCase().startsWith(event.key.toLowerCase()));
      next?.focus();
    } else return;
    event.preventDefault();
    event.stopPropagation();
  };

  const open = sub && items.find((i): i is ContextMenuItem => i !== "line" && i.id === sub.id);
  return (
    <>
      <div
        ref={ref}
        className="context-menu"
        popover="manual"
        role="menu"
        aria-label={label}
        tabIndex={-1}
        style={{ left: place.left, top: place.top, visibility: place.ready ? "visible" : "hidden" }}
        onKeyDown={onKeyDown}
        onContextMenu={(event) => event.preventDefault()}
      >
        {place.over && onBack && (
          <button className="context-menu-item context-menu-back" role="menuitem" aria-label="Back" onPointerDown={(event) => event.preventDefault()} onClick={onBack}>
            <Icon name="chevron-left" />
            <span className="context-menu-title">{label ?? "Back"}</span>
          </button>
        )}
        {items.map((item, i) =>
          item === "line" ? (
            <div key={`line-${i}`} className="context-menu-line" role="separator" />
          ) : (
            <MenuButton
              key={item.id}
              item={item}
              disabled={!!item.disabled?.(target, app)}
              expanded={sub?.id === item.id}
              onActivate={(el, keyboard) => activate(item, el, keyboard)}
              onHover={(el) => {
                // Pointing at a submenu item opens it; pointing elsewhere closes it.
                if (item.submenu) activate(item, el, false);
                else setSub(null);
              }}
            />
          ),
        )}
      </div>
      {open && sub && (
        <MenuList
          key={sub.id}
          items={grouped(expand(open.submenu!(target, app), target, app))}
          target={target}
          app={app}
          x={sub.x}
          y={sub.y}
          parent={sub.parent}
          label={open.title}
          onClose={onClose}
          onBack={() => {
            setSub(null);
            if (!fromTouch()) ref.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(open.id)}"]`)?.focus({ preventScroll: true });
          }}
        />
      )}
    </>
  );
}

function MenuButton({
  item,
  disabled,
  expanded,
  onActivate,
  onHover,
}: {
  item: ContextMenuItem;
  disabled: boolean;
  expanded: boolean;
  onActivate(el: HTMLElement, keyboard: boolean): void;
  onHover(el: HTMLElement): void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      data-id={item.id}
      className="context-menu-item"
      data-danger={item.danger || undefined}
      aria-disabled={disabled || undefined}
      aria-haspopup={item.submenu ? "menu" : undefined}
      aria-expanded={item.submenu ? expanded : undefined}
      tabIndex={-1}
      // Keep the editor's selection: a mousedown here would move focus out first.
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => onActivate(event.currentTarget, event.detail === 0)}
      // A finger has no hover: it opens a submenu by tapping, not by passing over it.
      onPointerEnter={(event) => {
        if (event.pointerType === "touch") return;
        if (!disabled) event.currentTarget.focus();
        onHover(event.currentTarget);
      }}
    >
      <span className="context-menu-icon">{item.icon && <Icon name={item.icon} />}</span>
      <span className="context-menu-title">{item.title}</span>
      {item.keys && <kbd className="context-menu-keys">{formatShortcut(item.keys)}</kbd>}
      {item.submenu && <Icon name="chevron-right" />}
    </button>
  );
}
