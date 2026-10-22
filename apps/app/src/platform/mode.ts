import { savedStore } from "./store";

export type Mode = "online" | "offline";

/**
 * Offline or online, chosen on first start. Offline switches off everything
 * that needs the internet or an account. Null until chosen, when everything
 * stays on. Kept per device: one computer can stay offline while a phone syncs.
 */
export const onlineMode = savedStore<Mode | null>("onlineMode", null, {
  decode: (raw) => (raw === "online" || raw === "offline" ? raw : null),
  encode: (value) => value ?? "",
});

/** Where a new window starts: the page open last time, Home with every workspace, or the start page (Settings, Special pages). */
export const startAt = savedStore<"last" | "home" | "page">("startAt", "last", {
  decode: (raw) => (raw === "home" || raw === "page" ? raw : "last"),
  encode: (value) => value,
});
