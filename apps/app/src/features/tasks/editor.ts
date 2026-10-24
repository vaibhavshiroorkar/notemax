import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import { nextDue, parseWhen, type Repeat } from "@notemax/core";
import { openTaskPopover } from "./popover";
import { isOverdue, whenLabel } from "./when";

// A to-do item can carry a date, a time, a repeat and a priority. They live on
// the item, beside "checked", so they sync and travel with the note. Typing
// "tomorrow 5pm" or "!!" in a to-do shows those words marked; leaving the
// line turns them into a chip on the line, which a click changes.

export const TASK_ATTRS = ["id", "due", "time", "repeat", "priority"] as const;
const DATE_ATTRS = ["due", "time", "repeat", "priority"] as const;

/** The stored side: every note knows these attributes, whether the Tasks plugin is on or not. */
export const TaskAttrs = Extension.create({
  name: "taskAttrs",
  addGlobalAttributes() {
    const attr = (name: string, number = false) => ({
      default: null,
      parseHTML: (el: HTMLElement) => {
        const value = el.getAttribute(`data-${name}`);
        return value === null ? null : number ? Number(value) || null : value;
      },
      renderHTML: (attrs: Record<string, unknown>) => (attrs[name] == null ? {} : { [`data-${name}`]: String(attrs[name]) }),
    });
    return [
      {
        types: ["taskItem"],
        attributes: {
          id: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute("data-task-id"), renderHTML: (a: Record<string, unknown>) => (a.id ? { "data-task-id": a.id } : {}) },
          due: attr("due"),
          time: attr("time"),
          repeat: attr("repeat"),
          priority: attr("priority", true),
        },
      },
    ];
  },
});

const key = new PluginKey<DecorationSet>("taskDates");
const newId = () => crypto.randomUUID().slice(0, 12);

interface Found {
  node: PMNode;
  pos: number;
}

/** The to-do item around a position, the innermost one. */
function itemAt(state: EditorState, pos: number): Found | null {
  const $pos = state.doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === "taskItem") return { node, pos: $pos.before(depth) };
  }
  return null;
}

/** Stands for a picture, link or other non-text piece in a line, one character each. */
const OBJECT = String.fromCharCode(0xfffc);

/** An item's own line: its first paragraph, with each non-text piece as one character so offsets match positions. */
function lineOf(item: PMNode, pos: number): { text: string; start: number } | null {
  const first = item.firstChild;
  if (!first || first.type.name !== "paragraph") return null;
  return { text: first.textBetween(0, first.content.size, undefined, OBJECT), start: pos + 2 };
}

/** Takes the date words out of an item's line and puts what they said on the item. Returns true when it changed anything. */
function readDates(tr: Transaction, pos: number, now = new Date()): boolean {
  const item = tr.doc.nodeAt(pos);
  if (item?.type.name !== "taskItem") return false;
  const line = lineOf(item, pos);
  if (!line) return false;
  const found = parseWhen(line.text, now);
  if (!found.parts.length) return false;
  // Each piece goes with one space beside it, so no double spaces stay behind.
  for (const part of [...found.parts].reverse()) {
    let { from, to } = part;
    if (line.text[from - 1] === " ") from--;
    else if (line.text[to] === " ") to++;
    tr.delete(line.start + from, line.start + to);
  }
  const attrs = { ...item.attrs };
  if (found.due) attrs.due = found.due;
  if (found.time) attrs.time = found.time;
  if (found.repeat) attrs.repeat = found.repeat;
  if (found.priority) attrs.priority = found.priority;
  tr.setNodeMarkup(tr.mapping.map(pos), undefined, attrs);
  return true;
}

function chip(view: EditorView, getPos: () => number | undefined, attrs: Record<string, unknown>): HTMLElement {
  // The chip sits at the end of its item's line; the item is found from there when clicked.
  const el = document.createElement("button");
  el.type = "button";
  el.className = "task-when";
  el.contentEditable = "false";
  const when = { due: (attrs.due as string) ?? null, time: (attrs.time as string) ?? null, repeat: (attrs.repeat as string) ?? null };
  const label = whenLabel(when);
  if (label) el.textContent = label;
  if (attrs.priority) {
    const mark = document.createElement("span");
    mark.className = "task-priority";
    mark.dataset.level = String(attrs.priority);
    mark.textContent = "!".repeat(Number(attrs.priority));
    el.append(mark);
  }
  if (!attrs.checked && isOverdue(when)) el.dataset.overdue = "";
  el.setAttribute("aria-label", `Change the date${label ? `: ${label}` : ""}`);
  el.addEventListener("mousedown", (event) => event.preventDefault());
  el.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const at = getPos();
    const item = at === undefined ? null : itemAt(view.state, at);
    if (item) openTaskPopover(view, item.pos, el);
  });
  return el;
}

