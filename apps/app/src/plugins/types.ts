import type { ComponentType } from "react";
import type { AnyExtension, ChainedCommands, Editor } from "@tiptap/core";
import type * as Y from "yjs";
import type { NodeKind, SaveStatus, Tree, TreeNode } from "@notemax/core";
import type { LinkHub } from "@/features/links/link-hub";
import type { IconName } from "@/ui/Icon";

/**
 * Everything a feature can add to Notemax. Built-in features use the same
 * shape as community plugins will, so the app has no special cases for its own
 * parts. Every field is optional: a plugin fills in only what it adds.
 */
export interface Plugin {
  /** Unique and stable, like "books" or "someone.word-goals". */
  id: string;
  name: string;
  /** One line for the plugin list in Settings. */
  description?: string;
  /** Parts the app cannot work without. Settings shows them as always on. */
  required?: boolean;
  /** Community plugins: who made it and which version this is. */
  author?: string;
  version?: string;
  editorExtensions?(ctx: EditorContext): AnyExtension[];
  /**
   * Node and mark types a note can hold, like links. Loaded even while the
   * plugin is off, so switching a plugin off never drops what it put in a
   * note. `ctx.on` says whether the plugin is on, to leave out its menus.
   */
  contentExtensions?(ctx: EditorContext & { on: boolean }): AnyExtension[];
  slashItems?: SlashItem[];
  commands?: Command[];
  kinds?: KindInfo[];
  pageViews?: PageView[];
  sidePanels?: SidePanel[];
  /** Shown under the title of a note or book page, like its tags. */
  pageHeader?: PageAddon[];
  /** Extra sections in the left sidebar: between the notes and the trash, or above the notes with an order below 0. */
  sidebarSections?: SidebarSection[];
  /**
   * A React hook. While it returns a filter, the sidebar lists only the items
   * that pass it. It is called on every sidebar render.
   */
  useSidebarFilter?(): SidebarFilter | null;
  /** Small marks at the end of a page's row in the left sidebar, like "temporary". */
  rowMarks?: RowMark[];
  /** Choices in the sidebar's filter panel (the funnel by +), like "Starred only" or the tags. */
  sidebarFilterChoices?: SidebarFilterChoice[];
  /** Shown at the end of a page, like the notes that link to it. */
  pageFooter?: PageAddon[];
  /** Small things at the top right of a page, like a book's word count. */
  pageCorner?: PageAddon[];
  /** Rows in the right sidebar's "This page" section, like a note's layout. */
  pageSettings?: PageAddon[];
  settings?: SettingsSection[];
  /** On or off choices, shown in Settings. Read them with useOption. */
  options?: PluginOption[];
  /** Keys the plugin handles itself, listed with the command shortcuts. */
  shortcutHints?: ShortcutHint[];
  /** Views that cover the window. Open one with app.openOverlay. */
  overlays?: Overlay[];
  /** Pages of their own that are not in the sidebar, like the graph. They open in a tab with app.openView. */
  views?: View[];
  /** What a right click offers, on a page row, in a note, and so on. */
  contextMenu?: ContextMenuItem[];
  /** Ways to download a page, like Markdown or PDF. */
  exporters?: Exporter[];
  /** Small things in the status bar at the bottom, like how sync is going. */
  statusItems?: StatusItem[];
  /** The bar at the bottom of the left sidebar, beside the Settings cog, like the account and sync. */
  sidebarFooter?: SidebarFooterItem[];
  /** Runs once when the main window has opened the workspace, like starting sync. */
  start?(app: AppContext): void;
}

export interface SidebarFooterItem {
  id: string;
  component: ComponentType<{ app: AppContext }>;
}

export interface StatusItem {
  id: string;
  component: ComponentType<{ app: AppContext }>;
}

/** A page that is not a node of the tree. It opens in a tab and has its own Back entry. */
export interface View {
  id: string;
  /** The tab's title. */
  title: string;
  icon: IconName;
  component: ComponentType<{ app: AppContext; options: Record<string, unknown> }>;
}

