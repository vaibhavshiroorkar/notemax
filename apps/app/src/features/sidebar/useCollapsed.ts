import { useState } from "react";
import { getPref, setPref } from "@/platform/prefs";

function load(): Set<string> {
  try {
    return new Set(JSON.parse(getPref("collapsed") ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** Which folders and books are closed in the sidebar, remembered across restarts. */
export function useCollapsed() {
  const [collapsed, setCollapsed] = useState(load);

  const save = (next: Set<string>) => {
    setCollapsed(next);
    setPref("collapsed", JSON.stringify([...next]));
  };

  return {
    collapsed,
    toggle(id: string) {
      const next = new Set(collapsed);
      if (!next.delete(id)) next.add(id);
      save(next);
    },
    /** Opens a parent, so whatever was just added or dropped inside it is visible. */
    expand(id: string) {
      if (!collapsed.has(id)) return;
      const next = new Set(collapsed);
      next.delete(id);
      save(next);
    },
  };
}
