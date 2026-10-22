import type { CSSProperties } from "react";
import {
  ACCENTS,
  FONTS,
  PAGE_WIDTHS,
  PAGE_WIDTH_ORDER,
  accent,
  font,
  pageWidth,
  theme,
  type AccentName,
  type Font,
  type Theme,
} from "@/ui/appearance";
import { TextSizeSlider } from "@/features/settings/BasicRows";
import { Segmented } from "@/ui/Segmented";
import "./appearance.css";

const themes: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function AppearanceSection() {
  const currentAccent = accent.use();
  const custom = !(currentAccent in ACCENTS);

  return (
    <>
      <div className="settings-row">
        <span>Theme</span>
        <Segmented label="Theme" value={theme.use()} options={themes} onChange={theme.set} />
      </div>
      <div className="settings-row">
        <span>Accent color</span>
        <div className="swatches" role="radiogroup" aria-label="Accent color">
          {(Object.keys(ACCENTS) as AccentName[]).map((name) => (
            <button
              key={name}
              className="swatch"
              role="radio"
              aria-checked={currentAccent === name}
              aria-label={ACCENTS[name].label}
              title={ACCENTS[name].label}
              style={{ "--swatch-light": ACCENTS[name].light, "--swatch-dark": ACCENTS[name].dark } as CSSProperties}
              onClick={() => accent.set(name)}
            />
          ))}
          <label className="swatch swatch-custom" data-checked={custom || undefined} title="Pick any color">
            <input
              type="color"
              aria-label="Custom accent color"
              value={custom ? currentAccent : ACCENTS[currentAccent as AccentName].light}
              onChange={(event) => accent.set(event.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="settings-row">
        <span>Font</span>
        <Segmented
          label="Font"
          value={font.use()}
          options={(Object.keys(FONTS) as Font[]).map((value) => ({ value, label: FONTS[value].label, style: { fontFamily: FONTS[value].stack } }))}
          onChange={font.set}
        />
      </div>
      <TextSizeSlider />
      <div className="settings-row">
        <span>Page width</span>
        <Segmented
          label="Page width"
          value={pageWidth.use()}
          options={PAGE_WIDTH_ORDER.map((value) => ({ value, label: PAGE_WIDTHS[value].label }))}
          onChange={pageWidth.set}
        />
      </div>
    </>
  );
}
