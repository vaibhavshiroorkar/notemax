import { useRef } from "react";
import { saveAsset } from "@notemax/core";
import { getSharedStore } from "@/platform/platform";
import { createStore } from "@/platform/store";
import { FONTS, font, fontFile, fontLabel, fontStack, type Font } from "@/ui/appearance";
import { SearchSelect, type Choice } from "@/ui/SearchSelect";

/** Fonts installed on this device, once the browser has been allowed to list them. */
const deviceFonts = createStore<string[] | null>(null);

type LocalFont = { family: string };
const canList = () => "queryLocalFonts" in window;

async function listDeviceFonts() {
  try {
    const fonts = (await (window as unknown as { queryLocalFonts(): Promise<LocalFont[]> }).queryLocalFonts()) ?? [];
    deviceFonts.set([...new Set(fonts.map((f) => f.family))].sort((a, b) => a.localeCompare(b)));
  } catch {
    // Refused: typing a font's name still works.
    deviceFonts.set([]);
  }
}

// Font files are a few hundred kilobytes; anything far bigger is not a font.
const MAX_FONT_BYTES = 10 * 1024 * 1024;

/** The note font: a preset, any font on this device by name, or a font file. */
export function FontPicker() {
  const value = font.use();
  const file = fontFile.use();
  const found = deviceFonts.use();
  const input = useRef<HTMLInputElement>(null);

  const choices: Choice[] = [
    ...(Object.keys(FONTS) as Font[]).map((key) => ({ value: key, label: FONTS[key].label, style: { fontFamily: FONTS[key].stack } })),
    ...(file ? [{ value: "file", label: file.name, hint: "font file", style: { fontFamily: fontStack("file") } }] : []),
    ...(value.startsWith("custom:") && !found?.includes(value.slice(7)) ? [{ value, label: fontLabel(value), hint: "on this device", style: { fontFamily: fontStack(value) } }] : []),
    ...(found ?? []).map((family) => ({ value: `custom:${family}`, label: family, hint: "on this device", style: { fontFamily: fontStack(`custom:${family}`) } })),
  ];

  const loadFile = async (picked: File | undefined) => {
    if (!picked) return;
    if (picked.size > MAX_FONT_BYTES) return;
    const bytes = new Uint8Array(await picked.arrayBuffer());
    const asset = await saveAsset(await getSharedStore(), { bytes, type: picked.type || "font/ttf", name: picked.name });
    fontFile.set({ name: picked.name.replace(/\.(ttf|otf|woff2?)$/i, ""), asset });
    font.set("file");
  };

  return (
    <>
      <SearchSelect
        label="Font"
        value={value}
        shown={{ label: fontLabel(value), style: { fontFamily: fontStack(value) } }}
        choices={choices}
        onChange={font.set}
        extra={(query) => [{ value: `custom:${query}`, label: `Use "${query}"`, hint: "a font on this device", style: { fontFamily: fontStack(`custom:${query}`) } }]}
        footer={
          <>
            {canList() && found === null && (
              <button className="link-button" onClick={() => void listDeviceFonts()}>
                Show fonts on this device
              </button>
            )}
            <button className="link-button" onClick={() => input.current?.click()}>
              Load a font file...
            </button>
          </>
        }
      />
      <input ref={input} type="file" accept=".ttf,.otf,.woff,.woff2,font/*" hidden onChange={(event) => void loadFile(event.target.files?.[0])} />
    </>
  );
}
