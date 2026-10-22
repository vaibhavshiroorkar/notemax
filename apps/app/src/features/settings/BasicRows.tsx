import { useId } from "react";
import { registry } from "@/plugins/registry";
import { FontPicker } from "@/features/appearance/FontPicker";
import { TEXT_SIZE, clampTextSize, textSize, theme, type Theme } from "@/ui/appearance";
import { Segmented } from "@/ui/Segmented";
import { OptionRow } from "./Settings";

// The few settings most people change, shared by quick settings and the Basics
// page at the front of Settings, so both always offer the same thing.

const themes: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemeRow() {
  return (
    <div className="settings-row">
      <span>Theme</span>
      <Segmented label="Theme" value={theme.use()} options={themes} onChange={theme.set} />
    </div>
  );
}

export function FontRow() {
  return (
    <div className="settings-row">
      <span>Font</span>
      <FontPicker />
    </div>
  );
}

export function TextSizeRow() {
  const size = textSize.use();
  return (
    <div className="settings-row">
      <span>Text size</span>
      <span className="quick-size">
        <button className="icon-button" aria-label="Smaller text" disabled={size <= TEXT_SIZE.min} onClick={() => textSize.set(clampTextSize(size - 1))}>
          -
        </button>
        <output aria-label="Text size">{size}</output>
        <button className="icon-button" aria-label="Bigger text" disabled={size >= TEXT_SIZE.max} onClick={() => textSize.set(clampTextSize(size + 1))}>
          +
        </button>
      </span>
    </div>
  );
}

/** The text size as a slider, for Settings. Quick settings keeps the smaller - and + buttons. */
export function TextSizeSlider() {
  const size = textSize.use();
  // Basics and Appearance can both show at once while searching, so each needs its own id.
  const id = useId();
  return (
    <div className="settings-row">
      <label htmlFor={id}>Text size</label>
      <span className="text-size">
        <input id={id} type="range" min={TEXT_SIZE.min} max={TEXT_SIZE.max} step={1} value={size} onChange={(event) => textSize.set(Number(event.target.value))} />
        <output htmlFor={id}>{size} px</output>
      </span>
    </div>
  );
}

/** Every switch a plugin marked `quick`. */
export function QuickOptions() {
  return (
    <>
      {registry
        .options()
        .filter(({ option }) => option.quick)
        .map(({ plugin, option }) => (
          <OptionRow key={`${plugin.id}.${option.id}`} plugin={plugin} option={option} />
        ))}
    </>
  );
}

/** The first page of Settings. Everything here is also in a category, with more next to it. */
export function BasicsSection() {
  return (
    <>
      <p>The settings most people change. Every category on the left has these and more.</p>
      <ThemeRow />
      <FontRow />
      <TextSizeSlider />
      <QuickOptions />
    </>
  );
}
