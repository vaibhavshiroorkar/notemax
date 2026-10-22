import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import type { TreeNode } from "@notemax/core";
import { createStore } from "@/platform/store";
import { registry } from "@/plugins/registry";
import { formatShortcut } from "@/plugins/shortcuts";
import type { AppContext, ContextMenuItem, ContextTarget } from "@/plugins/types";
import { Icon } from "./Icon";
import { fromTouch, touchOnly } from "./longPress";
import "./context-menu.css";

interface Open {
  target: ContextTarget;
  x: number;
  y: number;
}

const current = createStore<Open | null>(null);

export function openContextMenu(target: ContextTarget, x: number, y: number) {
  current.set({ target, x, y });
}

const closeContextMenu = () => current.set(null);

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
    // From the keyboard there is no pointer, so the browser reports 0,0.
    if (x === 0 && y === 0) {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      x = rect.left + 16;
      y = rect.bottom;
    }
    openContextMenu(t, x, y);
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

/** Draws the menu that is open, if any. Rendered once, by the app. */
export function ContextMenuHost({ app }: { app: AppContext }) {
  const open = current.use();
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

  if (!open) return null;
  const items = expand(registry.contextMenu(open.target, app), open.target, app);
  if (!items.length) return null;
  // Inside an open dialog, like the graph, the menu must belong to it: everything
  // outside a modal dialog ignores the pointer. As a popover it also sits above
  // everything and is never clipped.
  const host = [...document.querySelectorAll("dialog[open]")].at(-1) ?? document.body;
  return createPortal(<MenuList key={`${open.x},${open.y}`} items={grouped(items)} target={open.target} app={app} x={open.x} y={open.y} onClose={closeContextMenu} />, host);
}

function MenuList({
  items,
  target,
  app,
  x,
  y,
  onClose,
  onBack,
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
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState({ left: x, top: y, ready: false });
  const [sub, setSub] = useState<{ id: string; x: number; y: number; left: number; focus: boolean } | null>(null);

  // Keep the whole menu on screen: flip left or up when it would spill over.
  useLayoutEffect(() => {
    const el = ref.current!;
    el.showPopover?.();
    const { width, height } = el.getBoundingClientRect();
    const margin = 6;
    let left = x;
    let top = y;
    if (left + width > innerWidth - margin) left = onBack ? Math.max(margin, sub?.left ?? x) - width : innerWidth - width - margin;
    if (top + height > innerHeight - margin) top = Math.max(margin, innerHeight - height - margin);
    setPlace({ left: Math.max(margin, left), top, ready: true });
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
    if (item.submenu) {
      const rect = el.getBoundingClientRect();
      setSub({ id: item.id, x: rect.right - 2, y: rect.top - 5, left: rect.left + 2, focus: fromKeyboard });
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
          label={open.title}
          onClose={onClose}
          onBack={() => {
            setSub(null);
            ref.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(open.id)}"]`)?.focus();
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
      onPointerEnter={(event) => {
        if (!disabled && event.pointerType !== "touch") event.currentTarget.focus();
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
