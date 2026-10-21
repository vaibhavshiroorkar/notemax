import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ROOT, WELCOME_ID, createNode, restoreNode, trashNode, type NodeKind, type Tree, type TreeItem } from "@notemax/core";
import { addRecent, recentPages } from "@/data/recent";
import { useWorkspace } from "@/data/useWorkspace";
import { useSignInRedirect } from "@/features/account/useSignInRedirect";
import { LinkHub } from "@/features/links/link-hub";
import { Palette } from "@/features/palette/Palette";
import { Settings } from "@/features/settings/Settings";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { StatusBar, pageStatus } from "@/features/status/StatusBar";
import { requestPersistentStorage } from "@/platform/platform";
import { getPref, setPref } from "@/platform/prefs";
import { registry } from "@/plugins/registry";
import { formatShortcut, matchesShortcut, shortcutFor, shortcutOverrides } from "@/plugins/shortcuts";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { ResizeHandle } from "@/ui/ResizeHandle";
import { SIDEBAR, SIDE_PANEL, sidePanelWidth, sidebarWidth } from "@/ui/layout";
import { showToast } from "@/ui/toast";
import { Toasts } from "@/ui/Toasts";
import { usePresence } from "@/ui/usePresence";
import { canGo, goBack, goForward, pageInAddress, pushPage, startHistory } from "./history";
import "./app.css";

// Matches the breakpoint in app.css where the sidebars become overlays.
const isNarrow = () => window.matchMedia("(max-width: 700px)").matches;

