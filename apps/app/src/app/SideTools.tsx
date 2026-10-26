import type { TreeNode } from "@notemax/core";
import { QuickSettings } from "@/features/settings/QuickSettings";
import { PageWorkspace } from "@/data/scope";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { contextMenuHandler } from "@/ui/ContextMenu";
import { Icon } from "@/ui/Icon";
import { Safe } from "@/ui/Safe";

/**
 * The row of tools at the top of the right sidebar: search, the open page's
 * own tools (word count, star, copy all, share, links), places like the
 * community, the split layout and settings. They live here rather than over
 * the page, so the top bar stays clear.
 */
export function SideTools({ app, node, split, quickOpen, onQuick, onCloseQuick }: { app: AppContext; node: TreeNode | undefined; split: boolean; quickOpen: boolean; onQuick(): void; onCloseQuick(): void }) {
  return (
    <div className="side-tools" role="toolbar" aria-label="Tools">
      <button className="icon-button side-tools-search" aria-label="Search" title="Search pages and commands (Ctrl+K)" onClick={app.openPalette}>
        <Icon name="search" />
      </button>
      {node &&
        registry
          .pageCorner(node.kind)
          .map(({ id, component: Tool }) => (
            <Safe key={id} name={id}>
              <PageWorkspace.Provider value={app.workspace}>
                <Tool node={node} app={app} />
              </PageWorkspace.Provider>
            </Safe>
          ))}
      {registry.switcherButtons().map((button) => (
        <button key={button.id} className="icon-button" aria-label={button.label} title={button.label} onClick={() => button.run(app)}>
          <Icon name={button.icon} />
        </button>
      ))}
      <span className="side-tools-space" />
      {split && (
        <button className="icon-button layout-button" aria-label="Split view layout" aria-haspopup="menu" title="Split view: one to four panes" onClick={contextMenuHandler(() => ({ type: "layout" }))}>
          <Icon name="layout" />
        </button>
      )}
      {/* One gear: quick choices, with All settings at their foot. */}
      <button className="icon-button quick-settings-button" aria-label="Quick settings" aria-expanded={quickOpen} title="Settings" onClick={onQuick}>
        <Icon name="gear" />
      </button>
      {quickOpen && <QuickSettings app={app} onClose={onCloseQuick} />}
    </div>
  );
}
