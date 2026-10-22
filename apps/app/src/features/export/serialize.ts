// Note bodies as plain text, Markdown and HTML. They read the editor's stored
// JSON (the same shape Tiptap uses), so no editor has to be open.

import { blockStyleHtml, textStyleOf } from "./styles";

export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

export interface Resolve {
  /** A link's target title now, or null when the target is gone. */
  title(id: string): string | null;
  /** Where a picture is, for this format: a data URL, or a path inside a zip. */
  image(asset: string): string | null;
}

const kids = (node: DocNode) => node.content ?? [];
const str = (value: unknown) => (typeof value === "string" ? value : "");

/** Every picture a body uses, so they can be loaded before writing. */
export function assetsIn(node: DocNode, out = new Set<string>()): Set<string> {
  if (node.type === "image" && str(node.attrs?.asset)) out.add(str(node.attrs?.asset));
  for (const child of kids(node)) assetsIn(child, out);
  return out;
}

const linkTitle = (node: DocNode, r: Resolve) => r.title(str(node.attrs?.targetId)) ?? str(node.attrs?.label) ?? "";

/* Plain text */

function inlineText(node: DocNode, r: Resolve): string {
  return kids(node)
    .map((child) => {
      if (child.type === "text") return child.text ?? "";
      if (child.type === "hardBreak") return "\n";
      if (child.type === "wikiLink") return linkTitle(child, r);
      return inlineText(child, r);
    })
    .join("");
}

function textBlocks(nodes: DocNode[], r: Resolve, indent: string): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "bulletList":
      case "orderedList":
      case "taskList": {
        let n = Number(node.attrs?.start ?? 1);
        const lines: string[] = [];
        for (const item of kids(node)) {
          const marker = node.type === "bulletList" ? "- " : node.type === "orderedList" ? `${n++}. ` : item.attrs?.checked ? "[x] " : "[ ] ";
          const [first = "", ...rest] = textBlocks(kids(item), r, `${indent}  `);
          lines.push(`${indent}${marker}${first.trimStart()}`, ...rest);
        }
        out.push(lines.join("\n"));
        break;
      }
      case "blockquote":
        out.push(textBlocks(kids(node), r, indent).map((b) => b.replace(/^/gm, "  ")).join("\n\n"));
        break;
      case "codeBlock":
        out.push(inlineText(node, r).replace(/^/gm, indent));
        break;
      case "horizontalRule":
        out.push(`${indent}* * *`);
        break;
      case "image":
        if (str(node.attrs?.alt)) out.push(`${indent}[Picture: ${str(node.attrs?.alt)}]`);
        break;
      // Videos stay out of downloads, which would grow by the whole file; a line says one was there.
      case "video":
        out.push(`${indent}[Video: ${str(node.attrs?.name) || "video"}]`);
        break;
      default:
        if (node.content?.some((c) => c.type === "paragraph" || c.type === "heading")) out.push(...textBlocks(kids(node), r, indent));
        else out.push(indent + inlineText(node, r));
    }
  }
  return out;
}

export function toPlainText(doc: DocNode, r: Resolve): string {
  return textBlocks(kids(doc), r, "").join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/* Markdown */

// Only what Markdown would read as formatting: marks anywhere, and list or heading signs at a line start.
const mdEscape = (text: string) =>
  text
    .replace(/([\\`*_[\]<>])/g, "\\$1")
    .replace(/^(#{1,6}) /gm, "\\$1 ")
    .replace(/^(\d+)\. /gm, "$1\\. ")
    .replace(/^([-+]) /gm, "\\$1 ");

function mdInline(node: DocNode, r: Resolve): string {
  return kids(node)
    .map((child) => {
      if (child.type === "hardBreak") return "  \n";
      if (child.type === "wikiLink") return `[[${linkTitle(child, r)}]]`;
      if (child.type !== "text") return mdInline(child, r);
      const marks = child.marks ?? [];
      if (!marks.length) return mdEscape(child.text ?? "");
      // "**heron **" is not bold in Markdown: spaces at the edges go outside the marks.
      const [, before, inner, after] = /^(\s*)([\s\S]*?)(\s*)$/.exec(child.text ?? "")!;
      if (!inner) return before + after;
      const code = marks.some((m) => m.type === "code");
      let text = code ? `\`${inner}\`` : mdEscape(inner);
      for (const mark of marks) {
        if (mark.type === "bold") text = `**${text}**`;
        else if (mark.type === "italic") text = `*${text}*`;
        else if (mark.type === "strike") text = `~~${text}~~`;
        else if (mark.type === "underline") text = `<u>${text}</u>`;
        else if (mark.type === "highlight") text = `==${text}==`;
        else if (mark.type === "link") text = `[${text}](${str(mark.attrs?.href)})`;
      }
      return before + text + after;
    })
    .join("");
}

function mdBlocks(nodes: DocNode[], r: Resolve): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "heading":
        out.push(`${"#".repeat(Number(node.attrs?.level ?? 1))} ${mdInline(node, r)}`);
        break;
      case "paragraph":
        out.push(mdInline(node, r));
        break;
      case "bulletList":
      case "orderedList":
      case "taskList": {
        let n = Number(node.attrs?.start ?? 1);
        const items = kids(node).map((item) => {
          const marker = node.type === "bulletList" ? "- " : node.type === "orderedList" ? `${n++}. ` : item.attrs?.checked ? "- [x] " : "- [ ] ";
          const body = mdBlocks(kids(item), r).join("\n\n");
          return marker + body.replace(/\n/g, `\n${" ".repeat(marker.length)}`);
        });
        out.push(items.join("\n"));
        break;
      }
      case "blockquote":
        out.push(mdBlocks(kids(node), r).join("\n\n").replace(/^/gm, "> "));
        break;
      case "codeBlock":
        out.push(`\`\`\`${str(node.attrs?.language)}\n${inlineText(node, r)}\n\`\`\``);
        break;
      case "horizontalRule":
        out.push("---");
        break;
      case "image": {
        const src = r.image(str(node.attrs?.asset)) ?? str(node.attrs?.src);
        if (src) out.push(`![${str(node.attrs?.alt).replace(/[[\]]/g, "")}](${src})`);
        break;
      }
      // As HTML, so a Markdown file kept beside the notes reads the video back when edited elsewhere.
      case "video":
        out.push(`<video data-asset="${escapeHtml(str(node.attrs?.asset))}" data-name="${escapeHtml(str(node.attrs?.name))}" controls></video>`);
        break;
      default:
        out.push(...mdBlocks(kids(node), r));
    }
  }
  return out;
}

