import { useRef } from "react";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { dayOf, makeDay } from "./dates";
import { nextDayIn } from "./journal";

const short = (key: string) => dayOf(key).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

/**
 * A journal's buttons where a note has Add subtopic: the next day after the
 * latest entry, or any day from a date picker. A day already written opens.
 */
export function JournalAdder({ app, journalId, onOpen, compact }: { app: AppContext; journalId: string; onOpen(id: string): void; compact?: boolean }) {
  const picker = useRef<HTMLInputElement>(null);
  const next = nextDayIn(app.tree, journalId);
  const add = async (key: string) => onOpen(await makeDay(app, key, journalId));
  const buttonClass = compact ? "footer-button" : "button add-subtopic";
  return (
    <div className="journal-adder" data-compact={compact || undefined}>
      <button className={buttonClass} title={`A new entry for ${dayOf(next).toLocaleDateString(undefined, { dateStyle: "full" })}`} onClick={() => void add(next)}>
        <Icon name="plus" />
        <span>Next date</span>
        <span className="journal-adder-day">{short(next)}</span>
      </button>
      <button
        className={buttonClass}
        onClick={() => {
          const input = picker.current;
          if (!input) return;
          input.value = next;
          // Where showPicker is missing, the field itself takes the click.
          try {
            input.showPicker();
          } catch {
            input.click();
          }
        }}
      >
        <Icon name="calendar" />
        <span>Choose date</span>
      </button>
      <input ref={picker} className="journal-adder-picker" type="date" tabIndex={-1} aria-label="Date of the new entry" onChange={(event) => event.target.value && void add(event.target.value)} />
    </div>
  );
}
