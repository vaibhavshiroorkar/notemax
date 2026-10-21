import { useState } from "react";
import { registry } from "@/plugins/registry";
import { formatShortcut, sameShortcut, setShortcut, shortcutFor, shortcutFromEvent, shortcutOverrides } from "@/plugins/shortcuts";
import type { Command } from "@/plugins/types";
import "./shortcuts.css";

/** Every command, with its shortcut. Click a shortcut, then press the new keys. */
export function ShortcutsSection() {
  const overrides = shortcutOverrides.use();
  const [recording, setRecording] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const commands = registry.allCommands();

  const assign = (command: Command, shortcut: string) => {
    // One key press runs one command, so a shortcut moves rather than being shared.
    const taken = commands.filter((other) => other.id !== command.id && sameShortcut(shortcutFor(other, overrides), shortcut));
    taken.forEach((other) => setShortcut(other.id, ""));
    setShortcut(command.id, shortcut);
    setNote(taken.length ? `${formatShortcut(shortcut)} was taken from "${taken.map((other) => other.title).join('", "')}".` : "");
  };

  return (
    <section className="settings-section">
      <h3>Keyboard shortcuts</h3>
      <p>Click a shortcut and press new keys. They need Ctrl or Alt, or a function key. Backspace removes one, Esc cancels.</p>
      {note && <p className="shortcut-note" role="status">{note}</p>}
      <ul className="shortcut-list">
        {commands.map((command) => {
          const current = shortcutFor(command, overrides);
          const changed = command.id in overrides;
          const isRecording = recording === command.id;
          return (
            <li key={command.id} className="settings-row">
              <span>{command.title}</span>
              <span className="shortcut-controls">
                {changed && (
                  <button className="link-button" onClick={() => setShortcut(command.id, null)} aria-label={`Reset the shortcut for ${command.title}`}>
                    Reset
                  </button>
                )}
                <button
                  className="shortcut-key"
                  data-recording={isRecording || undefined}
                  aria-label={`Shortcut for ${command.title}: ${current ? formatShortcut(current) : "none"}. Click to change.`}
                  onClick={() => setRecording(isRecording ? null : command.id)}
                  onBlur={() => isRecording && setRecording(null)}
                  onKeyDown={(event) => {
                    if (!isRecording) return;
                    // Keys typed here set the shortcut. They must not also run commands or close Settings.
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.key === "Escape") return setRecording(null);
                    if (event.key === "Backspace" || event.key === "Delete") {
                      setShortcut(command.id, "");
                      return setRecording(null);
                    }
                    const shortcut = shortcutFromEvent(event.nativeEvent);
                    if (!shortcut) return;
                    assign(command, shortcut);
                    setRecording(null);
                  }}
                >
                  {isRecording ? "Press keys..." : current ? formatShortcut(current) : "None"}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
