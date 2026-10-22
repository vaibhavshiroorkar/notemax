import { useEffect, useRef } from "react";
import { registry } from "@/plugins/registry";
import { formatShortcut, shortcutFor } from "@/plugins/shortcuts";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { touchOnly } from "@/ui/longPress";
import { QuickOptions, TextSizeRow, ThemeRow } from "./BasicRows";
import "./quick-settings.css";

const keysOf = (commandId: string) => {
  const command = registry.allCommands().find((c) => c.id === commandId);
  const keys = command ? shortcutFor(command) : "";
  // A phone has no keys to press.
  return keys && !touchOnly() ? ` (${formatShortcut(keys)})` : "";
};

/**
 * A small menu at the top right with the switches people flip often. Plugins
 * add to it by marking an option `quick`. Everything else is in Settings.
 */
export function QuickSettings({ app, onClose }: { app: AppContext; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);

  // A click anywhere else or Esc closes it, like any menu.
  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!ref.current?.contains(target) && !target.closest?.(".quick-settings-button")) onClose();
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

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
