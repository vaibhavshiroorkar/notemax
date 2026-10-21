import { registry } from "@/plugins/registry";
import type { SettingsContext } from "@/plugins/types";
import { Dialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";
import "./settings.css";

/** The Settings dialog. Its sections come from plugins, in their `order`. */
export function Settings({ onClose, ...ctx }: SettingsContext & { onClose(): void }) {
  return (
    <Dialog label="Settings" onClose={onClose} className="settings">
      <header className="settings-header">
        <h2 className="dialog-title">Settings</h2>
        <button className="icon-button" aria-label="Close settings" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      {registry.settings().map(({ id, component: Section }) => (
        <Section key={id} {...ctx} />
      ))}
    </Dialog>
  );
}
