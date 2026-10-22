import type { Asset, TreeItem, TreeNode } from "@notemax/core";
import { savedStore } from "@/platform/store";
import { registry } from "@/plugins/registry";
import type { AppContext, Exporter } from "@/plugins/types";
import { chaptersOf, extOf, fileName, loadBody, loadPictures } from "./content";
import { saveFile } from "./save";
import { toMarkdown } from "./serialize";
import { zip, type ZipEntry } from "./zip";

/** The format "Download" uses when none is picked. Plain text unless the user chose another. */
export const defaultFormat = savedStore<string>("downloadFormat", "txt", { decode: (raw) => raw, encode: (value) => value });

export const formatsFor = (kind: TreeNode["kind"]): Exporter[] => registry.exporters(kind);

/** The default format for this kind of page, or its first one when the default does not apply. */
export function defaultFor(kind: TreeNode["kind"]): Exporter | undefined {
  const formats = formatsFor(kind);
  return formats.find((f) => f.id === defaultFormat.get()) ?? formats[0];
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function download(node: TreeNode, app: AppContext, exporter = defaultFor(node.kind)) {
  if (!exporter) return app.notify("This page has nothing to download.");
  try {
    const blob = await exporter.build(node, app);
    if (!blob) return;
    // Formats that need extra files, like Markdown with pictures, come as a .zip.
    const ext = blob.type === "application/zip" && exporter.extension !== "zip" ? "zip" : exporter.extension;
    const name = fileName(node.title || `Untitled ${node.kind}`, ext);
    if (await saveFile(blob, name)) app.notify(`Downloaded ${name}`);
  } catch (error) {
    app.notify(`Could not download: ${message(error)}`);
  }
}

const safe = (title: string) => title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 100) || "Untitled";

/**
 * Every page as files in folders, like a vault: notes and chapters as
 * Markdown, links as [[Title]], pictures in one attachments folder, and other
 * kinds in their own format. Opens as-is in Obsidian and most Markdown apps.
 */
export async function downloadEverything(app: AppContext, from: TreeItem[] = app.tree.top, label = "Notemax") {
  try {
    const entries: ZipEntry[] = [];
    const taken = new Set<string>();
    const pictures = new Map<string, Asset>();
    const unique = (path: string) => {
      let candidate = path;
      for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = path.replace(/(\.[^./]+)?$/, ` ${n}$1`);
      taken.add(candidate.toLowerCase());
      return candidate;
    };

    const markdownFile = async (id: string, path: string, heading?: string) => {
      const body = await loadBody(id);
      for (const [asset, file] of await loadPictures([body])) pictures.set(asset, file);
      // Links to pictures are relative to the file, so they work from any folder.
      const up = "../".repeat(path.split("/").length - 1);
      const md = toMarkdown(body, {
        title: (target) => (app.tree.byId.has(target) ? app.tree.byId.get(target)!.title || "Untitled" : null),
        image: (asset) => (pictures.has(asset) ? `${up}attachments/${asset.slice(0, 16)}.${extOf(pictures.get(asset)!.type)}` : null),
      });
      entries.push({ path: unique(path), data: heading ? `# ${heading}\n\n${md}` : md });
    };

    const walk = async (items: TreeItem[], dir: string) => {
      for (const item of items) {
        const node = app.tree.byId.get(item.id);
        if (!node) continue;
        const title = safe(node.title);
        if (node.kind === "folder") await walk(item.children, `${dir}${title}/`);
        else if (node.kind === "book") {
          const chapters = chaptersOf(app.tree, node.id);
          for (const [i, chapter] of chapters.entries()) {
            const name = app.tree.byId.get(chapter.id)?.title || "Untitled";
            await markdownFile(chapter.id, `${dir}${title}/${String(i + 1).padStart(2, "0")} ${safe(name)}.md`, name);
          }
          if (!chapters.length) entries.push({ path: unique(`${dir}${title}/`), data: "" });
        } else if (node.kind === "note") await markdownFile(node.id, `${dir}${title}.md`);
        else {
          // Boards and kinds from plugins: their Markdown if they have one, else their first format.
          const formats = formatsFor(node.kind);
          const exporter = formats.find((f) => f.id === "md") ?? formats.find((f) => f.id === "excalidraw") ?? formats[0];
          const blob = exporter && (await exporter.build(node, app));
          if (blob) entries.push({ path: unique(`${dir}${title}.${exporter!.extension}`), data: new Uint8Array(await blob.arrayBuffer()) });
        }
      }
    };
    await walk(from, "");
    for (const [asset, file] of pictures) entries.push({ path: `attachments/${asset.slice(0, 16)}.${extOf(file.type)}`, data: file.bytes });
    const date = new Date().toISOString().slice(0, 10);
    const name = `${safe(label)} ${date}.zip`;
    if (await saveFile(zip(entries.filter((e) => !e.path.endsWith("/"))), name)) app.notify(`Downloaded ${name}`);
  } catch (error) {
    app.notify(`Could not download: ${message(error)}`);
  }
}
