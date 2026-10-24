// Dates typed in plain words inside a task, like "call mum tomorrow 5pm",
// "every monday" or "!!". Kept small and in house: a task line needs a few
// common forms, read the same way on every device.

export type Repeat = "day" | "week" | "month" | "year";

export interface When {
  /** The day as YYYY-MM-DD, or null. */
  due: string | null;
  /** The time as HH:MM on a 24 hour clock, or null. */
  time: string | null;
  repeat: Repeat | null;
  /** 0 for none, up to 3 for "!!!". */
  priority: number;
  /** The text with the date words taken out. */
  text: string;
  /** Where the date words were, so the editor can show them as a chip. Both 0 when there were none. */
  from: number;
  to: number;
  /** Each piece read, priority marks too, first to last, so the editor can take them out. */
  parts: { from: number; to: number }[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const dateOf = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
/** The same day some months on, or the month's last day when it is shorter. */
function addMonths(date: Date, months: number) {
  const last = new Date(date.getFullYear(), date.getMonth() + months + 1, 0).getDate();
  return new Date(date.getFullYear(), date.getMonth() + months, Math.min(date.getDate(), last));
}

// "sat" and "sun" are common words, so those two need their full names.
const WEEKDAYS: [RegExp, number][] = [
  [/sunday/, 0],
  [/mon(day)?/, 1],
  [/tue(s|sday)?/, 2],
  [/wed(nesday)?/, 3],
  [/thu(r|rs|rsday)?/, 4],
  [/fri(day)?/, 5],
  [/saturday/, 6],
];
const WEEKDAY = "sunday|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday";
const weekdayOf = (word: string) => WEEKDAYS.find(([pattern]) => new RegExp(`^(${pattern.source})$`).test(word))![1];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec";
const monthOf = (word: string) => MONTHS.indexOf(word.slice(0, 3));

/** The coming day of the week: today when it is that day. */
const coming = (today: Date, weekday: number) => addDays(today, (weekday - today.getDay() + 7) % 7);

/** A month and day with no year: this year, or next when it has gone by. */
function nextOn(today: Date, month: number, day: number, year?: number) {
  if (year) return new Date(year, month, day);
  const date = new Date(today.getFullYear(), month, day);
  return date < new Date(today.getFullYear(), today.getMonth(), today.getDate()) ? new Date(today.getFullYear() + 1, month, day) : date;
}

function clock(hours: number, minutes: number, half?: string): string | null {
  if (half === "pm" && hours < 12) hours += 12;
  if (half === "am" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return `${pad(hours)}:${pad(minutes)}`;
}

interface Found {
  from: number;
  to: number;
}

/** Reads the date words in a task's text, relative to `now`. */
export function parseWhen(input: string, now: Date = new Date()): When {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lower = input.toLowerCase();
  const taken: Found[] = [];
  const dateParts: Found[] = [];
  let due: Date | null = null;
  let time: string | null = null;
  let repeat: Repeat | null = null;
  let priority = 0;

  /** The first match of `pattern` that overlaps nothing read yet. */
  const find = (pattern: string, keep = true): RegExpExecArray | null => {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, "giu");
    for (let match = re.exec(lower); match; match = re.exec(lower)) {
      const from = match.index;
      const to = from + match[0].length;
      if (taken.some((t) => from < t.to && to > t.from)) continue;
      taken.push({ from, to });
      if (keep) dateParts.push({ from, to });
      return match;
    }
    return null;
  };

  // Repeats, which may name the first day.
  let match = find(`every\\s+(day|week|month|year|${WEEKDAY})|daily|weekly|monthly|yearly`);
  if (match) {
    const word = match[1] ?? match[0];
    if (word === "day" || word === "daily") repeat = "day";
    else if (word === "week" || word === "weekly") repeat = "week";
    else if (word === "month" || word === "monthly") repeat = "month";
    else if (word === "year" || word === "yearly") repeat = "year";
    else {
      repeat = "week";
      due = coming(today, weekdayOf(word));
    }
  }

  // The day.
  if (!due && (match = find("today|tonight|tomorrow|tmrw|tmr|yesterday"))) {
    due = match[0] === "today" || match[0] === "tonight" ? today : match[0] === "yesterday" ? addDays(today, -1) : addDays(today, 1);
    if (match[0] === "tonight") time = "20:00";
  }
  if (!due && (match = find("next\\s+week"))) due = coming(addDays(today, 1), 1);
  if (!due && (match = find("in\\s+(\\d{1,3})\\s+(days?|weeks?|months?)"))) {
    const n = Number(match[1]);
    due = match[2].startsWith("day") ? addDays(today, n) : match[2].startsWith("week") ? addDays(today, 7 * n) : addMonths(today, n);
  }
  if (!due && (match = find("(\\d{4})-(\\d{2})-(\\d{2})"))) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (date.getMonth() === Number(match[2]) - 1) due = date;
  }
  if (!due && (match = find(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH})(?:\\s+(\\d{4}))?`))) due = nextOn(today, monthOf(match[2]), Number(match[1]), match[3] ? Number(match[3]) : undefined);
  if (!due && (match = find(`(${MONTH})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`))) due = nextOn(today, monthOf(match[1]), Number(match[2]), match[3] ? Number(match[3]) : undefined);
  if (!due && (match = find(WEEKDAY))) due = coming(today, weekdayOf(match[0]));

  // The time.
  if (!time && (match = find("(?:at\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)"))) time = clock(Number(match[1]), Number(match[2] ?? 0), match[3]);
  if (!time && (match = find("(?:at\\s+)?(\\d{1,2}):(\\d{2})"))) time = clock(Number(match[1]), Number(match[2]));
  if (!time && (match = find("at\\s+(\\d{1,2})"))) time = clock(Number(match[1]), 0);
  if (!time && (match = find("(?:at\\s+)?noon"))) time = "12:00";
  // A time or a repeat with no day means today.
  if (!due && (time || repeat)) due = today;

  // "!" marks standing alone.
  match = find("!{1,3}", false);
  if (match) priority = match[0].length;

  const text = taken
    .slice()
    .sort((a, b) => b.from - a.from)
    .reduce((rest, part) => rest.slice(0, part.from) + " " + rest.slice(part.to), input)
    .replace(/\s+/g, " ")
    .trim();
  const from = dateParts.length ? Math.min(...dateParts.map((p) => p.from)) : 0;
  const to = dateParts.length ? Math.max(...dateParts.map((p) => p.to)) : 0;
  const parts = taken.slice().sort((a, b) => a.from - b.from);
  return { due: due ? keyOf(due) : null, time, repeat, priority, text, from, to, parts };
}

/** The day a repeating task comes back after `due`. */
export function nextDue(due: string, repeat: Repeat): string {
  const date = dateOf(due);
  if (repeat === "day") return keyOf(addDays(date, 1));
  if (repeat === "week") return keyOf(addDays(date, 7));
  return keyOf(addMonths(date, repeat === "month" ? 1 : 12));
}
