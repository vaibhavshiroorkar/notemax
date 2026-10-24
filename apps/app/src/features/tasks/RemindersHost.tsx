import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { setDone } from "./list";
import { dismiss, ringing, snooze, tomorrowMorning, type Ring } from "./reminders";
import { whenLabel } from "./when";

const MINUTE = 60 * 1000;

function Card({ app, ring }: { app: AppContext; ring: Ring }) {
  const { task, noteId } = ring.entry;
  const note = app.tree.byId.get(noteId);
  return (
    <section className="reminder" role="alertdialog" aria-label={`Reminder: ${task.text}`}>
      <header className="reminder-head">
        <Icon name="clock" />
        <strong>{task.text}</strong>
        <button className="icon-button" aria-label="Close" onClick={() => dismiss(ring)}>
          <Icon name="close" />
        </button>
      </header>
      <p className="reminder-when">
        {whenLabel(task)}
        {note && (
          <>
            {" in "}
            <button
              className="link-button"
              onClick={() => {
                app.open(noteId);
                dismiss(ring);
              }}
            >
              {note.title || "Untitled"}
            </button>
          </>
        )}
      </p>
      <div className="reminder-actions">
        <button
          className="button"
          onClick={() => {
            void setDone(app, ring.entry, true);
            dismiss(ring);
          }}
        >
          Done
        </button>
        <span className="reminder-snooze">
          Later:
          <button className="link-button" onClick={() => snooze(ring, Date.now() + 10 * MINUTE)}>
            10 min
          </button>
          <button className="link-button" onClick={() => snooze(ring, Date.now() + 60 * MINUTE)}>
            1 hour
          </button>
          <button className="link-button" onClick={() => snooze(ring, tomorrowMorning())}>
            Tomorrow
          </button>
        </span>
      </div>
    </section>
  );
}

/** Reminders ringing now, stacked at the bottom right until each is answered. */
export function RemindersHost({ app }: { app: AppContext }) {
  const rings = ringing.use();
  if (!rings.length) return null;
  return (
    <div className="reminders" aria-live="polite">
      {rings.map((ring) => (
        <Card key={ring.key} app={app} ring={ring} />
      ))}
    </div>
  );
}
