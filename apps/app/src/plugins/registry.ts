import type { NodeKind, Tree, TreeNode } from "@notemax/core";
import { onlineMode } from "@/platform/mode";
import { createStore, savedStore } from "@/platform/store";
import type {
  AppContext,
  Command,
  ContextMenuItem,
  ContextTarget,
  EditorContext,
  Exporter,
  HomeSection,
  KindInfo,
  Overlay,
  PageAddon,
  PageView,
  Plugin,
  PluginOption,
  SettingsSection,
  SidebarFilter,
  RowMark,
  SidebarFilterChoice,
  SidebarFooterItem,
  SidebarSection,
  SwitcherButton,
  SidePanel,
  SlashItem,
  StatusItem,
  View,
} from "./types";
import type { IconName } from "@/ui/Icon";

const plugins: Plugin[] = [];

/** Built-in plugins the user switched off, by id. Community plugins keep their own on/off. */
export const switchedOff = savedStore<string[]>("pluginsOff", [], {
  decode(raw) {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) throw new Error("not a list");
    return value.filter((id): id is string => typeof id === "string");
  },
});

/**
 * Goes up whenever the set of plugins that are on changes: one is switched on
 * or off, or a community plugin loads. The app redraws on it, and parts that
 * read plugins only once (the editor, the sidebar's filter hooks) start over.
 */
export const pluginsVersion = createStore(0);
switchedOff.subscribe(() => {
  active = null;
  pluginsVersion.set(pluginsVersion.get() + 1);
});

let active: Plugin[] | null = null;
const changed = () => {
  active = null;
  pluginsVersion.set(pluginsVersion.get() + 1);
};

export function registerPlugin(plugin: Plugin) {
  if (plugins.some((p) => p.id === plugin.id)) throw new Error(`plugin "${plugin.id}" is already registered`);
  plugins.push(plugin);
  changed();
}

/** Takes a community plugin out again. Built-in ones are switched off instead. */
export function unregisterPlugin(id: string) {
  const i = plugins.findIndex((p) => p.id === id);
  if (i < 0) return;
  plugins.splice(i, 1);
  changed();
}

onlineMode.subscribe(changed);

function isOn(plugin: Plugin) {
  if (plugin.online && onlineMode.get() === "offline") return false;
  return plugin.required || !switchedOff.get().includes(plugin.id);
}

export function setPluginOn(id: string, on: boolean) {
  const rest = switchedOff.get().filter((other) => other !== id);
  switchedOff.set(on ? rest : [...rest, id]);
}

const on = (): Plugin[] => (active ??= plugins.filter(isOn));
const all = <T>(pick: (plugin: Plugin) => T[] | undefined): T[] => on().flatMap((plugin) => pick(plugin) ?? []);