// Folders do not open as pages.
const isPage = (tree: Tree, id: string) => {
  const item = tree.items.get(id);
  return !!item && item.kind !== "folder";
};

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
  const [selectedId, setSelectedId] = useState(() => pageInAddress() ?? getPref("selectedId") ?? WELCOME_ID);
  const [sidebarOpen, setSidebarOpen] = useState(() => getPref("sidebarOpen") !== "false");
  const [sidePanelOpen, setSidePanelOpen] = useState(() => getPref("sidePanelOpen") !== "false");
  const [focusMode, setFocusMode] = useState(false);
  const [persistent, setPersistent] = useState<boolean>();
  const [readyMs, setReadyMs] = useState<number>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [accountError, setAccountError] = useState<string>();
  const overrides = shortcutOverrides.use();
  const leftWidth = sidebarWidth.use();
  const rightWidth = sidePanelWidth.use();
  const nav = canGo.use();

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

  // On a phone both sidebars cover the page, so get them out of the way.
  const clearOverlays = useCallback(() => {
    if (!isNarrow()) return;
    setSidebarOpen(false);
    setSidePanelOpen(false);
  }, []);

  const select = useCallback(
    (id: string) => {
      pushPage(id);
      setSelectedId(id);
      clearOverlays();
    },
    [clearOverlays],
  );

  // Back and Forward, from the app's commands, the mouse's side buttons or the browser.
  const firstSelected = useRef(selectedId);
  useEffect(
    () =>
      startHistory(firstSelected.current, (id) => {
        setSelectedId(id);
        clearOverlays();
      }),
    [clearOverlays],
  );

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
      // Esc leaves focus mode, unless it is closing a menu or dialog first. The
      // editor marks every Esc as handled, so the open popup is what tells.
      if (event.key === "Escape" && app.focusMode && !document.querySelector('dialog[open], [role="listbox"], [role="menu"]')) {
        setFocusMode(false);
        return;
      }
      const command = registry.commands(app).find((c) => {
        const shortcut = shortcutFor(c);
        return shortcut && matchesShortcut(event, shortcut);
      });
      if (!command) return;
      event.preventDefault();
      command.run(app);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeId = workspace.tree
    ? isPage(workspace.tree, selectedId)
      ? selectedId
      : // The selected page was trashed or is gone: show the last page that is still around.
        // Read without watching: the list changes on every page opened, and only matters here when the tree changes.
        (recentPages.get().find((id) => isPage(workspace.tree!, id)) ?? firstNote(workspace.tree.top))
    : null;
  useEffect(() => {
    if (activeId) addRecent(activeId);
  }, [activeId]);

  const showLeft = sidebarOpen && !focusMode;
  // Kept on the page a moment after closing, so it can slide out.
  const leftMounted = usePresence(showLeft);

  if (workspace.openError) return <p className="error">Could not open local storage: {workspace.openError}</p>;
  if (!workspace.doc || !workspace.tree) return null;

  const { tree, doc } = workspace;
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
    trash(id) {
      const node = tree.byId.get(id);
      trashNode(doc, id);
      showToast(`Moved "${node?.title || `Untitled ${node?.kind ?? "note"}`}" to trash`, { label: "Undo", run: () => restoreNode(doc, id) });
    },
    notify: showToast,
    canGoBack: nav.back,
    canGoForward: nav.forward,
    goBack,
    goForward,
    focusMode,
    toggleFocusMode() {
      if (!focusMode) showToast("Focus mode. Press Esc to leave.");
      setFocusMode(!focusMode);
    },
    // Asking for a sidebar is a way out of focus mode too.
    toggleSidebar() {
      if (focusMode) {
        setFocusMode(false);
        setSidebarOpen(true);
      } else setSidebarOpen((open) => !open);
    },
    showSidebar() {
      setFocusMode(false);
      setSidebarOpen(true);
    },
    toggleSidePanel() {
      if (focusMode) {
        setFocusMode(false);
        setSidePanelOpen(true);
      } else setSidePanelOpen((open) => !open);
    },
    openSettings: () => setSettingsOpen(true),
    openPalette: () => setPaletteOpen(true),
  };
  appRef.current = app;

  const View = activeNode && registry.pageView(activeNode.kind)?.component;
  const panel = registry.sidePanel(app);
  const showRight = !!panel && sidePanelOpen && !focusMode;
  const sidebarCommand = registry.allCommands().find((command) => command.id === "sidebar.toggle");
  const sidebarKeys = sidebarCommand ? shortcutFor(sidebarCommand, overrides) : "";

  return (
    <div
      className="app"
      data-sidebar={showLeft ? "open" : "closed"}
      data-side-panel={showRight ? "open" : "closed"}
      data-focus={focusMode || undefined}
      style={{ "--sidebar-width": `${leftWidth}px`, "--side-panel-width": `${rightWidth}px` } as CSSProperties}
    >
      {leftMounted && <Sidebar app={app} />}
      {showLeft && (
        <ResizeHandle side="left" label="Resize sidebar" size={SIDEBAR} width={sidebarWidth} cssVar="--sidebar-width" onCollapse={() => setSidebarOpen(false)} />
      )}
      <main className="main">
        <button
          className="icon-button sidebar-toggle"
          aria-label={showLeft ? "Hide sidebar" : "Show sidebar"}
          title={`${showLeft ? "Hide" : "Show"} sidebar${sidebarKeys ? ` (${formatShortcut(sidebarKeys)})` : ""}`}
          onClick={app.toggleSidebar}
        >
          <Icon name="sidebar" />
        </button>
        {panel && (
          <button
            className="icon-button side-panel-toggle"
            aria-label={`${showRight ? "Hide" : "Show"} ${panel.title}`}
            title={`${showRight ? "Hide" : "Show"} ${panel.title}`}
            onClick={app.toggleSidePanel}
          >
            <Icon name="side-panel" />
          </button>
        )}
        {activeNode && View ? (
          <View key={activeNode.id} node={activeNode} app={app} tree={tree} workspaceDoc={doc} hub={hub} onSelect={select} onStatus={pageStatus.set} onReady={onReady} />
        ) : activeNode ? (
          <p className="error">No plugin can open a {activeNode.kind}.</p>
        ) : (
          <p className="empty">No notes. Use + in the sidebar to create one.</p>
        )}
      </main>
      <RightPanel app={app} panel={panel} open={showRight} />
      {showRight && (
        <ResizeHandle
          side="right"
          label={`Resize ${panel!.title}`}
          size={SIDE_PANEL}
          width={sidePanelWidth}
          cssVar="--side-panel-width"
          onCollapse={() => setSidePanelOpen(false)}
        />
      )}
      {settingsOpen && <Settings persistent={persistent} accountError={accountError} onClose={() => setSettingsOpen(false)} />}
      {paletteOpen && <Palette app={app} onClose={() => setPaletteOpen(false)} />}
      <Toasts />
      <StatusBar workspaceStatus={workspace.status} words={activeNode?.kind === "note" ? activeNode.words : null} persistent={persistent} readyMs={readyMs} />
    </div>
  );
}

/**
 * The right sidebar, kept a moment after it closes so it can slide out. When it
 * closes because the page changed (a book's chapters, then a plain note), the
 * panel has nothing to show any more, so an empty one slides out instead.
 */
function RightPanel({ app, panel, open }: { app: AppContext; panel: ReturnType<typeof registry.sidePanel>; open: boolean }) {
  const mounted = usePresence(open);
  if (!mounted) return null;
  return panel ? <panel.component app={app} /> : <aside className="side-panel" />;
}
