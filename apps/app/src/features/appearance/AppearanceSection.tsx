import { useId, type CSSProperties } from "react";
import { ACCENTS, PAGE_WIDTH, accent, clampPageWidth, pageWidth, theme, type AccentName, type Theme } from "@/ui/appearance";
import { FontRow, TextSizeSlider } from "@/features/settings/BasicRows";
import { isDesktop } from "@/platform/platform";
import { ZOOM, zoom } from "./zoom";
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
      <FontRow />
      <TextSizeSlider />
      <PageWidthRow />
      <ZoomRow />
    </>
  );
}

/** A slider in pixels, and a switch for the whole window's width. */
function PageWidthRow() {
  const width = pageWidth.use();
  const id = useId();
  const full = width === 0;
  return (
    <div className="settings-row">
      <label htmlFor={id}>Page width</label>
      <span className="text-size">
        <input
          id={id}
          type="range"
          min={PAGE_WIDTH.min}
          max={PAGE_WIDTH.max}
          step={PAGE_WIDTH.step}
          disabled={full}
          value={full ? PAGE_WIDTH.max : width}
          onChange={(event) => pageWidth.set(clampPageWidth(Number(event.target.value)))}
        />
        <output htmlFor={id}>{full ? "Full" : `${width} px`}</output>
        <label className="page-full">
          <input type="checkbox" checked={full} onChange={(event) => pageWidth.set(event.target.checked ? 0 : PAGE_WIDTH.normal)} />
          Full
        </label>
      </span>
    </div>
  );
}

/** The whole app's size. The desktop app's own; a browser has its zoom already. */
function ZoomRow() {
  const percent = zoom.use();
  const id = useId();
  if (!isDesktop)
    return (
      <div className="settings-row">
        <span>
          Zoom
          <span className="settings-description">Use your browser's zoom: Ctrl and the mouse wheel. Text size above changes only the note's text.</span>
        </span>
      </div>
    );
  return (
    <div className="settings-row">
      <label htmlFor={id}>
        Zoom
        <span className="settings-description">Everything, not just the text. Ctrl and the mouse wheel change it too.</span>
      </label>
      <span className="text-size">
        <input id={id} type="range" min={ZOOM.min} max={ZOOM.max} step={ZOOM.step} value={percent} onChange={(event) => zoom.set(Number(event.target.value))} />
        <output htmlFor={id}>{percent}%</output>
        {percent !== ZOOM.normal && (
          <button className="link-button" onClick={() => zoom.set(ZOOM.normal)}>
            Reset
          </button>
        )}
      </span>
    </div>
  );
}
