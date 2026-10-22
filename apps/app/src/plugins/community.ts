import { getPref, setPref } from "@/platform/prefs";
import { createStore, savedStore } from "@/platform/store";
import { showToast } from "@/ui/toast";
import { pluginApi } from "./api";
import { registerPlugin, registry, unregisterPlugin } from "./registry";
import type { Plugin } from "./types";

/**
 * Community plugins: JavaScript files people write and share. They are kept on
 * this device only, never synced, so a plugin installed on one computer never
 * starts running on another by itself. Like Obsidian's, they run with the
 * same access as the app, which is why they stay off until the user turns
 * them on and every install asks first.
 */

export interface Installed {
  id: string;
  name: string;
  description?: string;
  author?: string;
  version?: string;
  /** "file:name.js" or the https address it came from, so it can be updated. */
  source: string;
  code: string;
  on: boolean;
}

/** The biggest plugin file kept. Plugins live in prefs, which hold a few MB in all. */
export const MAX_PLUGIN_BYTES = 512 * 1024;

export const communityOn = savedStore<boolean>("communityPlugins", false, { decode: (raw) => raw === "true", encode: String });

export const installed = savedStore<Installed[]>("communityInstalled", [], {
  decode(raw) {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) throw new Error("not a list");
    return value.filter((p): p is Installed => !!p && typeof p.id === "string" && typeof p.code === "string" && typeof p.name === "string");
  },
});

/** Why a plugin did not load, by id. */
export const loadErrors = createStore<Record<string, string>>({});
const setError = (id: string, error: string | null) => {
  const next = { ...loadErrors.get() };
  if (error === null) delete next[id];
  else next[id] = error;
  loadErrors.set(next);
};

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** `?safe` in the address starts the app with no community plugins, for when one breaks it. */
export const safeMode = new URLSearchParams(location.search).has("safe");

const ID = /^[a-z0-9][a-z0-9._-]{1,63}$/;

/** Runs a plugin file and checks what it gives back. */
async function evaluate(code: string): Promise<Plugin> {
  const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  let exported: unknown;
  try {
    const module = (await import(/* @vite-ignore */ url)) as { default?: unknown };
    exported = typeof module.default === "function" ? await module.default(pluginApi) : module.default;
  } finally {
    URL.revokeObjectURL(url);
  }
  const plugin = exported as Plugin | undefined;
  if (!plugin || typeof plugin !== "object") throw new Error("The file has no plugin. It should export one by default.");
  if (typeof plugin.id !== "string" || !ID.test(plugin.id)) throw new Error("The plugin's id must be lowercase letters, digits, dots or dashes, like \"someone.word-goals\".");
  if (typeof plugin.name !== "string" || !plugin.name.trim()) throw new Error("The plugin has no name.");
  // New kinds of pages need the core to know them, which community plugins cannot change yet.
  return { ...plugin, kinds: undefined, pageViews: undefined, required: false };
}

const builtinIds = () => new Set(registry.everyPlugin().filter((p) => !installed.get().some((i) => i.id === p.id)).map((p) => p.id));

async function start(entry: Installed) {
  try {
    const plugin = await evaluate(entry.code);
    if (plugin.id !== entry.id) throw new Error(`The file now says its id is "${plugin.id}", not "${entry.id}".`);
    unregisterPlugin(entry.id);
    registerPlugin(plugin);
    setError(entry.id, null);
  } catch (error) {
    setError(entry.id, message(error));
  }
}

/**
 * Loads the plugins that are on. If the app closed while this ran last time,
 * one of them may have frozen it, so this time they are skipped.
 */
export async function loadCommunityPlugins() {
  if (!communityOn.get() || safeMode) return;
  if (getPref("communityLoading") === "true") {
    setPref("communityLoading", "false");
    showToast("Community plugins were skipped: Notemax closed while loading them last time.", { label: "Load them", run: () => void loadCommunityPlugins() });
    return;
  }
  setPref("communityLoading", "true");
  for (const entry of installed.get()) if (entry.on) await start(entry);
  // A plugin that froze the app would never get here.
  setTimeout(() => setPref("communityLoading", "false"), 500);
}

export async function setCommunityOn(on: boolean) {
  communityOn.set(on);
  if (on) await loadCommunityPlugins();
  else for (const entry of installed.get()) unregisterPlugin(entry.id);
}

/** Runs the file, then keeps it. Throws with a readable message when it is not a plugin. */
export async function install(code: string, source: string): Promise<Installed> {
  if (new Blob([code]).size > MAX_PLUGIN_BYTES) throw new Error(`The file is bigger than ${MAX_PLUGIN_BYTES / 1024} KB.`);
  const plugin = await evaluate(code);
  if (builtinIds().has(plugin.id)) throw new Error(`"${plugin.id}" is the id of a built-in plugin.`);
  const entry: Installed = {
    id: plugin.id,
    name: plugin.name,
    description: plugin.description,
    author: plugin.author,
    version: plugin.version,
    source,
    code,
    on: true,
  };
  installed.set([...installed.get().filter((other) => other.id !== entry.id), entry]);
  // Prefs refuse quietly when full, so check that what was kept is what was asked.
  if (getPref("communityInstalled") !== JSON.stringify(installed.get())) {
    installed.set(installed.get().filter((other) => other.id !== entry.id));
    throw new Error("There is no room left to keep this plugin on this device.");
  }
  unregisterPlugin(entry.id);
  registerPlugin(plugin);
  setError(entry.id, null);
  return entry;
}

export async function setInstalledOn(id: string, on: boolean) {
  installed.set(installed.get().map((entry) => (entry.id === id ? { ...entry, on } : entry)));
  if (!on) {
    unregisterPlugin(id);
    setError(id, null);
    return;
  }
  const entry = installed.get().find((other) => other.id === id);
  if (entry) await start(entry);
}

export function uninstall(id: string) {
  unregisterPlugin(id);
  setError(id, null);
  installed.set(installed.get().filter((entry) => entry.id !== id));
}

/** Fetches a plugin file from the web. Only https, except a local dev server. */
export async function download(address: string): Promise<string> {
  const url = new URL(address);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) throw new Error("Use an https:// address.");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`The address answered ${response.status}.`);
  return response.text();
}