export const registry = {
  /** The plugins that are on, in the order they registered. */
  plugins: (): readonly Plugin[] => on(),
  /** Every registered plugin, on or off. */
  everyPlugin: (): readonly Plugin[] => plugins,
  isOn: (id: string) => on().some((plugin) => plugin.id === id),
  /** The node and mark types a note can hold, from every plugin, on or off. */
  contentExtensions: (ctx: EditorContext) => plugins.flatMap((p) => p.contentExtensions?.({ ...ctx, on: false }) ?? []),
  editorExtensions: (ctx: EditorContext) => [
    ...plugins.flatMap((p) => p.contentExtensions?.({ ...ctx, on: isOn(p) }) ?? []),
    ...all((p) => p.editorExtensions?.(ctx)),
  ],
  slashItems: (): SlashItem[] => all((p) => p.slashItems),
  kinds: (): KindInfo[] => all((p) => p.kinds),
  /** The icon a kind shows in lists. Taken from plugins that are off too, since their pages still show. */
  iconOf: (kind: NodeKind): IconName => plugins.flatMap((p) => p.kinds ?? []).find((info) => info.kind === kind)?.icon ?? "note",
  /** Why a page takes no edits, if a plugin says it takes none. */
  lockOf(node: TreeNode): string | undefined {
    for (const plugin of on()) {
      const reason = plugin.lockPage?.(node);
      if (reason) return reason;
    }
    return undefined;
  },
  /** The page that shows this one inside it, if a plugin says so. */
  hostOf(tree: Tree, id: string): string | undefined {
    for (const plugin of on()) {
      const host = plugin.hostOf?.(tree, id);
      if (host) return host;
    }
    return undefined;
  },
  pageView: (kind: NodeKind): PageView | undefined => all((p) => p.pageViews).find((view) => view.kind === kind),
  /** The switched-off plugin that would open this kind, so the page can offer to switch it on. */
  pluginFor: (kind: NodeKind): Plugin | undefined => plugins.find((p) => p.pageViews?.some((view) => view.kind === kind)),
  /** The right sidebar's sections that apply right now, top first. */
  /** Every section of the plugins that are on, wanted on this page or not, for the list that turns them on and off. */
  allSidePanels: (): SidePanel[] => all((p) => p.sidePanels).sort((a, b) => a.order - b.order),
  sidePanels: (app: AppContext): SidePanel[] =>
    all((p) => p.sidePanels)
      .filter((panel) => panel.when?.(app) ?? true)
      .sort((a, b) => a.order - b.order),
  settings: (): SettingsSection[] =>
    all((p) => p.settings)
      .filter((section) => section.when?.() ?? true)
      .sort((a, b) => a.order - b.order),
  commands: (app: AppContext): Command[] => all((p) => p.commands).filter((command) => command.when?.(app) ?? true),
  /** Every command of the plugins that are on, including ones hidden right now, for the shortcut settings. */
  allCommands: (): Command[] => all((p) => p.commands),
  pageHeader: (kind: NodeKind): PageAddon[] => all((p) => p.pageHeader).filter((addon) => addon.kinds?.includes(kind) ?? true),
  pageFooter: (kind: NodeKind): PageAddon[] => all((p) => p.pageFooter).filter((addon) => addon.kinds?.includes(kind) ?? true),
  overlay: (id: string): Overlay | undefined => all((p) => p.overlays).find((overlay) => overlay.id === id),
  view: (id: string): View | undefined => all((p) => p.views).find((view) => view.id === id),
  statusItems: (): StatusItem[] => all((p) => p.statusItems),
  sidebarFooter: (): SidebarFooterItem[] => all((p) => p.sidebarFooter),
  rowMarks: (): RowMark[] => all((p) => p.rowMarks),
  sidebarFilterChoices: (): SidebarFilterChoice[] => all((p) => p.sidebarFilterChoices),
  starters: () => all((p) => (p.start ? [p.start.bind(p)] : [])),
  workspaceStarters: () => all((p) => (p.workspaceStart ? [p.workspaceStart.bind(p)] : [])),
  pageCorner: (kind: NodeKind): PageAddon[] => all((p) => p.pageCorner).filter((addon) => addon.kinds?.includes(kind) ?? true),
  pageSettings: (kind: NodeKind): PageAddon[] => all((p) => p.pageSettings).filter((addon) => addon.kinds?.includes(kind) ?? true),
  /** Every option of the plugins that are on, with its plugin, in plugin order. */
  options: (): { plugin: Plugin; option: PluginOption }[] => on().flatMap((plugin) => (plugin.options ?? []).map((option) => ({ plugin, option }))),
  /** An option's plugin even when it is off, so reading its value never fails. */
  optionOf: (pluginId: string, optionId: string): PluginOption | undefined => plugins.find((p) => p.id === pluginId)?.options?.find((o) => o.id === optionId),
  sidebarSections: (): SidebarSection[] => all((p) => p.sidebarSections).sort((a, b) => a.order - b.order),
  homeSections: (): HomeSection[] => all((p) => p.homeSections).sort((a, b) => a.order - b.order),
  switcherButtons: (): SwitcherButton[] => all((p) => p.switcherButtons).filter((button) => button.when?.() ?? true),
  /** Hooks: the sidebar starts over when this list changes, so they are always called in the same order. */
  sidebarFilterHooks: (): (() => SidebarFilter | null)[] => all((p) => (p.useSidebarFilter ? [p.useSidebarFilter] : undefined)),
  /** What a right click on this thing offers, from every plugin, in groups. */
  contextMenu: (target: ContextTarget, app: AppContext): ContextMenuItem[] =>
    all((p) => p.contextMenu).filter((item) => item.targets.includes(target.type) && (item.when?.(target, app) ?? true)),
  /** Download formats, for one kind of page. */
  exporters: (kind: NodeKind): Exporter[] => all((p) => p.exporters).filter((exporter) => exporter.kinds.includes(kind)),
};
