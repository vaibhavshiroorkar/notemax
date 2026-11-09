import { Segmented } from "@/ui/Segmented";
import { PAPER, paperSize, type PaperSize } from "./pages";
import { InfoTip } from "@/ui/InfoTip";

/** The Editor category's own rows. Its on and off options are listed after these. */
export function EditorSection() {
  return (
    <div className="settings-row">
      <span>
        Paper size
        <InfoTip label="About paper size">For notes shown as pages.</InfoTip>
      </span>
      <Segmented
        label="Paper size"
        value={paperSize.use()}
        options={(Object.keys(PAPER) as PaperSize[]).map((value) => ({ value, label: PAPER[value].label }))}
        onChange={paperSize.set}
      />
    </div>
  );
}
