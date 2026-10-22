import type { Asset, TreeNode } from "@notemax/core";
import type { AppContext, Exporter } from "@/plugins/types";
import { readingOrder } from "@/features/books/reading";
import { registry } from "@/plugins/registry";
import { dataUrl, extOf, loadBody, loadPictures, resolver } from "./content";
import { buildDocx, type DocxImage } from "./docx";
import { buildEpub } from "./epub";
import { printHtml } from "./save";
import { escapeHtml, htmlDocument, toHtml, toMarkdown, toPlainText, type DocNode } from "./serialize";
import { zip } from "./zip";

interface Part {
  title?: string;
  body: DocNode;
  /** 0 for a chapter right in the book, 1 for one inside a part, and so on. A part itself has an empty body. */
  level?: number;
}

const EMPTY: DocNode = { type: "doc", content: [] };

/** A board in a book goes into the download as a picture of it. */
async function boardPicture(id: string, app: AppContext): Promise<Asset | null> {
  const png = registry.exporters("board").find((format) => format.id === "png");
  const node = app.tree.byId.get(id);
  const blob = png && node ? await png.build(node, app).catch(() => null) : null;
  return blob ? { bytes: new Uint8Array(await blob.arrayBuffer()), type: "image/png", name: `${node!.title || "Board"}.png` } : null;
}

/**
 * A page's text in parts: one for a note, one per chapter for a book, with
 * its parts as headings. `made` holds the pictures drawn for boards.
 */
async function partsOf(node: TreeNode, app: AppContext): Promise<{ title: string; parts: Part[]; made: Map<string, Asset> }> {
  const title = node.title || (node.kind === "book" ? "Untitled book" : "Untitled");
  const made = new Map<string, Asset>();
  const book = app.tree.items.get(node.id);
  if (node.kind !== "book" || !book) return { title, parts: [{ body: await loadBody(node.id) }], made };
  const parts: Part[] = [];
  for (const { item, depth, number } of readingOrder(book)) {
    const part: Part = { title: item.title || (number === null ? "Untitled part" : "Untitled"), body: EMPTY, level: depth };
    if (item.kind === "note") part.body = await loadBody(item.id);
    else if (item.kind === "board") {
      const picture = await boardPicture(item.id, app);
      if (picture) {
        const id = `board-${item.id}`;
        made.set(id, picture);
        part.body = { type: "doc", content: [{ type: "image", attrs: { asset: id } }] };
      }
    }
    parts.push(part);
  }
  return { title, parts, made };
}

/** Markdown and HTML headings for a part: ## for a chapter of the book, ### inside a part, and so on. */
const headingLevel = (part: Part) => Math.min(2 + (part.level ?? 0), 6);

const text = (blob: string, type: string) => new Blob([blob], { type: `${type};charset=utf-8` });

async function plainText(node: TreeNode, app: AppContext) {
  const { title, parts } = await partsOf(node, app);
  const r = resolver(app.tree);
  const body = parts.map((part) => (part.title ? `${part.title}\n\n` : "") + toPlainText(part.body, r)).join("\n\n");
  return text(`${title}\n\n${body}`, "text/plain");
}

/** Markdown, as a .zip with an attachments folder when the page has pictures. */
export async function markdown(node: TreeNode, app: AppContext) {
  const { title, parts, made } = await partsOf(node, app);
  const pictures = await loadPictures(
    parts.map((p) => p.body),
    made,
  );
  const path = (id: string) => `attachments/${id.slice(0, 16)}.${extOf(pictures.get(id)!.type)}`;
  const r = resolver(app.tree, (id) => (pictures.has(id) ? path(id) : null));
  const book = node.kind === "book";
  const md =
    `# ${title}\n\n` +
    parts.map((part) => (part.title ? `${book ? `${"#".repeat(headingLevel(part))} ` : ""}${part.title}\n\n` : "") + toMarkdown(part.body, r)).join("\n");
  if (!pictures.size) return { blob: text(md, "text/markdown"), ext: "md" };
  const files = [{ path: `${title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "Untitled"}.md`, data: md }, ...[...pictures].map(([id, asset]) => ({ path: path(id), data: asset.bytes }))];
  return { blob: zip(files), ext: "zip" };
}

