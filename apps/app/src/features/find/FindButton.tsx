import { formatShortcut } from "@/plugins/shortcuts";
import { Icon } from "@/ui/Icon";
import { finding } from "./FindBar";

/** In the right sidebar's tools: find and replace without knowing the keys, as on a phone. */
export function FindButton() {
  const open = finding.use();
  return (
    <button
      className="icon-button find-button"
      aria-label="Find and replace"
      aria-pressed={!!open}
      title={`Find and replace in this note (${formatShortcut("Mod+F")}, ${formatShortcut("Mod+H")})`}
      onClick={() => finding.set(open ? null : { replace: true })}
    >
      <Icon name="find-text" />
    </button>
  );
}