export interface Overlay {
  id: string;
  component: ComponentType<{ app: AppContext; options: Record<string, unknown>; onClose(): void }>;
}

/** The open workspace and the actions any command or panel may take on it. */
export interface AppContext {
  tree: Tree;
  doc: Y.Doc;
  /** Opens links and says where a page sits, like "Folder / Book". */
  hub: LinkHub;
  /** The page of the tree that is open, or null for a new tab or a view. */
  activeId: string | null;
  /** Opens a page in this tab, or in a new tab next to it. */
  open(id: string, where?: { newTab?: boolean }): void;
  /** Opens a plugin's view, like the graph, as a page. */
  openView(id: string, options?: Record<string, unknown>, where?: { newTab?: boolean }): void;
  /** Adds a note, book or folder at the top level and opens it. */
  create(kind: NodeKind): void;
  /** Moves one item or several to the trash and offers Undo for a few seconds. */
  trash(ids: string | readonly string[]): void;
  /** A short message at the bottom of the window, with an optional button. */
  notify(message: string, action?: { label: string; run(): void }): void;
  /** Back and forward through opened pages, like a browser. */
  canGoBack: boolean;
  canGoForward: boolean;
  goBack(): void;
  goForward(): void;
  newTab(): void;
  closeTab(): void;
  reopenClosedTab(): void;
  /** The next tab (1) or the one before (-1). */
  cycleTab(step: 1 | -1): void;
  /** Only the page shows: both sidebars and the status bar are hidden. */
  focusMode: boolean;
  toggleFocusMode(): void;
  toggleSidebar(): void;
  showSidebar(): void;
  toggleSidePanel(): void;
  /** Opens Settings, at one section if given, like "shortcuts". */
  openSettings(section?: string): void;
  openPalette(): void;
  /** The list of every keyboard shortcut. */
  openShortcuts(): void;
  /** The small menu of switches at the top right. */
  toggleQuickSettings(): void;
  /** Opens a plugin's full-window view by id, with options for it. */
  openOverlay(id: string, options?: Record<string, unknown>): void;
}

export interface Command {
  id: string;
  title: string;
  keywords?: string[];
  /**
   * The default, like "Mod+K". Mod is Ctrl on Windows and Linux, and Cmd on
   * macOS. Users can change it in Settings, so read it with shortcutFor.
   */
  shortcut?: string;
  /** Hides the command when it makes no sense, like "Move to trash" with nothing open. */
  when?(app: AppContext): boolean;
  run(app: AppContext): void;
}

/** One entry in the menu that opens after typing / in a note. */
export interface SlashItem {
  title: string;
  /** The Markdown shortcut that does the same thing, so the menu teaches it. */
  hint: string;
  keywords: string[];
  apply(chain: ChainedCommands): ChainedCommands;
}

export interface EditorContext {
  noteId: string;
  hub: LinkHub;
}

/** How a kind shows up in the + menu. */
export interface KindInfo {
  kind: NodeKind;
  label: string;
  icon: IconName;
}

export interface PageProps {
  node: TreeNode;
  app: AppContext;
  tree: Tree;
  workspaceDoc: Y.Doc;
  hub: LinkHub;
  onSelect(id: string): void;
  onStatus(status: SaveStatus): void;
  onReady(): void;
}

/** The page shown in the middle when an item of this kind is open. */
export interface PageView {
  kind: NodeKind;
  component: ComponentType<PageProps>;
}

/**
 * A section of the right sidebar, like a book's chapters or the small graph.
 * Every section whose `when` is true shows, stacked by `order`, and each can
 * be folded by its title.
 */
export interface SidePanel {
  id: string;
  title: string;
  /** Low first. Built-ins use steps of 10. */
  order: number;
  when?(app: AppContext): boolean;
  component: ComponentType<{ app: AppContext }>;
}

export interface PageAddon {
  id: string;
  /** Kinds whose page shows it. All pages when left out. */
  kinds?: NodeKind[];
  component: ComponentType<{ node: TreeNode; app: AppContext }>;
}

export interface SidebarSection {
  id: string;
  /** Sections are sorted by this, low first. Below 0 they show above the notes, like Starred. */
  order: number;
  component: ComponentType<{ app: AppContext }>;
}