/** The chips on every item with a date or priority, and the words being read on the line being typed. */
function decorate(state: EditorState): DecorationSet {
  const decorations: Decoration[] = [];
  state.doc.descendants((node, pos) => {
    if (node.type.name !== "taskItem") return;
    const { due, time, repeat, priority } = node.attrs;
    if (due || time || repeat || priority) {
      const first = node.firstChild;
      const end = first ? pos + 1 + first.nodeSize - 1 : pos + 1;
      const stamp = [node.attrs.id, due, time, repeat, priority, node.attrs.checked].join("|");
      decorations.push(Decoration.widget(end, (view, getPos) => chip(view, getPos, node.attrs), { side: 1, key: stamp, ignoreSelection: true }));
    }
  });
  const here = itemAt(state, state.selection.from);
  const line = here && lineOf(here.node, here.pos);
  if (line) for (const part of parseWhen(line.text).parts) decorations.push(Decoration.inline(line.start + part.from, line.start + part.to, { class: "task-when-typing" }));
  return DecorationSet.create(state.doc, decorations);
}

/**
 * The behavior, on while the Tasks plugin is: ids for every to-do, dates read
 * from what is typed, chips, and repeating tasks that come back when ticked.
 */
export const TaskDates = Extension.create({
  name: "taskDates",

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_config, state) => decorate(state),
          apply: (tr, old, _before, state) => (tr.docChanged || tr.selectionSet || tr.getMeta(key) ? decorate(state) : old),
        },
        props: {
          decorations: (state) => key.getState(state),
          handleDOMEvents: {
            // Leaving the note reads the line being typed, as leaving the line does.
            blur(view) {
              const here = itemAt(view.state, view.state.selection.from);
              if (here) view.dispatch(view.state.tr.setMeta(key, "read"));
              return false;
            },
          },
        },
        appendTransaction(transactions, before, state) {
          const local = transactions.filter((tr) => !tr.getMeta(ySyncPluginKey));
          if (!local.length) return null;
          const tr = state.tr;

          // Every to-do gets an id. One split off another carries its id and
          // date along, so the second of two with one id starts fresh.
          if (local.some((t) => t.docChanged)) {
            const seen = new Set<string>();
            state.doc.descendants((node, pos) => {
              if (node.type.name !== "taskItem") return;
              const id = node.attrs.id as string | null;
              if (id && !seen.has(id)) return void seen.add(id);
              const fresh: Record<string, unknown> = { ...node.attrs, id: newId() };
              if (id) for (const name of DATE_ATTRS) fresh[name] = null;
              seen.add(fresh.id as string);
              tr.setNodeMarkup(pos, undefined, fresh);
            });
          }

          // A repeating task ticked here comes back unticked on its next day.
          if (local.some((t) => t.docChanged)) {
            const was = new Map<string, boolean>();
            before.doc.descendants((node) => {
              if (node.type.name === "taskItem" && node.attrs.id) was.set(node.attrs.id, !!node.attrs.checked);
            });
            tr.doc.descendants((node, pos) => {
              if (node.type.name !== "taskItem" || !node.attrs.checked || !node.attrs.repeat || !node.attrs.due) return;
              if (was.get(node.attrs.id) !== false) return;
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: false, due: nextDue(node.attrs.due, node.attrs.repeat as Repeat) });
            });
          }

          // Leaving a to-do line reads the date words typed in it.
          const left = itemAt(before, before.selection.from);
          const asked = local.some((t) => t.getMeta(key) === "read");
          if (left || asked) {
            let pos = left?.pos ?? -1;
            if (left) for (const t of transactions) pos = t.mapping.map(pos);
            const now = itemAt(state, state.selection.from);
            if (asked && now) readDates(tr, tr.mapping.map(now.pos));
            else if (left && now?.pos !== pos && state.doc.nodeAt(pos)?.type.name === "taskItem") readDates(tr, tr.mapping.map(pos));
          }
          return tr.docChanged ? tr : null;
        },
      }),
    ];
  },
});

export { DATE_ATTRS };
