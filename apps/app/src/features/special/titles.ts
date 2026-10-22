import { savedStore } from "@/platform/store";

/** How a new daily note is named. Finding a day's note goes by its date setting, so renaming one never loses it. */
export const DAILY_TITLES = [
  { id: "iso", format: (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` },
  { id: "short", format: (date: Date) => date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) },
  { id: "long", format: (date: Date) => date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) },
] as const;

export type DailyTitle = (typeof DAILY_TITLES)[number]["id"];

export const dailyTitle = savedStore<DailyTitle>("dailyTitle", "iso", {
  decode: (raw) => (DAILY_TITLES.some((t) => t.id === raw) ? (raw as DailyTitle) : "iso"),
  encode: (value) => value,
});

export const titleFor = (date: Date) => DAILY_TITLES.find((t) => t.id === dailyTitle.get())!.format(date);