/** A small icon on a sidebar row. Keep `when` cheap: it runs for every row that redraws. */
export interface RowMark {
  id: string;
  icon: IconName;
  /** The tooltip and the words a screen reader says. */
  label: string;
  when(node: TreeNode): boolean;
}

export interface SidebarFilterChoice {
  id: string;
  component: ComponentType<{ app: AppContext }>;
}

export interface SidebarFilter {
  /** Says what is filtered, like "#poetry". */
  label: string;
  matches(node: TreeNode): boolean;
  clear(): void;
}

export interface PluginOption {
  id: string;
  label: string;
  default: boolean;
  /** A short line under the label. */
  description?: string;
  /** The Settings section that lists it, like "editor". Left out, it is listed under Plugins. */
  section?: string;
  /** Also a switch in the quick settings menu at the top right of the page. */
  quick?: boolean;
}

export interface SettingsContext {
  /** Whether the browser promised to keep local data. Unknown until it answers. */
  persistent?: boolean;
  accountError?: string;
}

/** One category in Settings, listed on the left. */
export interface SettingsSection {
  id: string;
  /** Sections are sorted by this, low first. Built-ins use steps of 10. */
  order: number;
  title: string;
  icon: IconName;
  /** More words that find this section in the settings search. The text of each setting is searched anyway. */
  keywords?: string[];
  when?(): boolean;
  /**
   * The section's own settings. Options that name this section are listed
   * after it, so a section made only of options can leave this out.
   */
  component?: ComponentType<SettingsContext>;
}

/** A key or key combination shown in the shortcut list, for keys the plugin handles itself (like Ctrl+B in the editor). */
export interface ShortcutHint {
  title: string;
  /** Written like a command's shortcut ("Mod+Shift+8"), or text the user types, like "[[". */
  keys: string;
}

/** What was right-clicked. */
export type ContextTarget =
  /** A page: its row in a sidebar, its title, or its dot in the graph. */
  | { type: "page"; node: TreeNode }
  /** Several rows picked with Ctrl+click or Shift+click, in the order the sidebar shows them. */
  | { type: "pages"; nodes: TreeNode[] }
  /** Inside a note. The editor's selection says what is under the pointer. */
  | { type: "editor"; editor: Editor; noteId: string }
  /** Empty space in the left sidebar. */
  | { type: "sidebar" }
  /** The format list that "Download this page as..." opens. */
  | { type: "download"; node: TreeNode }
  /** A tab above the page. */
  | { type: "tab"; tabId: string };

export interface ContextMenuItem {
  id: string;
  title: string;
  /**
   * Items with the same group sit together, with a line between groups. The
   * built-in groups (open, clipboard, create, edit, duplicate, format, block,
   * insert, link, image, tags, layout, share, select, danger) keep that order;
   * other groups follow in the order they first appear.
   */
  group: string;
  targets: ContextTarget["type"][];
  icon?: IconName;
  /** Shown on the right, written like a command's shortcut. */
  keys?: string;
  /** Drawn in red, for things like Move to trash. */
  danger?: boolean;
  when?(target: ContextTarget, app: AppContext): boolean;
  disabled?(target: ContextTarget, app: AppContext): boolean;
  /** A small menu that opens to the side, like the download formats. */
  submenu?(target: ContextTarget, app: AppContext): ContextMenuItem[];
  /** Stands for a list made when the menu opens, shown in its place, like one item per download format. */
  items?(target: ContextTarget, app: AppContext): ContextMenuItem[];
  run?(target: ContextTarget, app: AppContext): void;
}

/** One download format. */
export interface Exporter {
  id: string;
  /** Like "Markdown (.md)". */
  label: string;
  extension: string;
  kinds: NodeKind[];
  /**
   * Builds the file. Null means the exporter finished the job itself, like
   * PDF, which opens the print dialog. A .zip blob is saved as .zip whatever
   * the extension, for formats that need extra files (Markdown with pictures).
   */
  build(node: TreeNode, app: AppContext): Promise<Blob | null>;
}
