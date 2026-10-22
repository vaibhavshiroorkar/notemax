import type { DocNode } from "./serialize";

// The Format section's choices, in the terms each download format speaks.

const str = (value: unknown) => (typeof value === "string" ? value : "");

/** A CSS color as "RRGGBB", with see-through colors laid over white, as on paper. Null when it cannot be read. */
export function hexOf(color: string): string | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (hex) return hex[1].toUpperCase();
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)$/i.exec(color.trim());
  if (!rgb) return null;
  const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]);
  return [rgb[1], rgb[2], rgb[3]]
    .map((c) => Math.round(Number(c) * alpha + 255 * (1 - alpha)))
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** The text style mark of a run: color, size in pixels and font. */
export function textStyleOf(marks: DocNode["marks"] = []) {
  const style = marks.find((mark) => mark.type === "textStyle")?.attrs ?? {};
  return { color: str(style.color), size: parseFloat(str(style.fontSize)) || 0, font: str(style.fontFamily) };
}

/** The first font named in a CSS font list, like "Georgia". */
export const firstFont = (family: string) => family.split(",")[0].trim().replace(/^['"]|['"]$/g, "");

/** A paragraph's alignment, spacing and indent, as an HTML style attribute (with a leading space), or "". */
export function blockStyleHtml(node: DocNode): string {
  const parts: string[] = [];
  const align = str(node.attrs?.textAlign);
  if (align && align !== "left") parts.push(`text-align:${align}`);
  const spacing = str(node.attrs?.lineSpacing);
  if (spacing) parts.push(`line-height:${spacing}`);
  const indent = Number(node.attrs?.indent) || 0;
  if (indent) parts.push(`margin-left:${indent * 1.5}em`);
  return parts.length ? ` style="${parts.join(";")}"` : "";
}

/** The same for Word: alignment, an indent of a quarter inch per step, and line spacing. */
export function blockStyleDocx(node: DocNode): string {
  let out = "";
  const indent = Number(node.attrs?.indent) || 0;
  if (indent) out += `<w:ind w:left="${indent * 360}"/>`;
  const spacing = parseFloat(str(node.attrs?.lineSpacing));
  // Word's single spacing is 240. The editor's single is 1.2 lines.
  if (spacing) out += `<w:spacing w:line="${Math.round((spacing / 1.2) * 240)}" w:lineRule="auto"/>`;
  const align = { center: "center", right: "right", justify: "both" }[str(node.attrs?.textAlign)];
  if (align) out += `<w:jc w:val="${align}"/>`;
  return out;
}
