// Cleans HTML made from someone else's content, like a community post, before
// it goes on the page. Only plain text formatting survives: no scripts, no
// event handlers, links only to the web or email, pictures only over https.

const TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "STRONG", "EM", "S", "U", "CODE", "PRE", "BLOCKQUOTE", "HR", "BR", "MARK", "SPAN", "A", "INPUT", "FIGURE", "IMG", "SECTION"]);
// Styles come from the editor's own text styles: colors, sizes, fonts, alignment, indents.
const STYLE = /^[\w\s#%(),.;:'"-]*$/;
const ATTRIBUTES: Record<string, (value: string, el: Element) => boolean> = {
  href: (value) => /^(https?:|mailto:)/i.test(value.trim()),
  src: (value) => /^https:\/\//i.test(value.trim()),
  alt: () => true,
  start: (value) => /^\d{1,6}$/.test(value),
  style: (value) => STYLE.test(value) && !/url\s*\(|expression|@import/i.test(value),
  class: (value) => /^[\w -]*$/.test(value),
  type: (value, el) => el.tagName === "INPUT" && value === "checkbox",
  checked: (_value, el) => el.tagName === "INPUT",
  disabled: (_value, el) => el.tagName === "INPUT",
};

function clean(node: Element) {
  for (const child of [...node.children]) {
    if (!TAGS.has(child.tagName)) {
      // An unknown wrapper keeps its text; a script or the like goes entirely.
      if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE", "SVG", "MATH"].includes(child.tagName)) child.remove();
      else {
        clean(child);
        child.replaceWith(...child.childNodes);
      }
      continue;
    }
    for (const attribute of [...child.attributes]) {
      const allowed = ATTRIBUTES[attribute.name];
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