export function toMarkdown(doc: DocNode, r: Resolve): string {
  return mdBlocks(kids(doc), r).join("\n\n").trim() + "\n";
}

/* HTML */

export const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function htmlInline(node: DocNode, r: Resolve): string {
  return kids(node)
    .map((child) => {
      if (child.type === "hardBreak") return "<br>";
      if (child.type === "wikiLink") return `<span class="link">${escapeHtml(linkTitle(child, r))}</span>`;
      if (child.type !== "text") return htmlInline(child, r);
      // Spaces at the edges stay outside the tags, so a bold word does not drag its space along.
      const [, before, inner, after] = /^(\s*)([\s\S]*?)(\s*)$/.exec(child.text ?? "")!;
      let text = escapeHtml(inner);
      for (const mark of child.marks ?? []) {
        const tag = { bold: "strong", italic: "em", strike: "s", code: "code", underline: "u", highlight: "mark" }[mark.type];
        if (mark.type === "highlight" && str(mark.attrs?.color)) text = `<mark style="background-color:${escapeHtml(str(mark.attrs?.color))}">${text}</mark>`;
        else if (tag) text = `<${tag}>${text}</${tag}>`;
        else if (mark.type === "textStyle") {
          const { color, size, font } = textStyleOf([mark]);
          const style = [color && `color:${color}`, size && `font-size:${size}px`, font && `font-family:${font}`].filter(Boolean).join(";");
          if (style) text = `<span style="${escapeHtml(style)}">${text}</span>`;
        }
        else if (mark.type === "link") text = `<a href="${escapeHtml(str(mark.attrs?.href))}">${text}</a>`;
      }
      return escapeHtml(before) + text + escapeHtml(after);
    })
    .join("");
}

export function toHtml(nodes: DocNode[], r: Resolve): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "heading": {
          const level = Math.min(6, Number(node.attrs?.level ?? 1));
          return `<h${level}${blockStyleHtml(node)}>${htmlInline(node, r)}</h${level}>`;
        }
        case "paragraph":
          return `<p${blockStyleHtml(node)}>${htmlInline(node, r)}</p>`;
        case "bulletList":
          return `<ul>${toHtml(kids(node), r)}</ul>`;
        case "orderedList":
          return `<ol${Number(node.attrs?.start ?? 1) !== 1 ? ` start="${Number(node.attrs?.start)}"` : ""}>${toHtml(kids(node), r)}</ol>`;
        case "taskList":
          return `<ul class="tasks">${toHtml(kids(node), r)}</ul>`;
        case "listItem":
          return `<li>${toHtml(kids(node), r)}</li>`;
        case "taskItem":
          return `<li><input type="checkbox" disabled${node.attrs?.checked ? " checked" : ""}> ${toHtml(kids(node), r)}</li>`;
        case "blockquote":
          return `<blockquote>${toHtml(kids(node), r)}</blockquote>`;
        case "codeBlock":
          return `<pre><code>${escapeHtml(inlineText(node, r))}</code></pre>`;
        case "horizontalRule":
          return "<hr>";
        case "image": {
          const src = r.image(str(node.attrs?.asset)) ?? str(node.attrs?.src);
          if (!src) return "";
          const width = Number(node.attrs?.width);
          const style = width ? ` style="width:${width}%"` : "";
          return `<figure class="align-${escapeHtml(str(node.attrs?.align) || "center")}"><img src="${escapeHtml(src)}" alt="${escapeHtml(str(node.attrs?.alt))}"${style}></figure>`;
        }
        case "video":
          return `<p>[Video: ${escapeHtml(str(node.attrs?.name) || "video")}]</p>`;
        default:
          return toHtml(kids(node), r);
      }
    })
    .join("\n");
}

/** Plain styles for exported pages, so they read well in any browser or e-reader. */
export const PAGE_CSS = `body{max-width:42em;margin:2em auto;padding:0 1em;font:17px/1.6 Georgia,serif;color:#222}
h1,h2,h3{line-height:1.25}img{max-width:100%;height:auto}figure{margin:1em 0}figure.align-center{text-align:center}
figure.align-right{text-align:right}figure.align-full img{width:100%}blockquote{margin:1em 0;padding-left:1em;border-left:3px solid #ccc;color:#555}
pre{padding:.75em;background:#f4f4f4;overflow:auto}code{font-family:Consolas,monospace;font-size:.9em}ul.tasks{list-style:none;padding-left:1em}
.chapter{break-before:page}`;

export function htmlDocument(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${PAGE_CSS}</style>
</head>
<body>
${body}
</body>
</html>
`;
}
