import { useRef } from "react";
import { registry } from "@/plugins/registry";
import { formatShortcut, shortcutFor } from "@/plugins/shortcuts";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { touchFirst } from "@/ui/layout";
import { QuickOptions, TextSizeRow, ThemeRow } from "./BasicRows";
import "./quick-settings.css";
import { useDismiss } from "@/ui/useDismiss";

const keysOf = (commandId: string) => {
  const command = registry.allCommands().find((c) => c.id === commandId);
  const keys = command ? shortcutFor(command) : "";
  // A phone has no keys to press.
  return keys && !touchFirst() ? ` (${formatShortcut(keys)})` : "";
};

/**
 * A small menu at the top right with the switches people flip often. Plugins
 * add to it by marking an option `quick`. Everything else is in Settings.
 */
export function QuickSettings({ app, onClose }: { app: AppContext; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);

  // The button that opens it toggles it, so a press there is not "outside".
  useDismiss(true, onClose, ref, ".quick-settings-button");

  const leave = (then: () => void) => () => {
    onClose();
    then();
  };

  return (
    <div className="quick-settings" ref={ref} role="dialog" aria-label="Quick settings">
      <ThemeRow />
      <TextSizeRow />
      <label className="settings-row settings-check">
        <span>Focus mode</span>
        <input type="checkbox" checked={app.focusMode} onChange={() => app.toggleFocusMode()} />
      </label>
      <QuickOptions />
      <footer className="quick-links">
        <button className="link-button" onClick={leave(() => app.openShortcuts())}>
          <Icon name="keyboard" />
          <span>All shortcuts{keysOf("shortcuts.help")}</span>
        </button>
        <button className="link-button" onClick={leave(() => app.openSettings())}>
          <Icon name="settings" />
          <span>All settings{keysOf("settings.open")}</span>
        </button>
      </footer>
    </div>
  );
}
