import { NodeSelection } from "@tiptap/pm/state";
import { WIKI_LINK } from "@notemax/core";
import type { ContextTarget, Plugin } from "@/plugins/types";
import { Backlinks } from "./Backlinks";
import { WikiLink } from "./wiki-link";

export const linksPlugin: Plugin = {
  id: "links",
  name: "Links between notes",
  description: "[[ links to other pages, and the list of pages that link here",
  pageFooter: [{ id: "links.backlinks", kinds: ["note"], component: Backlinks }],
  contextMenu: [
    {
      id: "links.to-page",
      title: "Link to a page",
      keys: "[[",
      group: "link",
      icon: "link",
      targets: ["editor"],
      when: (target) => target.type === "editor" && !target.editor.isActive("codeBlock") && !linkUnder(target),
      run(target) {
        if (target.type !== "editor") return;
        const { editor } = target;
        // Selected text becomes the search, so "Paris" finds the page called Paris.
        const { from, to, empty } = editor.state.selection;
        const words = empty ? "" : editor.state.doc.textBetween(from, to, " ");
        editor.chain().focus().insertContentAt({ from, to }, `[[${words}`).run();
      },
    },
    {
      id: "links.open",
      title: "Open linked page",
      group: "link",
      icon: "page",
      targets: ["editor"],
      when: (target) => !!linkUnder(target),
      run: (target, app) => app.open(linkUnder(target)!.attrs.targetId as string),
    },
    {
      id: "links.unlink",
      title: "Turn link into text",
      group: "link",
      targets: ["editor"],
      when: (target) => !!linkUnder(target),
      run(target, app) {
        if (target.type !== "editor") return;
        const node = linkUnder(target)!;
        const title = app.tree.byId.get(node.attrs.targetId as string)?.title || (node.attrs.label as string) || "";
        const { from, to } = target.editor.state.selection;
        target.editor.chain().focus().insertContentAt({ from, to }, title).run();
      },
    },
  ],
  shortcutHints: [{ title: "Link to another note", keys: "[[" }],
  contentExtensions: ({ hub, noteId, on }) => [WikiLink.configure({ hub, currentId: noteId, menu: on })],
};

/** The [[link]] the right click selected, if any. */
function linkUnder(target: ContextTarget) {
  if (target.type !== "editor") return null;
  const { selection } = target.editor.state;
  return selection instanceof NodeSelection && selection.node.type.name === WIKI_LINK ? selection.node : null;
}
