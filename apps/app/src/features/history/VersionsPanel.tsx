import { useEffect, useState } from "react";
import * as Y from "yjs";
import { listVersions, type Version } from "@notemax/core";
import { withPageDoc } from "@/features/export/content";
import { storeFor } from "@/platform/platform";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { saveNow, versionEvery, versionsSaved } from "./versions";
import { useHidden } from "@/features/lock/LockedInline";

export const whenOf = (time: number) => {
  const date = new Date(time);
  const today = new Date().toDateString() === date.toDateString();
  return today ? `Today, ${date.toLocaleTimeString(undefined, { timeStyle: "short" })}` : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

/** The open page's saved versions in the right sidebar. A click shows one, with Restore. */
export function VersionsPanel({ app }: { app: AppContext }) {
  // A locked page's old text stays hidden with it.
  if (useHidden(app.tree.byId.get(app.activeId!))) return <p className="versions-empty">This page is locked.</p>;
  return <Versions app={app} />;
}

function Versions({ app }: { app: AppContext }) {
  const id = app.activeId!;
  const saved = versionsSaved.use();
  const every = versionEvery.use();
  const [versions, setVersions] = useState<Version[] | null>(null);

  useEffect(() => {
    let live = true;
    storeFor(app.workspace)
      .then((store) => listVersions(store, id))
      .then((list) => live && setVersions(list))
      .catch(() => live && setVersions([]));
    return () => {
      live = false;
    };
  }, [id, saved, app.workspace]);

  const saveHere = async () => {
    const state = await withPageDoc(id, (doc) => Y.encodeStateAsUpdate(doc), app.workspace);
    await saveNow(id, state, null, app.workspace);
    app.notify("Saved a version of this page");
  };

  return (
    <div className="versions">
      {versions === null ? null : versions.length ? (
        <ul>
          {versions.map((version) => (
            <li key={version.id}>
              <button className="version-row" onClick={() => app.openOverlay("history.preview", { pageId: id, versionId: version.id, workspace: app.workspace })}>
                <span>
                  {whenOf(version.time)}
                  {version.label && <span className="version-label">{version.label}</span>}
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
    </div>
  );
}
