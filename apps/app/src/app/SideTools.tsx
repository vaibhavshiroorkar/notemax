import type { TreeNode } from "@notemax/core";
import { QuickSettings } from "@/features/settings/QuickSettings";
import { PageWorkspace } from "@/data/scope";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { Safe } from "@/ui/Safe";

/**
 * The row of tools at the top of the right sidebar: search, the open page's
 * own tools (copy all, share), places like the community, and settings. They
 * live here rather than over the page, so the top bar stays clear.
 */
export function SideTools({ app, node, quickOpen, onQuick, onCloseQuick }: { app: AppContext; node: TreeNode | undefined; quickOpen: boolean; onQuick(): void; onCloseQuick(): void }) {
  return (
    <div className="side-tools" role="toolbar" aria-label="Tools">
      <button className="icon-button" aria-label="Search" title="Search pages and commands (Ctrl+K)" onClick={app.openPalette}>
        <Icon name="search" />
      </button>
      {node &&
        registry
          .pageCorner(node.kind)
          .filter((addon) => addon.side)
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
      <button className="icon-button quick-settings-button" aria-label="Quick settings" aria-expanded={quickOpen} title="Quick settings" onClick={onQuick}>
        <Icon name="settings" />
      </button>
      <button className="icon-button" aria-label="Settings" title="Settings (Ctrl+,)" onClick={() => app.openSettings()}>
        <Icon name="gear" />
      </button>
      {quickOpen && <QuickSettings app={app} onClose={onCloseQuick} />}
    </div>
  );
}
