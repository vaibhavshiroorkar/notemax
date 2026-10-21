import { registry } from "@/plugins/registry";
import { setOption, useOption } from "@/plugins/options";
import type { Plugin, PluginOption } from "@/plugins/types";

function OptionRow({ plugin, option }: { plugin: Plugin; option: PluginOption }) {
  const on = useOption(plugin.id, option.id);
  return (
    <label className="settings-row settings-check">
      <span>{option.label}</span>
      <input type="checkbox" checked={on} onChange={(event) => setOption(plugin.id, option.id, event.target.checked)} />
    </label>
  );
}

/** The on or off choices every plugin offers, grouped under the plugin's name. */
export function PluginOptionsSection() {
  const plugins = registry.plugins().filter((plugin) => plugin.options?.length);
  if (!plugins.length) return null;
  return (
    <section className="settings-section">
      <h3>Plugins</h3>
      {plugins.map((plugin) => (
        <div key={plugin.id} className="plugin-options">
          <h4>{plugin.name}</h4>
          {plugin.options!.map((option) => (
            <OptionRow key={option.id} plugin={plugin} option={option} />
          ))}
        </div>
      ))}
    </section>
  );
}
