import { SETTINGS_DOC_ID, openLocalDoc } from "@notemax/core";
import { WORKSPACES_CHANNEL, getSharedStore } from "./platform";
import { SYNCED_PREFS, getPref, receivePref, sendPrefsTo } from "./prefs";

/** Changes made in this window, which it already shows. */
const HERE = "notemax:settings-here";

/**
 * Keeps the settings that follow the person in a doc of their own, which sync
 * carries to every device like a page. A setting changed here goes into the
 * doc; one changed on another device comes out of it and takes effect at once.
 */
export async function startSettingsSync() {
  // Docs outside every workspace hear about edits from other windows and from sync on this channel.
  const local = await openLocalDoc(await getSharedStore(), SETTINGS_DOC_ID, { broadcast: WORKSPACES_CHANNEL });
  const prefs = local.doc.getMap<string>("prefs");
  // What this device set goes in where no device has set it yet. Everything
  // else comes out, so a new device starts with the settings already made.
  local.doc.transact(() => {
    for (const key of SYNCED_PREFS) {
      const here = getPref(key);
      if (here !== null && !prefs.has(key)) prefs.set(key, here);
    }
  }, HERE);
  for (const [key, value] of prefs.entries()) if (SYNCED_PREFS.has(key) && value !== getPref(key)) receivePref(key, value);
  prefs.observe((event, transaction) => {
    if (transaction.origin === HERE) return;
    for (const key of event.keysChanged) if (SYNCED_PREFS.has(key)) receivePref(key, prefs.get(key) ?? null);
  });
  sendPrefsTo((key, value) => local.doc.transact(() => (value === null ? prefs.delete(key) : prefs.set(key, value)), HERE));
}
