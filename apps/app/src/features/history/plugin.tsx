import type { AppContext, Plugin } from "@/plugins/types";
import { VersionPreview } from "./VersionPreview";
import { VersionsPanel } from "./VersionsPanel";
import { versionEvery } from "./versions";
import "./history.css";

const CHOICES: [number, string][] = [
  [5, "Every 5 minutes of editing"],
  [10, "Every 10 minutes of editing"],
  [30, "Every 30 minutes of editing"],
  [60, "Every hour of editing"],
  [0, "Never"],
];

function HistorySection() {
  const every = versionEvery.use();
  return (
    <>
      <p>Notemax keeps earlier versions of each note: how it was before you started editing, then one every few minutes, then how you left it. Older ones thin out to one a day, then one a week. They sync and back up with your notes.</p>
      <label className="settings-row">
        <span>
          Save a version
          <span className="settings-description">Find them in the right sidebar of a note, under Versions.</span>
        </span>
        <select className="settings-select" value={every} onChange={(event) => versionEvery.set(Number(event.target.value))}>
          {CHOICES.map(([minutes, label]) => (
            <option key={minutes} value={minutes}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

const onNote = (app: AppContext) => !!app.activeId && app.tree.byId.get(app.activeId)?.kind === "note";

export const historyPlugin: Plugin = {
  id: "history",
  name: "Version history",
  description: "Earlier versions of each note, to look at or restore",
  sidePanels: [{ id: "history.versions", title: "Versions", order: 40, when: onNote, component: VersionsPanel }],
  overlays: [{ id: "history.preview", component: VersionPreview }],
  settings: [{ id: "history", order: 52, title: "History", icon: "history", keywords: ["versions", "backup", "restore", "undo", "snapshot"], component: HistorySection }],
  commands: [
    {
      id: "history.show",
      title: "Show the versions of this note",
      keywords: ["history", "restore", "earlier", "backup"],
      when: onNote,
      run(app) {
        if (!document.querySelector(".versions")) app.toggleSidePanel();
        requestAnimationFrame(() => document.querySelector(".versions")?.scrollIntoView({ block: "nearest" }));
      },
    },
  ],
};
