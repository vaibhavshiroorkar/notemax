// Cleans HTML made from someone else's content, like a community post, before
// it goes on the page. Only plain text formatting survives: no scripts, no
// event handlers, links only to the web or email, pictures only over https.

const TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "STRONG", "EM", "S", "U", "CODE", "PRE", "BLOCKQUOTE", "HR", "BR", "MARK", "SPAN", "A", "INPUT", "FIGURE", "IMG", "SECTION"]);
// Gone with everything in them. An unknown wrapper is unwrapped instead and keeps its text.
const DROPPED = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE", "NOSCRIPT", "TEXTAREA", "SELECT"]);
const HTML_NS = "http://www.w3.org/1999/xhtml";

// Only the editor's own text styles, so a post can color and size its words
// but cannot place anything over the app (position, z-index and the like).
const STYLE_PROPERTIES = new Set(["color", "background-color", "font-size", "font-family", "font-weight", "font-style", "text-align", "text-decoration", "line-height", "margin-left", "width"]);
const STYLE_VALUE = /^[\w\s#%(),.'"-]*$/;

function cleanStyle(style: string): string {
  return style
    .split(";")
    .map((part) => {
      const colon = part.indexOf(":");
      if (colon < 0) return "";
      const name = part.slice(0, colon).trim().toLowerCase();
      const value = part.slice(colon + 1).trim();
      if (!STYLE_PROPERTIES.has(name) || !STYLE_VALUE.test(value) || /url\s*\(|expression|var\s*\(/i.test(value)) return "";
      return `${name}:${value}`;
    })
    .filter(Boolean)
    .join(";");
}

// A Map, so names like __proto__ or constructor find nothing.
const ATTRIBUTES = new Map<string, (value: string, el: Element) => boolean>([
  ["href", (value) => /^(https?:|mailto:)/i.test(value.trim())],
  ["src", (value) => /^https:\/\//i.test(value.trim())],
  ["alt", () => true],
  ["start", (value) => /^\d{1,6}$/.test(value)],
  ["class", (value) => /^[\w -]*$/.test(value)],
  ["type", (value, el) => el.tagName === "INPUT" && value === "checkbox"],
  ["checked", (_value, el) => el.tagName === "INPUT"],
  ["disabled", (_value, el) => el.tagName === "INPUT"],
]);

function clean(node: Element) {
  for (const child of [...node.children]) {
    // SVG and MathML elements have lowercase tag names and parse by other rules, so they go whole.
    if (child.namespaceURI !== HTML_NS || DROPPED.has(child.tagName)) {
      child.remove();
      continue;
    }
    if (!TAGS.has(child.tagName)) {
      clean(child);
      child.replaceWith(...child.childNodes);
      continue;
    }
    for (const attribute of [...child.attributes]) {
      if (attribute.name === "style") {
        const style = cleanStyle(attribute.value);
        if (style) child.setAttribute("style", style);
        else child.removeAttribute("style");
        continue;
      }
      const allowed = ATTRIBUTES.get(attribute.name);
      if (!allowed || !allowed(attribute.value, child)) child.removeAttribute(attribute.name);
    }
    if (child.tagName === "A" && !child.hasAttribute("href")) {
      // A link to somewhere not allowed is just its words.
      clean(child);
      child.replaceWith(...child.childNodes);
      continue;
    }
    if (child.tagName === "A") {
      child.setAttribute("target", "_blank");
      child.setAttribute("rel", "noopener noreferrer nofollow ugc");
    }
    if (child.tagName === "INPUT") child.setAttribute("disabled", "");
    clean(child);
  }
}

/** The HTML with everything but plain formatting taken out. */
export function safeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  clean(doc.body);
  return doc.body.innerHTML;
}
