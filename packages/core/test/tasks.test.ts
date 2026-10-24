import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { finishTask, tasksIn } from "../src/tasks";

/** A note body with a to-do list, the way the editor stores one. */
function body(items: { text: string; attrs?: Record<string, unknown> }[]) {
  const doc = new Y.Doc();
  const content = doc.getXmlFragment("content");
  const list = new Y.XmlElement("taskList");
  content.insert(0, [list]);
  list.insert(
    0,
    items.map(({ text, attrs }) => {
      const item = new Y.XmlElement("taskItem");
      for (const [key, value] of Object.entries({ checked: false, ...attrs })) item.setAttribute(key, value as unknown as string);
      const paragraph = new Y.XmlElement("paragraph");
      paragraph.insert(0, [new Y.XmlText(text)]);
      item.insert(0, [paragraph]);
      return item;
    }),
  );
  return content;
}

describe("tasks in a note", () => {
  it("lists each task with its date, time, repeat and priority", () => {
    const content = body([
      { text: "call mum", attrs: { id: "a", due: "2026-10-25", time: "17:00", priority: 2 } },
      { text: "done already", attrs: { id: "b", checked: true } },
      { text: "no id yet" },
    ]);
    expect(tasksIn(content)).toEqual([
      { id: "a", text: "call mum", done: false, due: "2026-10-25", time: "17:00", repeat: null, priority: 2, remind: null },
      { id: "b", text: "done already", done: true, due: null, time: null, repeat: null, priority: 0, remind: null },
      { id: null, text: "no id yet", done: false, due: null, time: null, repeat: null, priority: 0, remind: null },
    ]);
  });

  it("finds tasks inside other tasks", () => {
    const content = body([{ text: "outer", attrs: { id: "o" } }]);
    const outer = (content.get(0) as Y.XmlElement).get(0) as Y.XmlElement;
    const inner = new Y.XmlElement("taskList");
    const item = new Y.XmlElement("taskItem");
    item.setAttribute("id", "i");
    const paragraph = new Y.XmlElement("paragraph");
    paragraph.insert(0, [new Y.XmlText("inner")]);
    item.insert(0, [paragraph]);
    inner.insert(0, [item]);
    outer.insert(1, [inner]);
    expect(tasksIn(content).map((t) => t.text)).toEqual(["outer", "inner"]);
  });

  it("ticks a task, or moves a repeating one to its next day", () => {
    const content = body([
      { text: "once", attrs: { id: "a", due: "2026-10-24" } },
      { text: "every week", attrs: { id: "b", due: "2026-10-24", repeat: "week" } },
    ]);
    expect(finishTask(content, "a", true)).toBe(true);
    expect(finishTask(content, "b", true)).toBe(true);
    expect(finishTask(content, "missing", true)).toBe(false);
    const [once, weekly] = tasksIn(content);
    expect(once.done).toBe(true);
    expect(weekly).toMatchObject({ done: false, due: "2026-10-31" });
    finishTask(content, "a", false);
    expect(tasksIn(content)[0].done).toBe(false);
  });

  it("finds a task with no id by its place in the note", () => {
    const content = body([{ text: "first" }, { text: "second" }]);
    expect(finishTask(content, 1, true)).toBe(true);
    expect(tasksIn(content).map((t) => t.done)).toEqual([false, true]);
    expect(finishTask(content, 5, true)).toBe(false);
  });
});
