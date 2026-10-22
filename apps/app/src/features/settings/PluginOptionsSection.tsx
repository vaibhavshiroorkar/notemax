import { useRef, useState } from "react";
import {
  MAX_PLUGIN_BYTES,
  communityOn,
  download,
  install,
  installed,
  loadErrors,
  safeMode,
  setCommunityOn,
  setInstalledOn,
  uninstall,
  type Installed,
} from "@/plugins/community";
import { pluginsVersion, registry, setPluginOn, switchedOff } from "@/plugins/registry";
import { ConfirmDialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";
import { OptionRow } from "./Settings";

const GUIDE = "https://github.com/vaibhavshiroorkar/notemax/blob/main/docs/plugins.md";

const WARNING =
  "A community plugin runs with the same access as Notemax. It can read and change all your notes and send them anywhere. Only install plugins from people you trust.";

/** A plugin file waiting for the user to say yes before it runs. */
type Pending = { code: string; source: string; label: string };

/**
 * Every plugin, with a switch. Built-in ones first, then community ones. Also
 * the options that belong to no other section.
 */
export function PluginOptionsSection() {
  pluginsVersion.use();
  const off = switchedOff.use();
  const allowCommunity = communityOn.use();
  const mine = installed.use();
  const errors = loadErrors.use();
  const [asking, setAsking] = useState<"turn-on" | Pending | null>(null);
  const [link, setLink] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const builtIn = registry.everyPlugin().filter((plugin) => !mine.some((entry) => entry.id === plugin.id));
  const loose = registry.options().filter(({ option }) => !option.section);

  const run = async (pending: Pending) => {
    setAsking(null);
    setBusy(true);
    setProblem(null);
    try {
      await install(pending.code, pending.source);
    } catch (error) {
      setProblem(`${pending.label}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const fromLink = async (address: string) => {
    setProblem(null);
    setBusy(true);
    try {
      const code = await download(address);
      setAsking({ code, source: address, label: address });
    } catch (error) {
      setProblem(`${address}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p>Everything in Notemax is a plugin. Switch off what you don't use; its pages stay safe and come back when you switch it on.</p>
      <h4 className="settings-subhead">Built in</h4>
      {builtIn.map((plugin) => (
        <label key={plugin.id} className="settings-row settings-check plugin-row">
          <span>
            {plugin.name}
            {plugin.description && <span className="settings-description">{plugin.description}</span>}
          </span>
          {plugin.required ? (
            <span className="plugin-always">Always on</span>
          ) : (
            <input type="checkbox" checked={!off.includes(plugin.id)} onChange={(event) => setPluginOn(plugin.id, event.target.checked)} />
          )}
        </label>
      ))}
      {loose.map(({ plugin, option }) => (
        <OptionRow key={`${plugin.id}.${option.id}`} plugin={plugin} option={option} />
      ))}

      <h4 className="settings-subhead">Community plugins</h4>
      <label className="settings-row settings-check">
        <span>
          Allow community plugins
          <span className="settings-description">Plugins other people made. They stay on this device and are never synced.</span>
        </span>
        <input type="checkbox" checked={allowCommunity} onChange={(event) => (event.target.checked ? setAsking("turn-on") : void setCommunityOn(false))} />
      </label>
      {safeMode && <p className="settings-note">Safe mode: community plugins are not loaded while the address ends in ?safe.</p>}

      {allowCommunity && (
        <div className="community">
          <div className="community-install">
            <button className="button" disabled={busy} onClick={() => file.current?.click()}>
              <Icon name="upload" />
              Install from a file
            </button>
            <input
              ref={file}
              type="file"
              accept=".js,.mjs,text/javascript"
              hidden
              onChange={async (event) => {
                const chosen = event.target.files?.[0];
                event.target.value = "";
                if (!chosen) return;
                if (chosen.size > MAX_PLUGIN_BYTES) return setProblem(`${chosen.name}: the file is bigger than ${MAX_PLUGIN_BYTES / 1024} KB.`);
                setAsking({ code: await chosen.text(), source: `file:${chosen.name}`, label: chosen.name });
              }}
            />
            <form
              className="community-link"
              onSubmit={(event) => {
                event.preventDefault();
                if (link.trim()) void fromLink(link.trim());
              }}
            >
              <input type="url" placeholder="https://.../plugin.js" aria-label="Plugin address" value={link} onChange={(event) => setLink(event.target.value)} />
              <button className="button" disabled={busy || !link.trim()}>
                Install
              </button>
            </form>
          </div>
          {problem && (
            <p className="settings-error" role="alert">
              {problem}
            </p>
          )}
          {mine.length === 0 ? (
            <p className="settings-note">
              None installed yet. To make one, see <a href={GUIDE} target="_blank" rel="noreferrer">how to write a plugin</a>.
            </p>
          ) : (
            mine.map((entry) => <CommunityRow key={entry.id} entry={entry} error={errors[entry.id]} onUpdate={fromLink} />)
          )}
        </div>
      )}

      {asking === "turn-on" && (
        <ConfirmDialog
          title="Allow community plugins?"
          message={WARNING}
          confirmLabel="Allow"
          onCancel={() => setAsking(null)}
          onConfirm={() => {
            setAsking(null);
            void setCommunityOn(true);
          }}
        />
      )}
      {asking && asking !== "turn-on" && (
        <ConfirmDialog
          title="Install this plugin?"
          message={
            <>
              <code className="settings-path">{asking.label}</code>
              <br />
              {WARNING}
            </>
          }
          confirmLabel="Install"
          onCancel={() => setAsking(null)}
          onConfirm={() => void run(asking)}
        />
      )}
    </>
  );
}

function CommunityRow({ entry, error, onUpdate }: { entry: Installed; error?: string; onUpdate(address: string): void }) {
  const [removing, setRemoving] = useState(false);
  const fromWeb = !entry.source.startsWith("file:");
  return (
    <div className="settings-row community-row" data-plugin={entry.id}>
      <span>
        {entry.name}
        {entry.version && <span className="plugin-version"> {entry.version}</span>}
        <span className="settings-description">
          {[entry.description, entry.author && `by ${entry.author}`].filter(Boolean).join(" ")}
          {entry.description || entry.author ? <br /> : null}
          {fromWeb ? entry.source : entry.source.slice(5)}
        </span>
        {error && <span className="settings-error">Did not load: {error}</span>}
      </span>
      <span className="community-actions">
        {fromWeb && (
          <button className="icon-button" aria-label={`Update ${entry.name}`} title="Update from its address" onClick={() => onUpdate(entry.source)}>
            <Icon name="download" />
          </button>
        )}
        <button className="icon-button" aria-label={`Remove ${entry.name}`} title="Remove" onClick={() => setRemoving(true)}>
          <Icon name="trash" />
        </button>
        <input type="checkbox" aria-label={`${entry.name} on`} checked={entry.on} onChange={(event) => void setInstalledOn(entry.id, event.target.checked)} />
      </span>
      {removing && (
        <ConfirmDialog
          title={`Remove ${entry.name}?`}
          message="Its file is deleted from this device. Anything it saved in your notes stays."
          confirmLabel="Remove"
          onCancel={() => setRemoving(false)}
          onConfirm={() => {
            setRemoving(false);
            uninstall(entry.id);
          }}
        />
      )}
    </div>
  );
}
