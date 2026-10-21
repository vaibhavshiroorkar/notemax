import type { ComponentType } from "react";
import type { AnyExtension, ChainedCommands } from "@tiptap/core";
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
  editorExtensions?(ctx: EditorContext): AnyExtension[];
  slashItems?: SlashItem[];
  commands?: Command[];
  kinds?: KindInfo[];
  pageViews?: PageView[];
  sidePanels?: SidePanel[];
  /** Shown under the title of a note or book page, like its tags. */
  pageHeader?: PageAddon[];
  /** Extra sections in the left sidebar, between the notes and the trash. */
  sidebarSections?: SidebarSection[];
  /**
   * A React hook. While it returns a filter, the sidebar lists only the items
   * that pass it. It is called on every sidebar render.
   */
  useSidebarFilter?(): SidebarFilter | null;
  settings?: SettingsSection[];
  /** On or off choices, shown in Settings under the plugin's name. Read them with useOption. */
  options?: PluginOption[];
}

/** The open workspace and the actions any command or panel may take on it. */
export interface AppContext {
  tree: Tree;
  doc: Y.Doc;
  activeId: string | null;
  open(id: string): void;
  /** Adds a note, book or folder at the top level and opens it. */
  create(kind: NodeKind): void;
  /** Moves an item to the trash and offers Undo for a few seconds. */
  trash(id: string): void;
  /** A short message at the bottom of the window, with an optional button. */
  notify(message: string, action?: { label: string; run(): void }): void;
  /** Back and forward through opened pages, like a browser. */
  canGoBack: boolean;
  canGoForward: boolean;
  goBack(): void;
  goForward(): void;
  /** Only the page shows: both sidebars and the status bar are hidden. */
  focusMode: boolean;
  toggleFocusMode(): void;
  toggleSidebar(): void;
  showSidebar(): void;
  toggleSidePanel(): void;
  openSettings(): void;
  openPalette(): void;
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

/** A sidebar on the right. The first one whose `when` is true is shown. */
export interface SidePanel {
  id: string;
  /** Used in the show and hide button, like "chapters". */
  title: string;
  when(app: AppContext): boolean;
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
  /** Sections are sorted by this, low first. */
  order: number;
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
}

export interface SettingsContext {
  /** Whether the browser promised to keep local data. Unknown until it answers. */
  persistent?: boolean;
  accountError?: string;
}

export interface SettingsSection {
  id: string;
  /** Sections are sorted by this, low first. Built-ins use steps of 10. */
  order: number;
  when?(): boolean;
  component: ComponentType<SettingsContext>;
}
