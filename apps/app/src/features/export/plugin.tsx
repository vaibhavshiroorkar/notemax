import type { TreeNode } from "@notemax/core";
import type { AppContext, ContextMenuItem, ContextTarget, Plugin } from "@/plugins/types";
import { openContextMenu } from "@/ui/ContextMenu";
import { Icon } from "@/ui/Icon";
import { defaultFor, defaultFormat, download, downloadEverything, formatsFor } from "./download";
import { PAGE_FORMATS } from "./formats";

const nodeOf = (target: ContextTarget): TreeNode | null => (target.type === "page" || target.type === "download" ? target.node : null);

/** One menu item per format this page has, the default first and marked. */
function formatItems(target: ContextTarget, app: AppContext): ContextMenuItem[] {
  const node = nodeOf(target);
  if (!node) return [];
  const first = defaultFor(node.kind);
  const formats = formatsFor(node.kind);
  return [first!, ...formats.filter((f) => f !== first)].filter(Boolean).map((format) => ({
    id: `downloads.${format.id}`,
    title: format === first ? `${format.label}, default` : format.label,
    group: format === first ? "default" : "other",
    targets: [target.type],
    run: () => void download(node, app, format),
  }));
}

/** The download button at the top right of a page. */
function DownloadButton({ node }: { node: TreeNode; app: AppContext }) {
  if (!formatsFor(node.kind).length) return null;
  return (
    <button
      className="icon-button"
      aria-label="Download this page"
      aria-haspopup="menu"
      title="Download"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        openContextMenu({ type: "download", node }, rect.right - 220, rect.bottom + 4);
      }}
    >
      <Icon name="download" />
    </button>
  );
}

function DownloadsSection() {
  const format = defaultFormat.use();
  // Formats any built-in page kind offers, without repeats, for the default picker.
  const all = [...new Map(["note", "book", "board"].flatMap((kind) => formatsFor(kind as TreeNode["kind"])).map((f) => [f.id, f])).values()];
  return (
    <>
      <p>Download a page from its menu (right click it), from the button at the top right of a page, or with Ctrl+Shift+E.</p>
      <label className="settings-row">
        <span>
          Default format
          <span className="settings-description">Used by Ctrl+Shift+E. Pages that cannot be saved this way use their first format.</span>
        </span>
        <select className="settings-select" value={format} onChange={(event) => defaultFormat.set(event.target.value)}>
          {all.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

export const downloadsPlugin: Plugin = {
  id: "downloads",
  name: "Downloads",
  description: "Save pages as text, Markdown, Word, PDF, EPUB and more, or everything at once",
  exporters: PAGE_FORMATS,
  pageCorner: [{ id: "downloads.button", component: DownloadButton }],
  settings: [{ id: "downloads", order: 60, title: "Downloads", icon: "download", keywords: ["export", "save", "markdown", "pdf", "word", "epub", "backup"], component: DownloadsSection }],
  options: [
    {
      id: "askWhere",
      label: "Ask where to save each download",
      description: "Opens a Save dialog instead of using the downloads folder",
      section: "downloads",
      default: false,
    },
  ],
  commands: [
    {
      id: "downloads.page",
      title: "Download this page",
      keywords: ["export", "save", "text", "markdown"],
      shortcut: "Mod+Shift+E",
      when: (app) => !!app.activeId && formatsFor(app.tree.byId.get(app.activeId)!.kind).length > 0,
      run: (app) => void download(app.tree.byId.get(app.activeId!)!, app),
    },
    {
      id: "downloads.page-as",
      title: "Download this page as...",
      keywords: ["export", "format", "pdf", "word", "docx", "epub", "html"],
      when: (app) => !!app.activeId && formatsFor(app.tree.byId.get(app.activeId)!.kind).length > 0,
      run(app) {
        const button = document.querySelector('[aria-label="Download this page"]')?.getBoundingClientRect();
        openContextMenu({ type: "download", node: app.tree.byId.get(app.activeId!)! }, button ? button.right - 220 : innerWidth / 2 - 110, button ? button.bottom + 4 : 80);
      },
    },
    {
      id: "downloads.everything",
      title: "Download everything as Markdown (.zip)",
      keywords: ["export", "backup", "obsidian", "all", "vault"],
      run: (app) => void downloadEverything(app),
    },
  ],
  contextMenu: [
    { id: "downloads.formats", title: "Formats", group: "formats", targets: ["download"], items: formatItems },
    {
      id: "downloads.as",
      title: "Download as",
      group: "share",
      icon: "download",
      targets: ["page"],
      when: (target) => !!nodeOf(target) && formatsFor(nodeOf(target)!.kind).length > 0,
      submenu: formatItems,
    },
    {
      id: "downloads.folder",
      title: "Download folder as Markdown (.zip)",
      group: "share",
      icon: "download",
      targets: ["page"],
      when: (target) => nodeOf(target)?.kind === "folder",
      run(target, app) {
        const node = nodeOf(target)!;
        void downloadEverything(app, app.tree.items.get(node.id)?.children ?? [], node.title || "Folder");
      },
    },
    {
      id: "downloads.everything",
      title: "Download everything as Markdown (.zip)",
      group: "share",
      icon: "download",
      targets: ["sidebar"],
      run: (_target, app) => void downloadEverything(app),
    },
  ],
};
