import { useId } from "react";
import { onlineMode, startAt, type Mode } from "@/platform/mode";
import { Segmented } from "@/ui/Segmented";

const modes = [
  { value: "offline" as const, label: "Offline" },
  { value: "online" as const, label: "Online" },
];

const OFFLINE = ["Notes, books, boards and code pages", "Search, links, the graph and tags", "Versions, the trash and undo", "Downloads and a folder of Markdown files", "Voice typing (in Chrome and Edge)"];
const ONLINE = ["Sync with your other devices, through your own Google Drive", "Live updates between open devices", "Sharing pages and writing together", "Your account, and keeping browser pages"];

/** Settings, Setup: offline or online, where a window starts, and what each mode includes. */
export function SetupSection() {
  const mode = onlineMode.use();
  const start = startAt.use();
  const startId = useId();
  return (
    <>
      <p>Choose how Notemax works on this device. Change it any time; your pages stay as they are.</p>
      <div className="settings-row">
        <span>
          Online features
          <span className="settings-description">{mode === null ? "Not chosen yet, so everything is on." : mode === "offline" ? "Off: nothing leaves this device." : "On: sign in to use them."}</span>
        </span>
        {/* Neither is picked until chosen. */}
        <Segmented<Mode> label="Online features" value={(mode ?? "") as Mode} options={modes} onChange={(value) => onlineMode.set(value)} />
      </div>
      <div className="setup-lists">
        <div>
          <h4 className="settings-subhead">Works offline</h4>
          <ul>
            {OFFLINE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div data-off={mode === "offline" || undefined}>
          <h4 className="settings-subhead">Needs online</h4>
          <ul>
            {ONLINE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="settings-row">
        <label htmlFor={startId}>When Notemax opens</label>
        <select id={startId} className="settings-select" value={start} onChange={(event) => startAt.set(event.target.value as typeof start)}>
          <option value="last">Where you left off</option>
          <option value="home">Home, with all workspaces</option>
          <option value="page">The start page (Special pages)</option>
        </select>
      </div>
    </>
  );
}
