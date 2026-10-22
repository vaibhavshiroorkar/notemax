/** Fonts to pick from. Empty means the font set in Appearance. */
export const FONTS = [
  { name: "Default", value: "" },
  { name: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { name: "Sans", value: "system-ui, 'Segoe UI', Roboto, sans-serif" },
  { name: "Mono", value: "ui-monospace, Consolas, 'Courier New', monospace" },
  { name: "Rounded", value: "ui-rounded, 'Arial Rounded MT Bold', system-ui, sans-serif" },
  { name: "Handwriting", value: "'Segoe Print', 'Bradley Hand', cursive" },
] as const;

/** Sizes in pixels, as in Word's list. */
export const SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64];

/** A size like "18px" as a number, or 0 for the default size. */
export const sizeOf = (value: string | undefined) => (value ? Math.round(parseFloat(value)) || 0 : 0);

// Colors that read on both light and dark pages.
export const COLORS = [
  { name: "Default", value: "" },
  { name: "Gray", value: "#868e96" },
  { name: "Red", value: "#e03131" },
  { name: "Orange", value: "#e8590c" },
  { name: "Yellow", value: "#f08c00" },
  { name: "Green", value: "#2f9e44" },
  { name: "Blue", value: "#1c7ed6" },
  { name: "Purple", value: "#9c36b5" },
  { name: "Pink", value: "#d6336c" },
] as const;

// See-through, so the text stays readable in light and dark.
export const HIGHLIGHTS = [
  { name: "None", value: "" },
  { name: "Yellow", value: "rgba(250, 204, 21, 0.4)" },
  { name: "Green", value: "rgba(64, 192, 87, 0.35)" },
  { name: "Blue", value: "rgba(51, 154, 240, 0.35)" },
  { name: "Pink", value: "rgba(240, 101, 149, 0.35)" },
  { name: "Orange", value: "rgba(253, 126, 20, 0.35)" },
  { name: "Gray", value: "rgba(134, 142, 150, 0.3)" },
] as const;

export const LINE_HEIGHTS = [
  { name: "Default", value: "" },
  { name: "Single", value: "1.2" },
  { name: "1.5 lines", value: "1.8" },
  { name: "Double", value: "2.4" },
] as const;
