import { useMemo } from "react";
import { HomeList } from "@/features/workspaces/HomeList";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { dayOf, dailyNotes, openDay, todayKey } from "./dates";

/** The journal on Home: today's note one click away, and the last few days written. */
export function JournalHome({ app }: { app: AppContext }) {
  const days = useMemo(() => dailyNotes(app.tree).slice(0, 5), [app.tree]);
  const today = todayKey();
  return (
    <>
      <button className="button home-card-action" onClick={() => void openDay(app, today)}>
        <Icon name="calendar" />
        {days.some((day) => day.key === today) ? "Open today's note" : "Start today's note"}
      </button>
      <HomeList
        app={app}
        items={days.map((day) => day.item)}
        note={(item) => {
          const key = days.find((day) => day.item.id === item.id)?.key;
          return key ? dayOf(key).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "";
        }}
      />
    </>
  );
}
