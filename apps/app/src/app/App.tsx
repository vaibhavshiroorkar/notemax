import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ROOT, WELCOME_ID, createNode, type NodeKind, type SaveStatus, type TreeItem } from "@notemax/core";
import { useWorkspace } from "@/data/useWorkspace";
import { useSignInRedirect } from "@/features/account/useSignInRedirect";
import { LinkHub } from "@/features/links/link-hub";
import { Palette } from "@/features/palette/Palette";
import { Settings } from "@/features/settings/Settings";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { StatusBar } from "@/features/status/StatusBar";
import { requestPersistentStorage } from "@/platform/platform";
import { getPref, setPref } from "@/platform/prefs";
import { registry } from "@/plugins/registry";
import { matchesShortcut } from "@/plugins/shortcuts";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import "./app.css";

const severity: Record<SaveStatus["state"], number> = { saved: 0, saving: 1, error: 2 };
const worst = (a: SaveStatus, b: SaveStatus) => (severity[b.state] > severity[a.state] ? b : a);

// Matches the breakpoint in app.css where the sidebars become overlays.
const isNarrow = () => window.matchMedia("(max-width: 700px)").matches;

// Falls back when the remembered note or book was trashed or no longer exists.
// Folders do not open as pages, so this looks for the first note, in sidebar order.
function firstNote(items: TreeItem[]): string | null {
  for (const item of items) {
    if (item.kind === "note") return item.id;
    const inside = firstNote(item.children);
    if (inside) return inside;
  }
  return null;
}

export function App() {
  const workspace = useWorkspace();
  const [selectedId, setSelectedId] = useState(() => getPref("selectedId") ?? WELCOME_ID);
  const [sidebarOpen, setSidebarOpen] = useState(() => getPref("sidebarOpen") !== "false");
  const [sidePanelOpen, setSidePanelOpen] = useState(() => getPref("sidePanelOpen") !== "false");
  const [noteStatus, setNoteStatus] = useState<SaveStatus>({ state: "saved" });
  const [persistent, setPersistent] = useState<boolean>();
  const [readyMs, setReadyMs] = useState<number>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [accountError, setAccountError] = useState<string>();

  useEffect(() => {
    requestPersistentStorage().then(setPersistent, () => setPersistent(false));
  }, []);

  useSignInRedirect((error) => {
    setAccountError(error);
    setSettingsOpen(true);
  });

  useEffect(() => setPref("selectedId", selectedId), [selectedId]);
  useEffect(() => setPref("sidebarOpen", String(sidebarOpen)), [sidebarOpen]);
  useEffect(() => setPref("sidePanelOpen", String(sidePanelOpen)), [sidePanelOpen]);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    // On a phone both sidebars cover the page, so get them out of the way.
    if (isNarrow()) {
      setSidebarOpen(false);
      setSidePanelOpen(false);
    }
  }, []);

  const [hub] = useState(() => new LinkHub(select));
  // Before paint, so links never show an old title for a frame.
  useLayoutEffect(() => {
    if (workspace.doc && workspace.tree) hub.update(workspace.doc, workspace.tree);
  }, [hub, workspace.doc, workspace.tree]);

  // Only the first page to open counts toward startup time.
  // performance.now() counts from the moment the page started loading.
  const onReady = useCallback(() => setReadyMs((ms) => ms ?? performance.now()), []);

  // Shortcuts belong to commands, so a plugin's shortcut works like a built-in one.
  // The listener is added once and reads the latest context through this ref.
  const appRef = useRef<AppContext | null>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const app = appRef.current;
      if (!app) return;
      const command = registry.commands(app).find((c) => c.shortcut && matchesShortcut(event, c.shortcut));
      if (!command) return;
      event.preventDefault();
      command.run(app);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (workspace.openError) return <p className="error">Could not open local storage: {workspace.openError}</p>;
  if (!workspace.doc || !workspace.tree) return null;

  const { tree, doc } = workspace;
  const selected = tree.items.get(selectedId);
  const activeId = selected && selected.kind !== "folder" ? selectedId : firstNote(tree.top);
  const activeNode = activeId ? tree.byId.get(activeId) : undefined;

  const app: AppContext = {
    tree,
    doc,
    activeId,
    open: select,
    create(kind: NodeKind) {
      const id = createNode(doc, kind, ROOT);
      // A folder has no page; it is named in its sidebar row instead.
      if (kind !== "folder") select(id);
    },
    toggleSidebar: () => setSidebarOpen((open) => !open),
    toggleSidePanel: () => setSidePanelOpen((open) => !open),
    openSettings: () => setSettingsOpen(true),
    openPalette: () => setPaletteOpen(true),
  };
  appRef.current = app;

  const View = activeNode && registry.pageView(activeNode.kind)?.component;
  const panel = registry.sidePanel(app);
  const showPanel = !!panel && sidePanelOpen;

  return (
    <div className="app" data-sidebar={sidebarOpen ? "open" : "closed"} data-side-panel={showPanel ? "open" : "closed"}>
      {sidebarOpen && <Sidebar tree={tree} doc={doc} activeId={activeId} onSelect={select} onOpenSettings={app.openSettings} />}
      <main className="main">
        <button
          className="icon-button sidebar-toggle"
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          title={`${sidebarOpen ? "Hide" : "Show"} sidebar (Ctrl+\\)`}
          onClick={app.toggleSidebar}
        >
          <Icon name="sidebar" />
        </button>
        {panel && (
          <button
            className="icon-button side-panel-toggle"
            aria-label={`${sidePanelOpen ? "Hide" : "Show"} ${panel.title}`}
            title={`${sidePanelOpen ? "Hide" : "Show"} ${panel.title}`}
            onClick={app.toggleSidePanel}
          >
            <Icon name="side-panel" />
          </button>
        )}
        {activeNode && View ? (
          <View key={activeNode.id} node={activeNode} tree={tree} workspaceDoc={doc} hub={hub} onSelect={select} onStatus={setNoteStatus} onReady={onReady} />
        ) : activeNode ? (
          <p className="error">No plugin can open a {activeNode.kind}.</p>
        ) : (
          <p className="empty">No notes. Use + in the sidebar to create one.</p>
        )}
      </main>
      {showPanel && <panel.component app={app} />}
      {settingsOpen && <Settings persistent={persistent} accountError={accountError} onClose={() => setSettingsOpen(false)} />}
      {paletteOpen && <Palette app={app} onClose={() => setPaletteOpen(false)} />}
      <StatusBar status={worst(workspace.status, noteStatus)} persistent={persistent} readyMs={readyMs} />
    </div>
  );
}
