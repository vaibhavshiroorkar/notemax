import { dayKey, dayOf, todayKey } from "@/features/dates/dates";

// How a task's date reads on its chip and in lists: Today, Tomorrow, a
// weekday for the coming week, or the date.

export interface TaskWhen {
  due: string | null;
  time: string | null;
  repeat: string | null;
}

const REPEAT_WORDS: Record<string, string> = { day: "daily", week: "weekly", month: "monthly", year: "yearly" };

export function dayLabel(key: string, today = todayKey()): string {
  if (key === today) return "Today";
  const date = dayOf(key);
  const from = dayOf(today);
  const days = Math.round((date.getTime() - from.getTime()) / 86_400_000);
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7) return date.toLocaleDateString(undefined, { weekday: "short" });
  const sameYear = date.getFullYear() === from.getFullYear();
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

export const timeLabel = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

/** Like "Tomorrow 5:00 PM, weekly". Empty when the task has no date. */
export function whenLabel({ due, time, repeat }: TaskWhen): string {
  const parts = [due ? dayLabel(due) : "", time ? timeLabel(time) : ""].filter(Boolean).join(" ");
  return [parts, repeat ? REPEAT_WORDS[repeat] ?? "" : ""].filter(Boolean).join(", ");
}

/** Past its day, or past its time today. */
export function isOverdue({ due, time }: TaskWhen, now = new Date()): boolean {
  if (!due) return false;
  const today = dayKey(now);
  if (due !== today) return due < today;
  if (!time) return false;
  const [h, m] = time.split(":").map(Number);
  return now.getHours() * 60 + now.getMinutes() > h * 60 + m;
}