async function htmlPage(node: TreeNode, app: AppContext, forPrint = false) {
  const { title, parts, made } = await partsOf(node, app);
  const pictures = await loadPictures(
    parts.map((p) => p.body),
    made,
  );
  const r = resolver(app.tree, (id) => (pictures.has(id) ? dataUrl(pictures.get(id)!) : null));
  const body =
    `<h1>${escapeHtml(title)}</h1>\n` +
    parts
      .map((part) => {
        const h = `h${headingLevel(part)}`;
        return part.title ? `<section class="chapter"><${h}>${escapeHtml(part.title)}</${h}>\n${toHtml(part.body.content ?? [], r)}</section>` : toHtml(part.body.content ?? [], r);
      })
      .join("\n");
  const page = htmlDocument(title, body);
  // On paper: real margins, and no heading left alone at the bottom of a page.
  return forPrint ? page.replace("</style>", "@page{margin:2cm}body{margin:0;max-width:none}h1,h2,h3{break-after:avoid}</style>") : page;
}

/** Word and EPUB take only some picture types; others are drawn into a PNG. */
async function asPng(asset: Asset): Promise<{ bytes: Uint8Array; type: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(new Blob([asset.bytes as BlobPart], { type: asset.type }));
  const { width, height } = bitmap;
  if (["image/png", "image/jpeg", "image/gif"].includes(asset.type)) {
    bitmap.close();
    return { bytes: asset.bytes, type: asset.type, width, height };
  }
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const png = await canvas.convertToBlob({ type: "image/png" });
  return { bytes: new Uint8Array(await png.arrayBuffer()), type: "image/png", width, height };
}

async function word(node: TreeNode, app: AppContext) {
  const { title, parts, made } = await partsOf(node, app);
  const pictures = await loadPictures(
    parts.map((p) => p.body),
    made,
  );
  const ready = new Map<string, DocxImage>();
  for (const [id, asset] of pictures) {
    try {
      const png = await asPng(asset);
      ready.set(id, { bytes: png.bytes, ext: png.type === "image/jpeg" ? "jpeg" : png.type === "image/gif" ? "gif" : "png", width: png.width, height: png.height });
    } catch {
      // A picture the browser cannot read is left out rather than failing the whole file.
    }
  }
  const r = { ...resolver(app.tree), picture: (id: string) => ready.get(id) ?? null };
  return buildDocx(title, parts.map((part) => ({ title: part.title, nodes: part.body.content ?? [] })), r);
}

async function ebook(node: TreeNode, app: AppContext) {
  const { title, parts, made } = await partsOf(node, app);
  const pictures = await loadPictures(
    parts.map((p) => p.body),
    made,
  );
  const images: { path: string; bytes: Uint8Array; type: string }[] = [];
  const paths = new Map<string, string>();
  for (const [id, asset] of pictures) {
    try {
      const fit = ["image/svg+xml", "image/webp"].includes(asset.type) ? { bytes: asset.bytes, type: asset.type } : await asPng(asset);
      const path = `images/${id.slice(0, 16)}.${extOf(fit.type)}`;
      paths.set(id, path);
      images.push({ path, bytes: fit.bytes, type: fit.type });
    } catch {
      // Left out, like in Word.
    }
  }
  const r = resolver(app.tree, (id) => paths.get(id) ?? null);
  const chapters = parts.map((part) => ({ title: part.title ?? title, html: toHtml(part.body.content ?? [], r) }));
  return buildEpub(title, "", chapters, images);
}

/** The built-in download formats for notes and books. Plain text comes first: it is the default. */
export const PAGE_FORMATS: Exporter[] = [
  { id: "txt", label: "Plain text (.txt)", extension: "txt", kinds: ["note", "book"], build: plainText },
  {
    id: "md",
    label: "Markdown (.md)",
    extension: "md",
    kinds: ["note", "book"],
    async build(node, app) {
      return (await markdown(node, app)).blob;
    },
  },
  { id: "html", label: "Web page (.html)", extension: "html", kinds: ["note", "book"], build: async (node, app) => text(await htmlPage(node, app), "text/html") },
  { id: "docx", label: "Word (.docx)", extension: "docx", kinds: ["note", "book"], build: word },
  { id: "epub", label: "E-book (.epub)", extension: "epub", kinds: ["book", "note"], build: ebook },
  {
    id: "pdf",
    label: "PDF (opens Print, pick Save as PDF)",
    extension: "pdf",
    kinds: ["note", "book"],
    async build(node, app) {
      await printHtml(await htmlPage(node, app, true));
      return null;
    },
  },
];
