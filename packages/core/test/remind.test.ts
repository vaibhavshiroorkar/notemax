import { describe, expect, it } from "vitest";
import { remindAt, type Task } from "../src";

const task = (fields: Partial<Task>): Task => ({ id: "t", text: "call mum", done: false, due: null, time: null, repeat: null, priority: 0, remind: null, ...fields });
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();

describe("when a to-do rings", () => {
  it("rings at its time unless told otherwise", () => {
    expect(remindAt(task({ due: "2026-10-25", time: "17:00" }))).toBe(at(2026, 10, 25, 17));
  });

  it("rings some minutes before when asked", () => {
    expect(remindAt(task({ due: "2026-10-25", time: "17:00", remind: 15 }))).toBe(at(2026, 10, 25, 16, 45));
    expect(remindAt(task({ due: "2026-10-25", time: "09:00", remind: 1440 }))).toBe(at(2026, 10, 24, 9));
  });

  it("rings at 9 in the morning for a day with no time, only when asked", () => {
    expect(remindAt(task({ due: "2026-10-25" }))).toBeNull();
    expect(remindAt(task({ due: "2026-10-25", remind: 0 }))).toBe(at(2026, 10, 25, 9));
    expect(remindAt(task({ due: "2026-10-25", remind: 1440 }))).toBe(at(2026, 10, 24, 9));
  });

  it("never rings when turned off, done, or without a day", () => {
    expect(remindAt(task({ due: "2026-10-25", time: "17:00", remind: -1 }))).toBeNull();
    expect(remindAt(task({ due: "2026-10-25", time: "17:00", done: true }))).toBeNull();
    expect(remindAt(task({ time: "17:00" }))).toBeNull();
  });
});
