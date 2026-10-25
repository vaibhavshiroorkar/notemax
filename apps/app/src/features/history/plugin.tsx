import type { AppContext, Plugin } from "@/plugins/types";
import { VersionPreview } from "./VersionPreview";
import { VersionsPanel } from "./VersionsPanel";
import { versionDays, versionEvery, versionLimit } from "./versions";
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
  const limit = versionLimit.use();
  const days = versionDays.use();
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
      <label className="settings-row">
        <span>Versions per page<span className="settings-description">Applied when the next version is saved. Recovery snapshots stay available.</span></span>
        <select aria-label="Versions per page" className="settings-select" value={limit} onChange={(event) => versionLimit.set(Number(event.target.value))}>
          {[20, 50, 100, 200, 500].map((count) => <option key={count} value={count}>{count}</option>)}
        </select>
      </label>
      <label className="settings-row">
        <span>Keep versions for<span className="settings-description">The latest version and recovery snapshots are always kept.</span></span>
        <select aria-label="Keep versions for" className="settings-select" value={days} onChange={(event) => versionDays.set(Number(event.target.value))}>
          <option value={0}>No age limit</option>
          {[7, 30, 90, 365].map((count) => <option key={count} value={count}>{count} days</option>)}
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
  settings: [{ id: "history", order: 52, group: "Your data", title: "History", icon: "history", keywords: ["versions", "backup", "restore", "undo", "snapshot"], component: HistorySection }],
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
