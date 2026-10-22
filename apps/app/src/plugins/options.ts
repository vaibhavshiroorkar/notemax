import { savedStore } from "@/platform/store";
import { registry } from "./registry";

/** On or off choices, by "pluginId.optionId". Only ones the user changed are kept. */
const values = savedStore<Record<string, boolean>>("options", {}, {
  decode(raw) {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not a map");
    return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === "boolean"));
  },
});

function defaultOf(pluginId: string, optionId: string): boolean {
  const option = registry.optionOf(pluginId, optionId);
  if (!option) throw new Error(`plugin "${pluginId}" has no option "${optionId}"`);
  return option.default;
}

export function getOption(pluginId: string, optionId: string, saved = values.get()): boolean {
  return saved[`${pluginId}.${optionId}`] ?? defaultOf(pluginId, optionId);
}

/** A React hook: the option's value, re-rendering when it changes. */
export function useOption(pluginId: string, optionId: string): boolean {
  return getOption(pluginId, optionId, values.use());
}

export function setOption(pluginId: string, optionId: string, value: boolean) {
  values.set({ ...values.get(), [`${pluginId}.${optionId}`]: value });
}
