import { useState } from "react";
import { isDesktop } from "@/platform/platform";
import { askToNotify } from "./reminders";

type Leave = "granted" | "denied" | "default" | "none";

const leaveNow = (): Leave => (isDesktop ? "granted" : typeof Notification === "undefined" ? "none" : Notification.permission);

/** Settings, Reminders: whether reminders can show over other apps, and how they work. */
export function RemindersSection() {
  const [leave, setLeave] = useState<Leave>(leaveNow);
  return (
    <>
      <div className="settings-row">
        <div className="settings-row-text">
          <strong>Notifications</strong>
          <span>
            {leave === "granted"
              ? "Reminders show as notifications too."
              : leave === "denied"
                ? "This browser blocks notifications from Notemax. Allow them in the site settings by the address bar."
                : leave === "none"
                  ? "This browser cannot show notifications. Reminders show in the window."
                  : "Reminders show in the window. Allow notifications to see them over other apps too."}
          </span>
        </div>
        {leave === "default" && (
          <button className="button" onClick={() => void askToNotify().then(() => setLeave(leaveNow()))}>
            Allow notifications
          </button>
        )}
      </div>
      <p className="settings-note">
        A to-do with a time rings at that time. Click its date chip to ring earlier, on a day with no time, or not at all. Reminders ring while Notemax is open{isDesktop ? ", and the desktop app keeps running in the tray when its window is closed" : ""}. One missed while it was closed rings when it opens, if it is less than a day old.
      </p>
    </>
  );
}
