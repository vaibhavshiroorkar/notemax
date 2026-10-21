import { useEffect, useState } from "react";
import { isDesktop } from "@/platform/platform";
import type { SettingsContext } from "@/plugins/types";
import { getTheme, setTheme, type Theme } from "@/ui/theme";

const themes: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function AppearanceSection() {
  const [theme, setThemeState] = useState(getTheme);

  const chooseTheme = (next: Theme) => {
    setThemeState(next);
    setTheme(next);
  };

  return (
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
  );
}

// Must match DB_URL in apps/desktop/src-tauri/src/lib.rs. The SQL plugin keeps
// the file in the app's config folder.
const DB_FILE = "notemax.db";

async function databasePath(): Promise<string> {
  const { appConfigDir, join } = await import("@tauri-apps/api/path");
  return join(await appConfigDir(), DB_FILE);
}

export function StorageSection({ persistent }: SettingsContext) {
  const [dbPath, setDbPath] = useState<string>();

  useEffect(() => {
    if (isDesktop) databasePath().then(setDbPath, () => setDbPath(undefined));
  }, []);

  return (
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
  );
}
