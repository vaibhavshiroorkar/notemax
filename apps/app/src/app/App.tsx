import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { ROOT, WELCOME_ID, createNode, restoreNode, trashNode, type NodeKind, type Tree, type TreeItem, type TreeNode } from "@notemax/core";
import { addRecent, recentPages } from "@/data/recent";
import { useWorkspace } from "@/data/useWorkspace";
import { useSignInRedirect } from "@/features/account/useSignInRedirect";
import { LinkHub } from "@/features/links/link-hub";
import { Palette } from "@/features/palette/Palette";
import { QuickSettings } from "@/features/settings/QuickSettings";
import { Settings } from "@/features/settings/Settings";
import { ShortcutsHelp } from "@/features/shortcuts/ShortcutsHelp";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { StatusBar, pageStatus } from "@/features/status/StatusBar";
import { memoryOnly, requestPersistentStorage } from "@/platform/platform";
import { startAt } from "@/platform/mode";
import { getPref, setPref } from "@/platform/prefs";
import { useOption } from "@/plugins/options";
import { pluginsVersion, registry, setPluginOn } from "@/plugins/registry";
import { formatShortcut, matchesShortcut, shortcutFor, shortcutOverrides } from "@/plugins/shortcuts";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { ResizeHandle } from "@/ui/ResizeHandle";
import { Safe } from "@/ui/Safe";
import { SIDEBAR, SIDE_PANEL, sidePanelWidth, sidebarWidth } from "@/ui/layout";
import { showToast } from "@/ui/toast";
import { ContextMenuHost, contextMenuHandler } from "@/ui/ContextMenu";
import { PromptHost } from "@/ui/Prompt";
import { Toasts } from "@/ui/Toasts";
import { usePresence } from "@/ui/usePresence";
import { useEdgeSwipe } from "./useEdgeSwipe";
import { useHidingBars } from "./useHidingBars";
import { RightSidebar } from "./RightSidebar";
import { revealing, useReveal } from "./reveal";
import { pageInAddress, showInAddress, startBrowserNavigation } from "./history";
import { TabStrip } from "./TabStrip";
import { SplitDivider } from "./SplitDivider";
import {
  activatePane,
  canGoBack,
  canGoForward,
  canSplit,
  closePane,
  closeTab,
  moveTabToPane,
  splitOf,
  splitTab,
  type Edge,
  type Pane,
  type Split,
  currentVisit,
  cycleTab,
  goBack,
  goForward,
  isView,
  layout,
  loadTabs,
  newTab,
  openPage,
  replacePage,
  reopenClosedTab,
  viewId,
  viewPage,
} from "./tabs";
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
  // The saved tabs load once, before the first draw. A page in the address
  // (a reload or a bookmark) opens in the active tab.
  useState(() => {
    loadTabs(getPref("selectedId") ?? WELCOME_ID);
    const fromAddress = pageInAddress();
    if (fromAddress && currentVisit()?.page !== fromAddress) openPage(fromAddress);
    else if (!fromAddress && startAt.get() === "home" && currentVisit()?.page !== viewPage("home")) openPage(viewPage("home"));
  });
  const tabs = layout.use();
  // Split view needs room: a phone shows the active pane alone.
  const [narrow, setNarrow] = useState(isNarrow);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 700px)");
    const onChange = () => setNarrow(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  const visit = currentVisit(tabs);
  const selectedId = visit && !isView(visit.page) ? visit.page : null;
  // On a phone the sides cover the page, so they start closed there.
  const [sidebarOpen, setSidebarOpen] = useState(() => !isNarrow() && getPref("sidebarOpen") !== "false");
  const [sidePanelOpen, setSidePanelOpen] = useState(() => !isNarrow() && getPref("sidePanelOpen") !== "false");
  const [focusMode, setFocusMode] = useState(false);
  const [persistent, setPersistent] = useState<boolean>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<string>();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [overlay, setOverlay] = useState<{ id: string; options: Record<string, unknown> } | null>(null);
  const closeQuick = useCallback(() => setQuickOpen(false), []);
  const [accountError, setAccountError] = useState<string>();
  const overrides = shortcutOverrides.use();
  const leftWidth = sidebarWidth.use();
  const rightWidth = sidePanelWidth.use();
  const calm = useOption("appearance", "fadeControls");
  // Switching a plugin on or off redraws everything, and starts the editor and sidebar over.
  const version = pluginsVersion.use();

  useEffect(() => {
    requestPersistentStorage().then(setPersistent, () => setPersistent(false));
  }, []);

  // Plugins' start hooks, like sync, run once the workspace is open.
  const started = useRef(false);
  useEffect(() => {
    if (!workspace.doc || started.current || !appRef.current) return;
    started.current = true;
    for (const start of registry.starters()) {
      try {
        start(appRef.current);
      } catch (err) {
        console.warn("[notemax] a plugin failed to start", err);
      }
    }
  });

  useSignInRedirect((error) => {
    // The account window, or Settings when the Sync plugin that adds it is off.
    if (registry.overlay("account")) return setOverlay({ id: "account", options: { error } });
    setAccountError(error);
    setSettingsSection("account");
    setSettingsOpen(true);
  });

  useEffect(() => {
    if (selectedId) setPref("selectedId", selectedId);
    showInAddress(visit?.page ?? null);
  }, [selectedId, visit?.page]);
  // Only a wide window's choice is kept: closing a side on a phone says nothing about the desktop.
  useEffect(() => void (isNarrow() || setPref("sidebarOpen", String(sidebarOpen))), [sidebarOpen]);
  useEffect(() => void (isNarrow() || setPref("sidePanelOpen", String(sidePanelOpen))), [sidePanelOpen]);

  // A window that becomes phone-sized closes its sides, so the page shows.
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 700px)");
    const onChange = () => {
      if (!narrow.matches) return;
      setSidebarOpen(false);
      setSidePanelOpen(false);
    };
    narrow.addEventListener("change", onChange);
    return () => narrow.removeEventListener("change", onChange);
  }, []);

  // On a phone the sides float over the page and would cover each other, so one opening closes the other.
  const openSide = useCallback((side: "left" | "right", open: boolean) => {
    setFocusMode(false);
    (side === "left" ? setSidebarOpen : setSidePanelOpen)(open);
    if (open && isNarrow()) (side === "left" ? setSidePanelOpen : setSidebarOpen)(false);
  }, []);

  const frame = useRef<HTMLDivElement>(null);
  useHidingBars(frame, visit?.page ?? null);

  useEdgeSwipe(
    () => openSide("left", true),
    () => {
      setSidebarOpen(false);
      setSidePanelOpen(false);
    },
  );

  // On a phone both sidebars cover the page, so get them out of the way.
  const clearOverlays = useCallback(() => {
    if (!isNarrow()) return;
    setSidebarOpen(false);
    setSidePanelOpen(false);
  }, []);

  // Read when opening, so select stays the same function for the link hub.
  const treeNow = useRef(workspace.tree);
  treeNow.current = workspace.tree;
  const select = useCallback(
    (id: string, where?: { newTab?: boolean; fromTrash?: boolean }) => {
      const host = !where?.fromTrash && treeNow.current ? registry.hostOf(treeNow.current, id) : undefined;
      if (host) revealing.set(id);
      openPage(host ?? id, { newTab: where?.newTab, options: where?.fromTrash ? { fromTrash: true } : undefined });
      clearOverlays();
    },
    [clearOverlays],
  );

  // Back and Forward, from the app's commands, the mouse's side buttons or the browser.
  useEffect(
    () =>
      startBrowserNavigation(
        () => {
          goBack();
          clearOverlays();
        },
        () => {
          goForward();
          clearOverlays();
        },
      ),
    [clearOverlays],
  );

  const [hub] = useState(() => new LinkHub(select));
  // Before paint, so links never show an old title for a frame.
  useLayoutEffect(() => {
    if (workspace.doc && workspace.tree) hub.update(workspace.doc, workspace.tree);
  }, [hub, workspace.doc, workspace.tree]);

  // Only the first page to open counts toward startup time.
  // A mark, not text on screen: it shows in the browser's performance panel.
  const onReady = useCallback(() => {
    if (!performance.getEntriesByName("notemax:ready").length) performance.mark("notemax:ready");
  }, []);

  // Shortcuts belong to commands, so a plugin's shortcut works like a built-in one.
  // The listener is added once and reads the latest context through this ref.
  const appRef = useRef<AppContext | null>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const app = appRef.current;
      if (!app) return;
      // Esc leaves focus mode, unless it is closing a menu or dialog first. The
      // editor marks every Esc as handled, so the open popup is what tells.
      if (event.key === "Escape" && app.focusMode && !document.querySelector('dialog[open], [role="listbox"], [role="menu"], [role="dialog"]')) {
        setFocusMode(false);
        return;
      }
      // A key the focused thing already used, like Ctrl+] in a board (bring forward), is not also a command.
      if (event.defaultPrevented) return;
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

  // A new tab and a view, like the graph, have no page of the tree open.
  // A page opened from the trash stays open to be looked at. One trashed while open moves on.
  const lookingInTrash = (tree: Tree, id: string) => visit?.options?.fromTrash === true && tree.byId.has(id) && tree.byId.get(id)!.kind !== "folder";
  // A tab saved on a subtopic, from before subtopics lived in their chapter's page.
  const hostId = workspace.tree && selectedId ? registry.hostOf(workspace.tree, selectedId) : undefined;
  const activeId =
    workspace.tree && selectedId
      ? hostId
        ? hostId
        : isPage(workspace.tree, selectedId) || lookingInTrash(workspace.tree, selectedId)
        ? selectedId
        : // The selected page was trashed or is gone: show the last page that is still around.
          // Read without watching: the list changes on every page opened, and only matters here when the tree changes.
          (recentPages.get().find((id) => isPage(workspace.tree!, id)) ?? firstNote(workspace.tree.top))
      : null;
  useEffect(() => {
    if (activeId) addRecent(activeId);
    // The tab shows what is really open, so its title and Back make sense.
    if (activeId && selectedId && activeId !== selectedId) {
      if (hostId === activeId) revealing.set(selectedId);
      replacePage(activeId);
    }
  }, [activeId, selectedId, hostId]);
  useReveal();

  const showLeft = sidebarOpen && !focusMode;
  // A side opened by a swipe brings the hidden phone bar back, with its buttons.
  useEffect(() => {
    if ((sidebarOpen || sidePanelOpen) && frame.current) delete frame.current.dataset.bars;
  }, [sidebarOpen, sidePanelOpen]);
  // Kept on the page a moment after closing, so it can slide out.
  const leftMounted = usePresence(showLeft);

  // A device that keeps no pages explains its own failure: there is no local storage to blame.
  if (workspace.openError) return <p className="error">{memoryOnly ? workspace.openError : `Could not open local storage: ${workspace.openError}`}</p>;
  if (!workspace.doc || !workspace.tree) return null;

  const { tree, doc } = workspace;
  const activeNode = activeId ? tree.byId.get(activeId) : undefined;

  const app: AppContext = {
    tree,
    doc,
    hub,
    activeId,
    open: select,
    create(kind: NodeKind) {
      const id = createNode(doc, kind, ROOT);
      // A folder has no page; it is named in its sidebar row instead.
      if (kind !== "folder") select(id);
    },
    trash(ids) {
      const list = typeof ids === "string" ? [ids] : [...ids];
      if (!list.length) return;
      const node = tree.byId.get(list[0]);
      const wasOpen = activeId !== null && list.includes(activeId) ? activeId : null;
      doc.transact(() => list.forEach((id) => trashNode(doc, id)));
      const what = list.length > 1 ? `${list.length} pages` : `"${node?.title || `Untitled ${node?.kind ?? "note"}`}"`;
      showToast(`Moved ${what} to trash`, {
        label: "Undo",
        run() {
          doc.transact(() => list.forEach((id) => restoreNode(doc, id)));
          // The tab moved on to another page; Undo brings the page back to it.
          if (wasOpen) replacePage(wasOpen);
        },
      });
    },
    notify: showToast,
    openView: (id, options, where) => {
      openPage(viewPage(id), { ...where, options });
      clearOverlays();
    },
    canGoBack: canGoBack(tabs),
    canGoForward: canGoForward(tabs),
    goBack,
    goForward,
    newTab,
    closeTab: () => closeTab(),
    reopenClosedTab,
    cycleTab,
    focusMode,
    toggleFocusMode() {
      if (!focusMode) showToast("Focus mode. Press Esc to leave.");
      setFocusMode(!focusMode);
    },
    // Asking for a sidebar is a way out of focus mode too.
    toggleSidebar: () => openSide("left", focusMode || !sidebarOpen),
    showSidebar: () => openSide("left", true),
    toggleSidePanel: () => openSide("right", focusMode || !sidePanelOpen),
    openSettings(section) {
      setSettingsSection(section);
      setSettingsOpen(true);
    },
    openPalette: () => setPaletteOpen(true),
    openShortcuts: () => setShortcutsOpen(true),
    toggleQuickSettings: () => setQuickOpen((open) => !open),
    openOverlay: (id, options = {}) => {
      setOverlay({ id, options });
      clearOverlays();
    },
  };
  appRef.current = app;

  const View = activeNode && registry.pageView(activeNode.kind)?.component;
  const OverlayView = overlay && registry.overlay(overlay.id)?.component;
  const ViewPage = visit && isView(visit.page) ? registry.view(viewId(visit.page))?.component : undefined;
  const HomePage = registry.view("home")?.component;
  const panels = registry.sidePanels(app);

  const activePage =
    visit && isView(visit.page) ? (
      ViewPage ? (
        <Safe key={`${visit.page}:${version}`} name={viewId(visit.page)}>
          <ViewPage app={app} options={visit.options ?? {}} />
        </Safe>
      ) : (
        <div className="plugin-off">
          <p>The plugin that shows this page is off or gone.</p>
        </div>
      )
    ) : activeNode && View ? (
      <Safe key={`${activeNode.id}:${version}`} name="This page">
        <View node={activeNode} app={app} tree={tree} workspaceDoc={doc} hub={hub} onSelect={select} onStatus={pageStatus.set} onReady={onReady} />
      </Safe>
    ) : activeNode ? (
      <PluginOff node={activeNode} app={app} />
    ) : !visit && HomePage ? (
      // A tab with nothing open, like the last one after closing the others, shows Home.
      <Safe key={`home:${version}`} name="Home">
        <HomePage app={app} options={{}} />
      </Safe>
    ) : (
      <p className="empty">No notes. Use + in the sidebar to create one.</p>
    );

  // Split view: each pane shows its own tab. The active pane is the one above;
  // the others show their page the same way, but leave the status bar and Back to it.
  const split = splitOf(tabs);
  const multi = tabs.panes.length > 1 && !narrow;
  const pageOf = (pane: Pane): ReactNode => {
    if (pane.id === tabs.activePane) return activePage;
    const tab = pane.tabs.find((t) => t.id === pane.active);
    const shown = tab?.visits[tab.index];
    if (!shown) return <p className="empty pane-empty">Click here, then open a page from the sidebar or Ctrl+K.</p>;
    if (isView(shown.page)) {
      const Shown = registry.view(viewId(shown.page))?.component;
      return Shown ? <Shown app={app} options={shown.options ?? {}} /> : null;
    }
    const node = tree.items.get(registry.hostOf(tree, shown.page) ?? shown.page) ?? (shown.options?.fromTrash ? tree.byId.get(shown.page) : undefined);
    const Page = node && registry.pageView(node.kind)?.component;
    if (!node || !Page) return <p className="empty pane-empty">This page is gone.</p>;
    return (
      <Safe key={`${pane.id}:${node.id}:${version}`} name="This page">
        <Page node={node} app={app} tree={tree} workspaceDoc={doc} hub={hub} onSelect={select} onStatus={ignore} onReady={ignore} />
      </Safe>
    );
  };
  const renderSplit = (part: Split, path: number[]): ReactNode => {
    if ("pane" in part) {
      const pane = tabs.panes.find((p) => p.id === part.pane);
      return pane ? <PaneBox key={pane.id} pane={pane} app={app} active={pane.id === tabs.activePane} showTabs={multi} page={pageOf(pane)} /> : null;
    }
    const sizes = part.sizes ?? part.parts.map(() => 1);
    return (
      <div className={`split split-${part.dir}`}>
        {part.parts.map((child, i) => (
          <Fragment key={"pane" in child ? child.pane : `split-${i}`}>
            {i > 0 && <SplitDivider path={path} index={i} dir={part.dir} sizes={sizes} />}
            <div className="split-part" style={{ flexGrow: sizes[i] }}>
              {renderSplit(child, [...path, i])}
            </div>
          </Fragment>
        ))}
      </div>
    );
  };
  const showRight = sidePanelOpen && !focusMode;
  const sidebarCommand = registry.allCommands().find((command) => command.id === "sidebar.toggle");
  const sidebarKeys = sidebarCommand ? shortcutFor(sidebarCommand, overrides) : "";
  const quickCommand = registry.allCommands().find((command) => command.id === "settings.quick");
  const quickKeys = quickCommand ? shortcutFor(quickCommand, overrides) : "";
  const rightCommand = registry.allCommands().find((command) => command.id === "sidebar.toggle-right");
  const rightKeys = rightCommand ? shortcutFor(rightCommand, overrides) : "";

  return (
    <div
      ref={frame}
      className="app"
      data-sidebar={showLeft ? "open" : "closed"}
      data-side-panel={showRight ? "open" : "closed"}
      data-focus={focusMode || undefined}
      data-calm={calm || undefined}
      style={{ "--sidebar-width": `${leftWidth}px`, "--side-panel-width": `${rightWidth}px` } as CSSProperties}
    >
      {leftMounted && <Sidebar key={version} app={app} />}
      {showLeft && (
        <ResizeHandle side="left" label="Resize sidebar" size={SIDEBAR} width={sidebarWidth} cssVar="--sidebar-width" onCollapse={() => setSidebarOpen(false)} />
      )}
      <main className="main">
        <div className="main-top">
        <button
          className="icon-button sidebar-toggle"
          aria-label={showLeft ? "Hide sidebar" : "Show sidebar"}
          title={`${showLeft ? "Hide" : "Show"} sidebar${sidebarKeys ? ` (${formatShortcut(sidebarKeys)})` : ""}`}
          onClick={app.toggleSidebar}
        >
          <Icon name="sidebar" />
        </button>
        {multi ? <div className="main-top-space" /> : <TabStrip app={app} pane={tabs.panes.find((pane) => pane.id === tabs.activePane)!} />}
        {/* Phones have no Ctrl+K, so search gets a button there. */}
        <button className="icon-button phone-only" aria-label="Search" title="Search" onClick={app.openPalette}>
          <Icon name="search" />
        </button>
        <div className="page-toolbar">
          {activeNode &&
            registry.pageCorner(activeNode.kind).map(({ id, component: Corner }) => (
              <Safe key={id} name={id}>
                <Corner node={activeNode} app={app} />
              </Safe>
            ))}
          {!narrow && (
            <button
              className="icon-button layout-button"
              aria-label="Split view layout"
              aria-haspopup="menu"
              title="Split view: one to four panes"
              onClick={contextMenuHandler(() => ({ type: "layout" }))}
            >
              <Icon name="layout" />
            </button>
          )}
          <button
            className="icon-button quick-settings-button"
            aria-label="Quick settings"
            aria-expanded={quickOpen}
            title={`Quick settings${quickKeys ? ` (${formatShortcut(quickKeys)})` : ""}`}
            onClick={app.toggleQuickSettings}
          >
            <Icon name="settings" />
          </button>
          <button
            className="icon-button side-panel-toggle"
            aria-label={`${showRight ? "Hide" : "Show"} right sidebar`}
            title={`${showRight ? "Hide" : "Show"} right sidebar${rightKeys ? ` (${formatShortcut(rightKeys)})` : ""}`}
            onClick={app.toggleSidePanel}
          >
            <Icon name="side-panel" />
          </button>
          {quickOpen && <QuickSettings app={app} onClose={closeQuick} />}
        </div>
        </div>
        {narrow ? <div className="page-scroll">{activePage}</div> : renderSplit(split, [])}
      </main>
      <RightSidebar app={app} panels={panels} all={registry.allSidePanels()} open={showRight} />
      {/* Phones only (CSS): a tap beside an open side closes it. */}
      {(showLeft || showRight) && (
        <div
          className="scrim"
          aria-hidden="true"
          onClick={() => {
            setSidebarOpen(false);
            setSidePanelOpen(false);
          }}
        />
      )}
      {showRight && (
        <ResizeHandle
          side="right"
          label="Resize right sidebar"
          size={SIDE_PANEL}
          width={sidePanelWidth}
          cssVar="--side-panel-width"
          onCollapse={() => setSidePanelOpen(false)}
        />
      )}
      {settingsOpen && <Settings app={app} persistent={persistent} accountError={accountError} initialSection={settingsSection} onClose={() => setSettingsOpen(false)} />}
      {paletteOpen && <Palette app={app} onClose={() => setPaletteOpen(false)} />}
      {shortcutsOpen && (
        <ShortcutsHelp
          onClose={() => setShortcutsOpen(false)}
          onCustomize={() => {
            setShortcutsOpen(false);
            app.openSettings("shortcuts");
          }}
        />
      )}
      {OverlayView && (
        <Safe name={overlay!.id}>
          <OverlayView app={app} options={overlay!.options} onClose={() => setOverlay(null)} />
        </Safe>
      )}
      <ContextMenuHost app={app} />
      <PromptHost />
      <Toasts />
      <StatusBar app={app} workspaceStatus={workspace.status} words={activeNode?.kind === "note" ? activeNode.words : null} persistent={persistent} />
    </div>
  );
}

