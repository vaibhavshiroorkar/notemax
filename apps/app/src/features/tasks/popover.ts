import type { EditorView } from "@tiptap/pm/view";

// The small box a task's chip opens: its day, time, repeat and priority, each
// saved on the item as it changes. Plain DOM, since it lives inside the editor.

let open: { el: HTMLElement; close(): void } | null = null;

const field = (label: string, input: HTMLElement) => {
  const row = document.createElement("label");
  row.className = "task-popover-row";
  const name = document.createElement("span");
  name.textContent = label;
  row.append(name, input);
  return row;
};

function select(options: [string, string][], value: string) {
  const el = document.createElement("select");
  for (const [v, text] of options) {
    const option = document.createElement("option");
    option.value = v;
    option.textContent = text;
    el.append(option);
  }
  el.value = value;
  return el;
}

export function closeTaskPopover() {
  open?.close();
}

/** Opens the box for the to-do item at `pos`, under `anchor`. */
export function openTaskPopover(view: EditorView, pos: number, anchor: HTMLElement) {
  closeTaskPopover();
  const item = view.state.doc.nodeAt(pos);
  if (item?.type.name !== "taskItem") return;
  const id = item.attrs.id as string | null;

  /** Writes one setting on the item, found again by id, since the note may have changed meanwhile. */
  const set = (changes: Record<string, unknown>) => {
    let at = pos;
    if (id) view.state.doc.descendants((node, p) => (node.type.name === "taskItem" && node.attrs.id === id ? ((at = p), false) : undefined));
    const node = view.state.doc.nodeAt(at);
    if (node?.type.name !== "taskItem") return;
    view.dispatch(view.state.tr.setNodeMarkup(at, undefined, { ...node.attrs, ...changes }));
  };

  const box = document.createElement("div");
  box.className = "task-popover";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Date of this to-do");

  const date = document.createElement("input");
  date.type = "date";
  date.value = (item.attrs.due as string) ?? "";
  date.addEventListener("change", () => set({ due: date.value || null }));

  const time = document.createElement("input");
  time.type = "time";
  time.value = (item.attrs.time as string) ?? "";
  time.addEventListener("change", () => set({ time: time.value || null }));

  const repeat = select(
    [
      ["", "Does not repeat"],
      ["day", "Every day"],
      ["week", "Every week"],
      ["month", "Every month"],
      ["year", "Every year"],
    ],
    (item.attrs.repeat as string) ?? "",
  );
  repeat.addEventListener("change", () => set({ repeat: repeat.value || null }));

  const priority = select(
    [
      ["", "None"],
      ["1", "Low (!)"],
      ["2", "Medium (!!)"],
      ["3", "High (!!!)"],
    ],
    item.attrs.priority ? String(item.attrs.priority) : "",
  );
  priority.addEventListener("change", () => set({ priority: priority.value ? Number(priority.value) : null }));

  const actions = document.createElement("div");
  actions.className = "task-popover-actions";
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "link-button";
  clear.textContent = "Clear";
  clear.addEventListener("click", () => {
    set({ due: null, time: null, repeat: null, priority: null });
    close();
  });
  const done = document.createElement("button");
  done.type = "button";
  done.className = "button";
  done.textContent = "Done";
  done.addEventListener("click", () => close());
  actions.append(clear, done);

  box.append(field("Day", date), field("Time", time), field("Repeat", repeat), field("Priority", priority), actions);
  document.body.append(box);

  const rect = anchor.getBoundingClientRect();
  const width = box.offsetWidth;
  box.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - width - 8))}px`;
  const below = rect.bottom + 4;
  box.style.top = `${below + box.offsetHeight > innerHeight - 8 ? Math.max(8, rect.top - box.offsetHeight - 4) : below}px`;
  date.focus();

  const onDown = (event: PointerEvent) => {
    if (!box.contains(event.target as Node) && event.target !== anchor) close();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      view.focus();
    }
  };
  function close() {
    box.remove();
    removeEventListener("pointerdown", onDown, true);
    removeEventListener("keydown", onKey, true);
    if (open?.el === box) open = null;
  }
  addEventListener("pointerdown", onDown, true);
  addEventListener("keydown", onKey, true);
  open = { el: box, close };
}
