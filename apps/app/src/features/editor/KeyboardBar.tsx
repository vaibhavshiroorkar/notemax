import { useEffect, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import "./keyboard-bar.css";

// Phones have no shortcuts and no right click for formatting, so while the
// note has the keyboard open, a bar of the common actions sits right above it.

const touchScreen = () => window.matchMedia("(pointer: coarse)").matches;

/** Where the bar goes: above the on-screen keyboard, which covers the bottom of the window. */
function useKeyboardOffset(active: boolean) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!active || !viewport) return;
    const place = () => setOffset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    place();
    viewport.addEventListener("resize", place);
    viewport.addEventListener("scroll", place);
    return () => {
      viewport.removeEventListener("resize", place);
      viewport.removeEventListener("scroll", place);
    };
  }, [active]);
  return offset;
}

function listType(editor: Editor) {
  return editor.isActive("taskItem") ? "taskItem" : "listItem";
}

export function KeyboardBar({ editor }: { editor: Editor }) {
  const [focused, setFocused] = useState(false);
  // Redraw on every change of the selection, so the buttons show what is on.
  const [, setTick] = useState(0);
  const active = focused && touchScreen();
  const offset = useKeyboardOffset(active);

  useEffect(() => {
    const onFocus = () => setFocused(true);
    const onBlur = () => setFocused(false);
    const onChange = () => setTick((n) => n + 1);
    editor.on("focus", onFocus);
    editor.on("blur", onBlur);
    editor.on("selectionUpdate", onChange);
    editor.on("transaction", onChange);
    setFocused(editor.isFocused);
    return () => {
      editor.off("focus", onFocus);
      editor.off("blur", onBlur);
      editor.off("selectionUpdate", onChange);
      editor.off("transaction", onChange);
    };
  }, [editor]);

  // The status bar steps aside while the bar is up.
  useEffect(() => {
    if (!active) return;
    document.documentElement.dataset.keyboard = "";
    return () => void delete document.documentElement.dataset.keyboard;
  }, [active]);

  if (!active) return null;

  const run = (action: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => action(editor.chain().focus()).run();
  const level = ([1, 2, 3] as const).find((n) => editor.isActive("heading", { level: n }));
  const inList = editor.isActive("listItem") || editor.isActive("taskItem");

  const button = (label: string, content: ReactNode, onPress: () => void, on = false, disabled = false) => (
    <button
      key={label}
      className="keyboard-bar-button"
      aria-label={label}
      aria-pressed={on || undefined}
      disabled={disabled}
      // Pressing a button must not take the focus, or the keyboard would close.
      onPointerDown={(event) => event.preventDefault()}
      onClick={onPress}
    >
      {content}
    </button>
  );

  return (
    <div className="keyboard-bar" role="toolbar" aria-label="Formatting" style={{ bottom: offset }}>
      {button("Undo", "\u21b6", () => run((c) => c.undo()), false, !editor.can().undo())}
      {button("Redo", "\u21b7", () => run((c) => c.redo()), false, !editor.can().redo())}
      {button(level ? `Heading ${level}, tap for the next size` : "Make a heading", level ? `H${level}` : "H", () =>
        run((c) => (level === 3 ? c.setParagraph() : c.setHeading({ level: ((level ?? 0) + 1) as 1 | 2 | 3 }))),
        !!level,
      )}
      {button("Bold", <b>B</b>, () => run((c) => c.toggleBold()), editor.isActive("bold"))}
      {button("Italic", <i>I</i>, () => run((c) => c.toggleItalic()), editor.isActive("italic"))}
      {button("Bulleted list", "\u2022", () => run((c) => c.toggleBulletList()), editor.isActive("bulletList"))}
      {button("Numbered list", "1.", () => run((c) => c.toggleOrderedList()), editor.isActive("orderedList"))}
      {button("To-do list", "\u2610", () => run((c) => c.toggleTaskList()), editor.isActive("taskList"))}
      {button("Outdent", "\u21e4", () => run((c) => c.liftListItem(listType(editor))), false, !inList)}
      {button("Indent", "\u21e5", () => run((c) => c.sinkListItem(listType(editor))), false, !inList)}
      {button("Link to a page", "[[", () => run((c) => c.insertContent("[[")))}
      {button("Insert a block", "/", () => run((c) => c.insertContent(editor.state.selection.$from.parent.textContent ? " /" : "/")))}
      {button("Hide the keyboard", "\u2304", () => editor.commands.blur())}
    </div>
  );
}