/**
 * A page no plugin can open: its plugin is switched off, or its kind was
 * removed from Notemax (like the old mind maps). The page itself is kept.
 */
function PluginOff({ node, app }: { node: TreeNode; app: AppContext }) {
  const plugin = registry.pluginFor(node.kind);
  if (!plugin) {
    return (
      <div className="plugin-off">
        <p>This page is a kind Notemax no longer has ({node.kind}), so it cannot be opened. Its data is kept as it was.</p>
        <button className="button" onClick={() => app.trash(node.id)}>
          Move to trash
        </button>
      </div>
    );
  }
  return (
    <div className="plugin-off">
      <p>
        This page is a {node.kind}. The {plugin.name} plugin that opens it is off.
      </p>
      <button className="button" onClick={() => setPluginOn(plugin.id, true)}>
        Turn on {plugin.name}
      </button>
    </div>
  );
}

const ignore = () => {};

const TAB_TYPE = "application/x-notemax-tab";

/** Which edge of a pane the pointer is near, or the middle. */
function edgeAt(event: DragEvent, box: DOMRect): Edge | "middle" {
  const x = (event.clientX - box.left) / box.width;
  const y = (event.clientY - box.top) / box.height;
  const near = Math.min(x, 1 - x, y, 1 - y);
  if (near > 0.25) return "middle";
  return near === x ? "left" : near === 1 - x ? "right" : near === y ? "top" : "bottom";
}

