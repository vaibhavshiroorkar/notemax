import { useEffect, useState } from "react";
import * as Y from "yjs";
import { listLog, listVersions, type AuditEntry, type Author, type Version } from "@notemax/core";
import { withPageDoc } from "@/features/export/content";
import { storeFor } from "@/platform/platform";
import { savedStore } from "@/platform/store";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { Segmented } from "@/ui/Segmented";
import { historyChanged, logPage, stampOf, whatHappened, whoIs } from "./audit";
import { saveNow, versionEvery } from "./versions";
import { useHidden } from "@/features/lock/LockedInline";

export const whenOf = (time: number) => {
  const date = new Date(time);
  const today = new Date().toDateString() === date.toDateString();
  return today ? `Today, ${date.toLocaleTimeString(undefined, { timeStyle: "short" })}` : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

type Tab = "versions" | "activity";
const tab = savedStore<Tab>("historyTab", "versions");

/** Names joined for a sentence: "Ana", "Ana and Ben", "Ana, Ben and Chloe". */
const names = (people: readonly Author[]) => {
  const list = people.map((person) => whoIs(person).name);
  return list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list.at(-1)}` : (list[0] ?? "");
};

/**
 * The open page's history in the right sidebar. Versions: a note's saved
 * versions, each with who made its changes; a click shows one, with Restore.
 * Activity: who did what to the page, edits and everything else, newest first.
 */
export function VersionsPanel({ app }: { app: AppContext }) {
  // A locked page's old text and its log stay hidden with it.
  if (useHidden(app.tree.byId.get(app.activeId!))) return <p className="versions-empty">This page is locked.</p>;
  return <History app={app} />;
}

function History({ app }: { app: AppContext }) {
  const id = app.activeId!;
  const isNote = app.tree.byId.get(id)?.kind === "note";
  const chosen = tab.use();
  const shown: Tab = isNote ? chosen : "activity";
  const changed = historyChanged.use();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [log, setLog] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    let live = true;
    const store = storeFor(app.workspace);
    store
      .then((s) => listVersions(s, id))
      .then((list) => live && setVersions(list))
      .catch(() => live && setVersions([]));
    store
      .then((s) => listLog(s, id))
      .then((list) => live && setLog(list))
      .catch(() => live && setLog([]));
    return () => {
      live = false;
    };
  }, [id, changed, app.workspace]);

  return (
    <div className="versions">
      {isNote && (
        <Segmented<Tab>
          label="Show"
          value={shown}
          options={[
            { value: "versions", label: "Versions" },
            { value: "activity", label: "Activity" },
          ]}
          onChange={tab.set}
        />
      )}
      {shown === "versions" ? <Versions app={app} id={id} versions={versions} /> : <Activity app={app} id={id} versions={isNote ? versions : []} log={log} />}
    </div>
  );
}

function Versions({ app, id, versions }: { app: AppContext; id: string; versions: Version[] | null }) {
  const every = versionEvery.use();
  const open = (version: Version) => app.openOverlay("history.preview", { pageId: id, versionId: version.id, workspace: app.workspace });
  const saveHere = async () => {
    const state = await withPageDoc(id, (doc) => Y.encodeStateAsUpdate(doc), app.workspace);
    await saveNow(id, state, null, app.workspace);
    void logPage(id, "saved-version", null, app.workspace);
    app.notify("Saved a version of this page");
  };

  return (
    <>
      {versions === null ? null : versions.length ? (
        <ul>
          {versions.map((version) => (
            <li key={version.id}>
              <button className="version-row" onClick={() => open(version)}>
                <span>
                  {whenOf(version.time)}
                  {version.label && <span className="version-label">{version.label}</span>}
                  {!!version.by?.length && <span className="version-by">by {names(version.by)}</span>}
                </span>
                {version.words !== null && <span className="version-words">{version.words.toLocaleString()} {version.words === 1 ? "word" : "words"}</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="versions-empty">{every ? `No versions yet. One is saved every ${every} minutes while you edit.` : "Versions are off. Turn them on in Settings, History."}</p>
      )}
      <button className="footer-button" onClick={() => void saveHere()}>
        <Icon name="history" />
        <span>Save a version now</span>
      </button>
    </>
  );
}

/** One line of the timeline: a log entry, or a version that holds someone's edits. */
type Line = { time: number; key: string; who: Author; what: string; version?: Version };

function Activity({ app, id, versions, log }: { app: AppContext; id: string; versions: Version[] | null; log: AuditEntry[] | null }) {
  if (versions === null || log === null) return null;
  const lines: Line[] = [
    ...log.map((entry) => ({ time: entry.time, key: entry.id, who: entry.who, what: whatHappened(entry) })),
    // Each version names whose edits are new in it: those are the edits in the timeline.
    ...versions.flatMap((version) => (version.by ?? []).map((who, i) => ({ time: version.time, key: `${version.id}:${i}`, who, what: "edited it", version }))),
  ].sort((a, b) => b.time - a.time);
  if (!lines.length) return <p className="versions-empty">Nothing recorded yet.</p>;
  return (
    <ul className="activity" aria-label="Who did what">
      {lines.map((line) => {
        const who = whoIs(line.who);
        return (
          <li key={line.key} className="activity-line">
            <span className="activity-what">
              <b>{who.name}</b> {line.what}
              {line.version && (
                <>
                  {" "}
                  <button className="activity-link" onClick={() => app.openOverlay("history.preview", { pageId: id, versionId: line.version!.id, workspace: app.workspace })}>
                    see the version
                  </button>
                </>
              )}
            </span>
            <span className="activity-when">
              {stampOf(line.time)}
              {who.device && `, ${who.device}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
