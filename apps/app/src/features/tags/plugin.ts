import type { Plugin } from "@/plugins/types";
import { addTagRequests, tagFilter } from "./filter";
import { TagBar } from "./TagBar";
import { TagsSection } from "./TagsSection";

export const tagsPlugin: Plugin = {
  id: "tags",
  name: "Tags",
  pageHeader: [{ id: "tags.bar", kinds: ["note", "book"], component: TagBar }],
  sidebarSections: [{ id: "tags.list", order: 50, component: TagsSection }],
  useSidebarFilter() {
    const tags = tagFilter.use();
    if (!tags.length) return null;
    return {
      label: tags.map((tag) => `#${tag}`).join(" "),
      matches: (node) => tags.every((tag) => node.tags.includes(tag)),
      clear: () => tagFilter.set([]),
    };
  },
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