/**
 * One pane of the split view: its tabs, its page, and the places a dragged
 * tab can go. A tab dropped on an edge splits the pane there; in the middle,
 * it moves into this pane.
 */
function PaneBox({ pane, app, active, showTabs, page }: { pane: Pane; app: AppContext; active: boolean; showTabs: boolean; page: ReactNode }) {
  const [zone, setZone] = useState<Edge | "middle" | null>(null);
  // Tab strips take their own drops, to reorder.
  const isTab = (event: DragEvent) => event.dataTransfer.types.includes(TAB_TYPE) && !(event.target as Element).closest(".tab-strip");
  return (
    <section
      className="pane"
      data-active={active || undefined}
      aria-label={active ? "Active pane" : "Pane"}
      onPointerDownCapture={() => activatePane(pane.id)}
      // Capture, so a note's own drop handling never sees a tab being dragged.
      onDragOverCapture={(event) => {
        if (!isTab(event)) return;
        event.preventDefault();
        event.stopPropagation();
        // With four panes the edges take no more: a drop anywhere moves the tab into this pane.
        const next = canSplit() ? edgeAt(event, event.currentTarget.getBoundingClientRect()) : "middle";
        if (next !== zone) setZone(next);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setZone(null);
      }}
      onDropCapture={(event) => {
        if (!isTab(event)) return;
        event.preventDefault();
        event.stopPropagation();
        const where = canSplit() ? edgeAt(event, event.currentTarget.getBoundingClientRect()) : "middle";
        setZone(null);
        const tabId = event.dataTransfer.getData(TAB_TYPE);
        if (where === "middle") moveTabToPane(tabId, pane.id);
        else splitTab(tabId, pane.id, where);
      }}
    >
      {showTabs && (
        <div className="pane-top">
          <TabStrip app={app} pane={pane} />
          <button className="icon-button pane-close" aria-label="Close this pane" title="Close this pane" onClick={() => closePane(pane.id)}>
            <Icon name="close" />
          </button>
        </div>
      )}
      <div className="page-scroll">{page}</div>
      {zone && <div className="pane-drop" data-zone={zone} aria-hidden="true" />}
    </section>
  );
}
