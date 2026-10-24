import { describe, expect, it } from "vitest";
import { nextDue, parseWhen } from "../src/when";

// A Saturday, so "fri" means next week's Friday and "mon" the coming Monday.
const now = new Date(2026, 9, 24, 10, 30);

describe("reading a date typed in plain words", () => {
  it("finds today, tomorrow and a time", () => {
    expect(parseWhen("call mum tomorrow 5pm", now)).toMatchObject({ due: "2026-10-25", time: "17:00", text: "call mum" });
    expect(parseWhen("today", now)).toMatchObject({ due: "2026-10-24", time: null, text: "" });
    expect(parseWhen("standup at 9:15", now)).toMatchObject({ due: "2026-10-24", time: "09:15", text: "standup" });
    expect(parseWhen("tonight", now)).toMatchObject({ due: "2026-10-24", time: "20:00" });
    expect(parseWhen("send the invoice yesterday", now)).toMatchObject({ due: "2026-10-23", text: "send the invoice" });
  });

  it("finds weekdays, the coming one", () => {
    expect(parseWhen("report fri", now).due).toBe("2026-10-30");
    expect(parseWhen("report monday", now).due).toBe("2026-10-26");
    expect(parseWhen("next week", now).due).toBe("2026-10-26");
    expect(parseWhen("in 3 days", now).due).toBe("2026-10-27");
    expect(parseWhen("in 2 weeks", now).due).toBe("2026-11-07");
  });

  it("finds written dates", () => {
    expect(parseWhen("taxes 2026-12-01", now).due).toBe("2026-12-01");
    expect(parseWhen("party 31 oct", now).due).toBe("2026-10-31");
    expect(parseWhen("party oct 31 8pm", now)).toMatchObject({ due: "2026-10-31", time: "20:00" });
    // A day already gone this year means next year.
    expect(parseWhen("jan 3", now).due).toBe("2027-01-03");
  });

  it("finds repeats", () => {
    expect(parseWhen("water plants every monday", now)).toMatchObject({ due: "2026-10-26", repeat: "week", text: "water plants" });
    expect(parseWhen("pills every day 8am", now)).toMatchObject({ due: "2026-10-24", time: "08:00", repeat: "day" });
    expect(parseWhen("rent monthly", now)).toMatchObject({ repeat: "month", due: "2026-10-24" });
    expect(parseWhen("weekly review", now)).toMatchObject({ repeat: "week", text: "review" });
  });

  it("finds a priority from ! marks", () => {
    expect(parseWhen("fix the leak !!", now)).toMatchObject({ priority: 2, text: "fix the leak", due: null });
    expect(parseWhen("!!! now", now).priority).toBe(3);
    expect(parseWhen("hello!", now).priority).toBe(0);
  });

  it("leaves words alone that only look like dates inside other words", () => {
    expect(parseWhen("buy a monitor", now)).toMatchObject({ due: null, text: "buy a monitor" });
    expect(parseWhen("satisfy the client", now).due).toBeNull();
    expect(parseWhen("", now)).toMatchObject({ due: null, time: null, repeat: null, priority: 0 });
  });

  it("names the part of the text it read, so it can show as a chip", () => {
    const found = parseWhen("call mum tomorrow 5pm", now);
    expect("call mum tomorrow 5pm".slice(found.from, found.to)).toBe("tomorrow 5pm");
  });

  it("lists every part it read, priority marks too, in order", () => {
    const text = "!! pay rent monthly at 9am";
    expect(parseWhen(text, now).parts.map(({ from, to }) => text.slice(from, to))).toEqual(["!!", "monthly", "at 9am"]);
  });
});

describe("the next date of a repeating task", () => {
  it("steps by the repeat", () => {
    expect(nextDue("2026-10-24", "day")).toBe("2026-10-25");
    expect(nextDue("2026-10-24", "week")).toBe("2026-10-31");
    expect(nextDue("2026-01-31", "month")).toBe("2026-02-28");
    expect(nextDue("2028-02-29", "year")).toBe("2029-02-28");
  });
});
