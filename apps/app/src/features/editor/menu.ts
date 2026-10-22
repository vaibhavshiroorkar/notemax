import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/core";
import type { AppContext, ContextMenuItem, ContextTarget } from "@/plugins/types";
import { askText } from "@/ui/Prompt";

const editorOf = (target: ContextTarget): Editor | null => (target.type === "editor" ? target.editor : null);

/** Text is selected, not a whole node like a picture. */
const textSelected = (target: ContextTarget) => {
  const editor = editorOf(target);
  if (!editor) return false;
  const { selection } = editor.state;
  return !selection.empty && !(selection instanceof NodeSelection);
};

const nodeSelected = (target: ContextTarget) => editorOf(target)?.state.selection instanceof NodeSelection;
const inCode = (target: ContextTarget) => !!editorOf(target)?.isActive("codeBlock");

/**
 * Pastes what is on the clipboard as if Ctrl+V was pressed: the same paste
 * rules run, so pictures, links and formatting come in the same way.
 */
async function paste(editor: Editor, app: AppContext, plain: boolean) {
  try {
    const data = new DataTransfer();
    if (plain) {
      editor.view.pasteText(await navigator.clipboard.readText());
      return;
    }
    for (const item of await navigator.clipboard.read()) {
      for (const type of item.types) {
        const blob = await item.getType(type);
        if (type.startsWith("image/")) data.items.add(new File([blob], `pasted.${type.split("/")[1]}`, { type }));
        else if (type === "text/html" || type === "text/plain") data.setData(type, await blob.text());
      }
    }
    editor.view.focus();
    editor.view.dom.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  } catch {
    app.notify(`This window may not read the clipboard. Press ${navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+V${plain ? " with Shift" : ""} instead.`);
  }
}

/** Runs a browser clipboard action on the editor, which handles the copy itself. */
const clipboard = (editor: Editor, action: "cut" | "copy") => {
  editor.view.focus();
  document.execCommand(action);
};

const turnInto = (id: string, title: string, run: (e: Editor) => void, active: (e: Editor) => boolean): ContextMenuItem => ({
  id: `editor.turn.${id}`,
  title,
  group: "block",
  targets: ["editor"],
  disabled: (target) => active(editorOf(target)!),
  run: (target) => run(editorOf(target)!),
});

const mark = (id: string, title: string, keys: string, toggle: (e: Editor) => void): ContextMenuItem => ({
  id: `editor.mark.${id}`,
  title,
  keys,
  group: "format",
  targets: ["editor"],
  when: (target) => textSelected(target) && !inCode(target),
  run: (target) => toggle(editorOf(target)!),
});

