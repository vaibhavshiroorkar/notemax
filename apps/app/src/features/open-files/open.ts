import { ROOT, createNode, holds, moveNodes, openLocalDoc, renameNode, type NodeKind, type TreeNode } from "@notemax/core";
import { prosemirrorJSONToYXmlFragment } from "@tiptap/y-tiptap";
import type * as Y from "yjs";
import { pickExcalidraw } from "@/features/boards/import";
import { bodySchema, htmlToBody } from "@/features/editor/schema";
import { saveImage } from "@/features/images/store";
import { fileToBody, splitFront } from "@/features/markdown-files/convert";
import { docChannelFor, storeFor } from "@/platform/platform";
import type { AppContext } from "@/plugins/types";

// Files from the computer, opened as pages: Markdown, text, Word and web
// pages as notes, code files as code pages in their language, pictures as
// a note holding the picture, and Excalidraw drawings as boards. The file on
// the computer is only read, never changed.

export type FileGroup = "notes" | "code" | "pictures" | "drawings";

export const GROUPS: { id: FileGroup; title: string; accept: string }[] = [
  { id: "notes", title: "Notes (Markdown, text, Word, web page)...", accept: ".md,.markdown,.txt,.text,.docx,.html,.htm" },
  { id: "code", title: "Code files...", accept: ".py,.js,.mjs,.ts,.tsx,.jsx,.sql,.cpp,.cc,.cxx,.c,.h,.hpp,.java" },
  { id: "pictures", title: "Pictures...", accept: "image/*" },
  { id: "drawings", title: "Excalidraw drawings...", accept: ".excalidraw,application/json" },
];

const CODE_LANGUAGES: Record<string, string> = {
  py: "python",
  js: "javascript",
  mjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  sql: "sql",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  c: "cpp",
  h: "cpp",
  hpp: "cpp",
  java: "java",
};

const extensionOf = (name: string) => name.toLowerCase().split(".").pop() ?? "";
const baseName = (name: string) => name.replace(/\.[^.]+$/, "");

/** Where new pages go: beside a page of the tree, if its parent may hold the kind, or at the end of the top level. */
function placeFor(app: AppContext, near: TreeNode | null, kind: NodeKind): { parentId: string; nextId: string | null } {
  if (!near) return { parentId: ROOT, nextId: null };
  const parent = app.tree.byId.get(near.parentId);
  if (parent && (!holds(parent.kind, kind) || (kind === "folder" && parent.kind !== "folder"))) return { parentId: ROOT, nextId: null };
  const siblings = parent ? (app.tree.items.get(parent.id)?.children ?? []) : app.tree.top;
  const next = siblings[siblings.findIndex((item) => item.id === near.id) + 1];
  return { parentId: near.parentId, nextId: next?.id ?? null };
}

async function withBody(app: AppContext, id: string, write: (doc: Y.Doc) => void) {
  const local = await openLocalDoc(await storeFor(app.workspace), id, { broadcast: docChannelFor(app.workspace) });
  try {
    local.doc.transact(() => write(local.doc));
  } finally {
    await local.close();
  }
}

const writeBody = (body: object) => (doc: Y.Doc) => prosemirrorJSONToYXmlFragment(bodySchema(), body, doc.getXmlFragment("content"));

/** The text of a plain file, a paragraph per line, as safe HTML. */
const textToHtml = (text: string) =>
  text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
    .join("");

/** Makes the page for one file and fills it. Returns its id, or null when the file is not one this can open. */
async function openFile(app: AppContext, file: File, near: TreeNode | null): Promise<string | null> {
  const extension = extensionOf(file.name);
  const title = baseName(file.name);
  const make = (kind: NodeKind) => {
    const { parentId, nextId } = placeFor(app, near, kind);
    const id = createNode(app.doc, kind, parentId, title);
    if (nextId) moveNodes(app.doc, [id], parentId, nextId);
    return id;
  };

  if (CODE_LANGUAGES[extension]) {
    const id = make("code");
    // Windows line ends become plain ones, as the editor writes them.
    const code = (await file.text()).split(String.fromCharCode(13)).join("");
    await withBody(app, id, (doc) => {
      doc.getText("code").insert(0, code);
      doc.getMap<string>("settings").set("language", CODE_LANGUAGES[extension]);
    });
    return id;
  }
  if (file.type.startsWith("image/")) {
    const asset = await saveImage(file, file.name, app.workspace);
    const id = make("note");
    await withBody(app, id, writeBody({ type: "doc", content: [{ type: "image", attrs: { asset, alt: title } }] }));
    return id;
  }
  if (extension === "md" || extension === "markdown") {
    const { front, markdown } = splitFront(await file.text());
    const body = await fileToBody(markdown, app.tree, async () => null);
    const id = make("note");
    if (front.title) renameNode(app.doc, id, front.title);
    await withBody(app, id, writeBody(body));
    return id;
  }
  if (extension === "txt" || extension === "text") {
    const id = make("note");
    await withBody(app, id, writeBody(htmlToBody(textToHtml(await file.text()))));
    return id;
  }
  if (extension === "html" || extension === "htm") {
    const page = new DOMParser().parseFromString(await file.text(), "text/html");
    const id = make("note");
    if (page.title) renameNode(app.doc, id, page.title);
    await withBody(app, id, writeBody(htmlToBody(page.body.innerHTML)));
    return id;
  }
  if (extension === "docx") {
    // Loaded on first use: only opening a Word file needs it.
    const { convertToHtml } = await import("mammoth");
    const { value } = await convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    const id = make("note");
    await withBody(app, id, writeBody(htmlToBody(value)));
    return id;
  }
  return null;
}

/** Opens each file as a page, then shows the last one. */
export async function openFiles(app: AppContext, files: File[], near: TreeNode | null) {
  let last: string | null = null;
  const skipped: string[] = [];
  for (const file of files) {
    try {
      const id = await openFile(app, file, near);
      if (id) last = id;
      else skipped.push(file.name);
    } catch (error) {
      app.notify(`Could not open ${file.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (skipped.length) app.notify(`Notemax cannot open ${skipped.join(", ")}`);
  if (last) app.open(last);
}

/** Asks the system for files of one kind and opens them. */
export function pickFiles(app: AppContext, group: FileGroup, near: TreeNode | null) {
  if (group === "drawings") return pickExcalidraw(app);
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = GROUPS.find((g) => g.id === group)!.accept;
  input.onchange = () => void openFiles(app, [...(input.files ?? [])], near);
  input.click();
}
