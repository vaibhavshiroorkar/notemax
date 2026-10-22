import { useState } from "react";
import { registry } from "@/plugins/registry";
import { formatShortcut, shortcutFor, shortcutOverrides } from "@/plugins/shortcuts";
import { Dialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";
import "./shortcuts.css";

/** "Ctrl+Shift+K" as separate keys. "Ctrl++" is Ctrl and the + key. */
function keyParts(keys: string): string[] {
  const shown = formatShortcut(keys);
  if (shown.endsWith("++")) return [...shown.slice(0, -2).split("+"), "+"];
  return shown.includes("+") && shown.length > 1 ? shown.split("+") : [shown];
}

function Keys({ keys }: { keys: string }) {
  return (
    <span className="keys">
      {keyParts(keys).map((key, i) => (
        <kbd key={i}>{key}</kbd>
      ))}
    </span>
  );
}

/**
 * Every shortcut in one list: the commands' (as the user set them) and the
 * keys plugins handle themselves, like Ctrl+B in the editor. Grouped by plugin.
 */
export function ShortcutsHelp({ onClose, onCustomize }: { onClose(): void; onCustomize(): void }) {
  const overrides = shortcutOverrides.use();
  const [query, setQuery] = useState("");
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (text: string) => terms.every((word) => text.toLowerCase().includes(word));

  const groups = registry
    .plugins()
    .map((plugin) => ({
      name: plugin.name,
      rows: [
        ...(plugin.commands ?? []).map((command) => ({ title: command.title, keys: shortcutFor(command, overrides) })),
        ...(plugin.shortcutHints ?? []),
      ].filter((row) => row.keys && matches(`${plugin.name} ${row.title} ${formatShortcut(row.keys)}`)),
    }))
    .filter((group) => group.rows.length);

  return (
    <Dialog label="Keyboard shortcuts" onClose={onClose} className="shortcuts-help">
      <header className="settings-header">
        <h2 className="dialog-title">Keyboard shortcuts</h2>
        <button className="icon-button" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <label className="settings-search">
        <Icon name="search" />
        <input type="search" placeholder="Search shortcuts" aria-label="Search shortcuts" data-autofocus value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="shortcuts-help-list">
        {groups.map((group) => (
          <section key={group.name}>
            <h3>{group.name}</h3>
            <ul>
              {group.rows.map((row) => (
                <li key={row.title} className="shortcut-help-row">
                  <span>{row.title}</span>
                  <Keys keys={row.keys} />
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!groups.length && <p className="settings-empty">No shortcuts match "{query.trim()}".</p>}
      </div>
      <footer className="shortcuts-help-footer">
        <button className="link-button" onClick={onCustomize}>
          Change shortcuts in Settings
        </button>
      </footer>
    </Dialog>
  );
}
