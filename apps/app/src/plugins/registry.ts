import type { NodeKind } from "@notemax/core";
import type {
  AppContext,
  Command,
  EditorContext,
  KindInfo,
  PageAddon,
  PageView,
  Plugin,
  SettingsSection,
  SidebarFilter,
  SidebarSection,
  SidePanel,
  SlashItem,
} from "./types";

const plugins: Plugin[] = [];

/**
 * Plugins register once, before the first render, so readers below never need
 * to watch for changes. Loading plugins later, while the app runs, would need
 * a change event here.
 */
export function registerPlugin(plugin: Plugin) {
  if (plugins.some((p) => p.id === plugin.id)) throw new Error(`plugin "${plugin.id}" is already registered`);
  plugins.push(plugin);
}

const all = <T>(pick: (plugin: Plugin) => T[] | undefined): T[] => plugins.flatMap((plugin) => pick(plugin) ?? []);

export const registry = {
  plugins: (): readonly Plugin[] => plugins,
  editorExtensions: (ctx: EditorContext) => all((p) => p.editorExtensions?.(ctx)),
  slashItems: (): SlashItem[] => all((p) => p.slashItems),
  kinds: (): KindInfo[] => all((p) => p.kinds),
  pageView: (kind: NodeKind): PageView | undefined => all((p) => p.pageViews).find((view) => view.kind === kind),
  sidePanel: (app: AppContext): SidePanel | undefined => all((p) => p.sidePanels).find((panel) => panel.when(app)),
  settings: (): SettingsSection[] =>
    all((p) => p.settings)
      .filter((section) => section.when?.() ?? true)
      .sort((a, b) => a.order - b.order),
  commands: (app: AppContext): Command[] => all((p) => p.commands).filter((command) => command.when?.(app) ?? true),
  /** Every command, including ones hidden right now, for the shortcut settings. */
  allCommands: (): Command[] => all((p) => p.commands),
  pageHeader: (kind: NodeKind): PageAddon[] => all((p) => p.pageHeader).filter((addon) => addon.kinds?.includes(kind) ?? true),
  sidebarSections: (): SidebarSection[] => all((p) => p.sidebarSections).sort((a, b) => a.order - b.order),
  /** Hooks, so call this list in the same order on every render. */
  sidebarFilterHooks: (): (() => SidebarFilter | null)[] => all((p) => (p.useSidebarFilter ? [p.useSidebarFilter] : undefined)),
};
