import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

// What Word and Google Docs put on the clipboard is HTML full of their own
// markup: Office tags, comments, class names and lists drawn as paragraphs
// with a bullet character in front. This turns it into the plain HTML the
// editor understands, keeping headings, lists, bold, italic, links, sizes,
// colors and alignment, and dropping the rest.

const fromWord = (html: string) => /urn:schemas-microsoft-com:office|class=["']?Mso|mso-/i.test(html);
const fromGoogleDocs = (html: string) => html.includes('id="docs-internal-guid');

/** Style properties worth keeping. The editor reads them back through its own extensions. */
const KEPT_STYLES = new Set(["font-size", "color", "background-color", "font-family", "text-align", "font-weight", "font-style", "text-decoration"]);

function keepStyles(el: HTMLElement) {
  const kept: string[] = [];
  for (const name of Array.from(el.style)) {
    if (!KEPT_STYLES.has(name)) continue;
    let value = el.style.getPropertyValue(name);
    // Word writes sizes in points. The editor speaks pixels.
    if (name === "font-size" && value.endsWith("pt")) value = `${Math.round(parseFloat(value) * (4 / 3))}px`;
    // Word names every font, even the default. Only a real choice is kept.
    if (name === "font-family" && /calibri|cambria|times new roman|arial|aptos|symbol|courier new/i.test(value)) continue;
    // Black text is no choice either; it would stay black in dark mode.
    if (name === "color" && /^(#000000|black|windowtext|rgb\(0, 0, 0\))$/i.test(value.trim())) continue;
    kept.push(`${name}: ${value}`);
  }
  if (kept.length) el.setAttribute("style", kept.join("; "));
  else el.removeAttribute("style");
}

interface ListLine {
  el: HTMLElement;
  level: number;
  ordered: boolean;
  list: string;
}

/** Word draws a list as paragraphs with "mso-list: l0 level2" and a marker like "1." or a bullet in front. */
function listLine(el: HTMLElement): ListLine | null {
  const style = el.getAttribute("style") ?? "";
  const match = /mso-list:\s*(l\d+)\s+level(\d+)/i.exec(style);
  if (!match) return null;
  const marker = el.querySelector("[style*='mso-list:Ignore'], [style*='mso-list: Ignore']")?.textContent?.trim() ?? "";
  const ordered = /^[(]?([0-9]+|[a-z]|[ivxlc]+)[.)]/i.test(marker);
  return { el, level: Number(match[2]), ordered, list: match[1] };
}

/** Turns runs of Word list paragraphs into real nested lists. */
function rebuildLists(body: HTMLElement) {
  const lines = Array.from(body.querySelectorAll<HTMLElement>("p")).map(listLine);
  let i = 0;
  while (i < lines.length) {
    const first = lines[i];
    if (!first) {
      i++;
      continue;
    }
    // A run: list lines that follow each other in the page.
    const run: ListLine[] = [first];
    while (i + run.length < lines.length) {
      const next = lines[i + run.length];
      // A new list id is a new list, even right after the last one, like bullets then numbers.
      if (!next || run[run.length - 1].el.nextElementSibling !== next.el || next.list !== first.list) break;
      run.push(next);
    }
    const doc = body.ownerDocument;
    const root = doc.createElement(first.ordered ? "ol" : "ul");
    first.el.before(root);
    // The list open at each level, and its last item, so deeper lines nest inside it.
    const open: { list: HTMLElement; item: HTMLElement | null }[] = [{ list: root, item: null }];
    for (const line of run) {
      const depth = Math.max(1, line.level);
      while (open.length > depth) open.pop();
      while (open.length < depth) {
        const parent = open[open.length - 1];
        const nested = doc.createElement(line.ordered ? "ol" : "ul");
        (parent.item ?? parent.list).appendChild(nested);
        open.push({ list: nested, item: null });
      }
      line.el.querySelectorAll("[style*='mso-list:Ignore'], [style*='mso-list: Ignore']").forEach((marker) => marker.remove());
      const item = doc.createElement("li");
      const paragraph = doc.createElement("p");
      paragraph.append(...Array.from(line.el.childNodes));
      item.appendChild(paragraph);
      open[open.length - 1].list.appendChild(item);
      open[open.length - 1].item = item;
      line.el.remove();
    }
    i += run.length;
  }
}

function cleanTree(body: HTMLElement) {
  // Comments carry Word's "if !supportLists" switches and fragment markers.
  const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((comment) => comment.parentNode?.removeChild(comment));

  rebuildLists(body);

  for (const el of Array.from(body.querySelectorAll<HTMLElement>("*"))) {
    const tag = el.tagName.toLowerCase();
    // Office tags like <o:p>, and anything that is not content.
    if (tag.includes(":") || ["style", "meta", "link", "xml", "script", "title"].includes(tag)) {
      if (tag === "o:p" && el.textContent?.trim()) el.replaceWith(...Array.from(el.childNodes));
      else el.remove();
      continue;
    }
    el.removeAttribute("class");
    el.removeAttribute("lang");
    // Word's align attribute is the old way to say text-align.
    const align = el.getAttribute("align");
    if (align && !el.style.textAlign) el.style.textAlign = align;
    el.removeAttribute("align");
    if (el.hasAttribute("style")) keepStyles(el);
  }
  // Paragraphs Word left empty to make space.
  for (const p of Array.from(body.querySelectorAll("p"))) if (!p.textContent?.replace(/ /g, "").trim() && !p.querySelector("img")) p.remove();
}

/** Google Docs wraps everything in a bold tag that is not bold. */
function unwrapGoogleDocs(body: HTMLElement) {
  for (const b of Array.from(body.querySelectorAll<HTMLElement>("b[id^='docs-internal-guid']"))) b.replaceWith(...Array.from(b.childNodes));
  // Its bold and italic come as styles on spans, which the editor reads as marks.
  for (const span of Array.from(body.querySelectorAll<HTMLElement>("span[style]"))) {
    const weight = span.style.fontWeight;
    if (weight === "700" || weight === "bold") span.innerHTML = `<strong>${span.innerHTML}</strong>`;
    if (span.style.fontStyle === "italic") span.innerHTML = `<em>${span.innerHTML}</em>`;
    keepStyles(span);
  }
}

/** Clipboard HTML from Word or Google Docs, made plain. Anything else is returned as it came. */
export function cleanPastedHtml(html: string): string {
  const word = fromWord(html);
  const google = fromGoogleDocs(html);
  if (!word && !google) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (word) cleanTree(doc.body);
  if (google) unwrapGoogleDocs(doc.body);
  return doc.body.innerHTML;
}

/** Runs every paste from Word or Google Docs through cleanPastedHtml first. */
export const WordPaste = Extension.create({
  name: "wordPaste",
  addProseMirrorPlugins() {
    return [new Plugin({ key: new PluginKey("wordPaste"), props: { transformPastedHTML: cleanPastedHtml } })];
  },
});
