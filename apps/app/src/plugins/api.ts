import * as React from "react";
import * as core from "@notemax/core";
import { getStore } from "@/platform/platform";
import { ConfirmDialog, Dialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";
import { showToast } from "@/ui/toast";
import { getOption, setOption, useOption } from "./options";

/**
 * What a community plugin gets. Plugins are separate files, so they cannot
 * import the app's own modules; everything they may use comes through here.
 * Bump API_VERSION when something here changes in a way that breaks plugins.
 */
export const API_VERSION = 1;

export const pluginApi = Object.freeze({
  apiVersion: API_VERSION,
  /** The app's own React. A plugin must draw with this one, never a copy of its own. */
  React,
  /** Workspace helpers: readTree, createNode, renameNode, addTag, buildGraph and more. */
  core,
  ui: { Icon, Dialog, ConfirmDialog },
  useOption,
  getOption,
  setOption,
  notify: showToast,
  /** A page's body as plain text, for plugins that count, search or export. */
  async pageText(id: string): Promise<string> {
    const local = await core.openLocalDoc(await getStore(), id, {});
    try {
      return core.plainText(local.doc.getXmlFragment("content"));
    } finally {
      await local.close();
    }
  },
});

export type PluginApi = typeof pluginApi;
