import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { WELCOME_ID, type SaveStatus, type Tree } from "@notemax/core";
import { Icon } from "./Icon";
import { LinkHub } from "./links/link-hub";
import { NotePane } from "./NotePane";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { getPref, setPref } from "./prefs";
import { requestPersistentStorage } from "./platform";
import { useWorkspace } from "./useWorkspace";

const severity: Record<SaveStatus["state"], number> = { saved: 0, saving: 1, error: 2 };
const worst = (a: SaveStatus, b: SaveStatus) => (severity[b.state] > severity[a.state] ? b : a);

// Matches the breakpoint in styles.css where the sidebar becomes an overlay.
const isNarrow = () => window.matchMedia("(max-width: 700px)").matches;

// Falls back when the remembered note was trashed or no longer exists.
const firstVisible = (tree: Tree) => tree.inbox[0]?.id ?? tree.books[0]?.id ?? null;

export function App() {
  const workspace = useWorkspace();
  const [selectedId, setSelectedId] = useState(() => getPref("selectedId") ?? WELCOME_ID);
  const [sidebarOpen, setSidebarOpen] = useState(() => getPref("sidebarOpen") !== "false");
  const [noteStatus, setNoteStatus] = useState<SaveStatus>({ state: "saved" });
  const [persistent, setPersistent] = useState<boolean>();
  const [readyMs, setReadyMs] = useState<number>();

  useEffect(() => {
    requestPersistentStorage().then(setPersistent, () => setPersistent(false));
  }, []);

  useEffect(() => setPref("selectedId", selectedId), [selectedId]);
  useEffect(() => setPref("sidebarOpen", String(sidebarOpen)), [sidebarOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "\\") setSidebarOpen((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    // On a phone the sidebar covers the note, so get it out of the way.
    if (isNarrow()) setSidebarOpen(false);
  }, []);

  const [hub] = useState(() => new LinkHub(select));
  // Before paint, so links never show an old title for a frame.
  useLayoutEffect(() => {
    if (workspace.doc && workspace.tree) hub.update(workspace.doc, workspace.tree);
  }, [hub, workspace.doc, workspace.tree]);

  // Only the first note to open counts toward startup time.
  // performance.now() counts from the moment the page started loading.
  const onReady = useCallback(() => setReadyMs((ms) => ms ?? performance.now()), []);

  if (workspace.openError) return <p className="error">Could not open local storage: {workspace.openError}</p>;
  if (!workspace.doc || !workspace.tree) return null;

  const { tree, doc } = workspace;
  const activeId = tree.visible.has(selectedId) ? selectedId : firstVisible(tree);
  const activeNode = activeId ? tree.byId.get(activeId) : undefined;

  return (
    <div className="app" data-sidebar={sidebarOpen ? "open" : "closed"}>
      {sidebarOpen && <Sidebar tree={tree} doc={doc} activeId={activeId} onSelect={select} />}
      <main className="main">
        <button
          className="icon-button sidebar-toggle"
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          title={`${sidebarOpen ? "Hide" : "Show"} sidebar (Ctrl+\\)`}
          onClick={() => setSidebarOpen((open) => !open)}
        >
          <Icon name="sidebar" />
        </button>
        {activeNode ? (
          <NotePane key={activeNode.id} node={activeNode} tree={tree} hub={hub} workspaceDoc={doc} onStatus={setNoteStatus} onReady={onReady} />
        ) : (
          <p className="empty">No notes. Use + in the sidebar to create one.</p>
        )}
      </main>
      <StatusBar status={worst(workspace.status, noteStatus)} persistent={persistent} readyMs={readyMs} />
    </div>
  );
}