/** What a right click inside a note offers. Pictures and links add their own items. */
export const EDITOR_MENU: ContextMenuItem[] = [
  {
    id: "editor.cut",
    title: "Cut",
    keys: "Mod+X",
    group: "clipboard",
    targets: ["editor"],
    disabled: (target) => editorOf(target)!.state.selection.empty,
    run: (target) => clipboard(editorOf(target)!, "cut"),
  },
  {
    id: "editor.copy",
    title: "Copy",
    keys: "Mod+C",
    group: "clipboard",
    targets: ["editor"],
    disabled: (target) => editorOf(target)!.state.selection.empty,
    run: (target) => clipboard(editorOf(target)!, "copy"),
  },
  { id: "editor.paste", title: "Paste", keys: "Mod+V", group: "clipboard", targets: ["editor"], run: (target, app) => void paste(editorOf(target)!, app, false) },
  {
    id: "editor.paste-plain",
    title: "Paste as plain text",
    keys: "Mod+Shift+V",
    group: "clipboard",
    targets: ["editor"],
    run: (target, app) => void paste(editorOf(target)!, app, true),
  },
  mark("bold", "Bold", "Mod+B", (e) => e.chain().focus().toggleBold().run()),
  mark("italic", "Italic", "Mod+I", (e) => e.chain().focus().toggleItalic().run()),
  mark("underline", "Underline", "Mod+U", (e) => e.chain().focus().toggleUnderline().run()),
  mark("strike", "Strikethrough", "Mod+Shift+S", (e) => e.chain().focus().toggleStrike().run()),
  mark("code", "Code", "Mod+E", (e) => e.chain().focus().toggleCode().run()),
  {
    id: "editor.clear",
    title: "Clear formatting",
    group: "format",
    targets: ["editor"],
    when: textSelected,
    run: (target) => editorOf(target)!.chain().focus().unsetAllMarks().run(),
  },
  {
    id: "editor.web-link",
    title: "Link to a web address...",
    group: "link",
    icon: "link",
    targets: ["editor"],
    when: (target) => textSelected(target) && !editorOf(target)!.isActive("link"),
    async run(target) {
      const editor = editorOf(target)!;
      const { from, to } = editor.state.selection;
      const href = await askText({ title: "Link", label: "Web address", placeholder: "https://", confirm: "Add link" });
      if (!href?.trim()) return;
      const url = /^[a-z][a-z0-9+.-]*:/i.test(href.trim()) ? href.trim() : `https://${href.trim()}`;
      editor.chain().focus().setTextSelection({ from, to }).setLink({ href: url }).run();
    },
  },
  {
    id: "editor.open-web-link",
    title: "Open link",
    group: "link",
    icon: "link",
    targets: ["editor"],
    when: (target) => !!editorOf(target)?.isActive("link"),
    run(target) {
      const href = editorOf(target)!.getAttributes("link").href as string | undefined;
      if (href) window.open(href, "_blank", "noopener,noreferrer");
    },
  },
  {
    id: "editor.remove-web-link",
    title: "Remove link",
    group: "link",
    targets: ["editor"],
    when: (target) => !!editorOf(target)?.isActive("link"),
    run: (target) => editorOf(target)!.chain().focus().extendMarkRange("link").unsetLink().run(),
  },
  {
    id: "editor.turn-into",
    title: "Turn into",
    group: "block",
    targets: ["editor"],
    when: (target) => !nodeSelected(target),
    submenu: () => [
      turnInto("text", "Text", (e) => e.chain().focus().setParagraph().run(), (e) => e.isActive("paragraph") && !e.isActive("bulletList") && !e.isActive("orderedList") && !e.isActive("taskList") && !e.isActive("blockquote")),
      ...[1, 2, 3].map((level) =>
        turnInto(`h${level}`, `Heading ${level}`, (e) => e.chain().focus().setHeading({ level: level as 1 | 2 | 3 }).run(), (e) => e.isActive("heading", { level })),
      ),
      turnInto("bullets", "Bulleted list", (e) => e.chain().focus().toggleBulletList().run(), (e) => e.isActive("bulletList")),
      turnInto("numbers", "Numbered list", (e) => e.chain().focus().toggleOrderedList().run(), (e) => e.isActive("orderedList")),
      turnInto("todo", "To-do list", (e) => e.chain().focus().toggleTaskList().run(), (e) => e.isActive("taskList")),
      turnInto("quote", "Quote", (e) => e.chain().focus().toggleBlockquote().run(), (e) => e.isActive("blockquote")),
      turnInto("code", "Code block", (e) => e.chain().focus().toggleCodeBlock().run(), (e) => e.isActive("codeBlock")),
    ],
  },
  {
    id: "editor.insert",
    title: "Insert",
    group: "insert",
    targets: ["editor"],
    submenu: () => [
      {
        id: "editor.insert.divider",
        title: "Divider",
        group: "insert",
        targets: ["editor"],
        run: (target) => editorOf(target)!.chain().focus().setHorizontalRule().run(),
      },
      {
        id: "editor.insert.code",
        title: "Code block",
        group: "insert",
        targets: ["editor"],
        run: (target) => editorOf(target)!.chain().focus().setCodeBlock().run(),
      },
      {
        id: "editor.insert.date",
        title: "Today's date",
        group: "insert",
        targets: ["editor"],
        run: (target) => editorOf(target)!.chain().focus().insertContent(new Date().toLocaleDateString()).run(),
      },
    ],
  },
  { id: "editor.select-all", title: "Select all", keys: "Mod+A", group: "select", targets: ["editor"], run: (target) => editorOf(target)!.chain().focus().selectAll().run() },
];
