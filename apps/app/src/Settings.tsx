import { useEffect, useState } from "react";
import { AccountSection } from "./account/Account";
import { accountsEnabled } from "./account/config";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { isDesktop } from "./platform";
import { getTheme, setTheme, type Theme } from "./theme";

const themes: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

// Must match DB_URL in apps/desktop/src-tauri/src/lib.rs. The SQL plugin keeps
// the file in the app's config folder.
const DB_FILE = "notemax.db";

async function databasePath(): Promise<string> {
  const { appConfigDir, join } = await import("@tauri-apps/api/path");
  return join(await appConfigDir(), DB_FILE);
}

export function Settings({ persistent, accountError, onClose }: { persistent?: boolean; accountError?: string; onClose(): void }) {
  const [theme, setThemeState] = useState(getTheme);
  const [dbPath, setDbPath] = useState<string>();

  useEffect(() => {
    if (isDesktop) databasePath().then(setDbPath, () => setDbPath(undefined));
  }, []);

  const chooseTheme = (next: Theme) => {
    setThemeState(next);
    setTheme(next);
  };

  return (
    <Dialog label="Settings" onClose={onClose} className="settings">
      <header className="settings-header">
        <h2 className="dialog-title">Settings</h2>
        <button className="icon-button" aria-label="Close settings" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>

      <section className="settings-section">
        <h3>Appearance</h3>
        <div className="segmented" role="radiogroup" aria-label="Theme">
          {themes.map(({ value, label }) => (
            <button key={value} role="radio" aria-checked={theme === value} onClick={() => chooseTheme(value)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {accountsEnabled && <AccountSection initialError={accountError} />}

      {isDesktop && (
        <section className="settings-section">
          <h3>Quick capture</h3>
          <p>
            Press <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>N</kbd> in any app to write a quick note. It is added to your notes.
          </p>
        </section>
      )}

      <section className="settings-section">
        <h3>Storage</h3>
        {isDesktop ? (
          <>
            <p>Your notes are saved in one file on this computer. Nothing leaves it.</p>
            {dbPath && <code className="settings-path">{dbPath}</code>}
          </>
        ) : (
          <>
            <p>Your notes are saved in this browser on this device. Nothing leaves it.</p>
            {persistent === false && (
              <p className="warning">
                The browser has not promised to keep them. It may clear them if disk space runs low. The desktop app does not have this limit.
              </p>
            )}
          </>
        )}
      </section>
    </Dialog>
  );
}
