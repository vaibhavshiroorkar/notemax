import type { Plugin } from "@/plugins/types";
import { addTagRequests, tagFilter } from "./filter";
import { TagBar } from "./TagBar";
import { TagChoices } from "./TagChoices";
import { TagsSection } from "./TagsSection";

export const tagsPlugin: Plugin = {
  id: "tags",
  name: "Tags",
  description: "Tags on pages, and filtering the sidebar by them",
  pageHeader: [{ id: "tags.bar", kinds: ["note", "book", "board"], component: TagBar }],
  sidebarSections: [{ id: "tags.list", order: 50, component: TagsSection }],
  sidebarFilterChoices: [{ id: "tags.choices", component: TagChoices }],
  useSidebarFilter() {
    const tags = tagFilter.use();
    if (!tags.length) return null;
    return {
      label: tags.map((tag) => `#${tag}`).join(" "),
      matches: (node) => tags.every((tag) => node.tags.includes(tag)),
      clear: () => tagFilter.set([]),
    };
  },
  contextMenu: [
    {
      id: "tags.add",
      title: "Add a tag",
      group: "tags",
      targets: ["page"],
      when: (target) => target.type === "page" && target.node.kind !== "folder",
      run(target, app) {
        if (target.type !== "page") return;
        app.open(target.node.id);
        // The tag bar of the page that opens asks for the tag.
        requestAnimationFrame(() => addTagRequests.set(addTagRequests.get() + 1));
      },
    },
  ],
  commands: [
    {
      id: "tags.add",
      title: "Add a tag to this page",
      keywords: ["tag", "label"],
      when: (app) => app.activeId !== null,
      run: () => addTagRequests.set(addTagRequests.get() + 1),
    },
    {
      id: "tags.clear-filter",
      title: "Show all notes again",
      keywords: ["tag", "filter", "clear"],
      when: () => tagFilter.get().length > 0,
      run: () => tagFilter.set([]),
    },
  ],
};
