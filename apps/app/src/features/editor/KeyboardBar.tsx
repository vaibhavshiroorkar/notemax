import { useEffect, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { canListen, listening, startVoice, stopVoice } from "@/features/voice/voice";
import { SIZES, sizeOf } from "@/features/format/styles";
import { Icon, type IconName } from "@/ui/Icon";
import { activeEditor } from "./active";
import "./keyboard-bar.css";

// Phones have no shortcuts and no right click for formatting, so a bar of
// formatting buttons sits below chapter navigation while a note is open.
// It acts on the note being written in, a subtopic's too, and scrolls
// sideways when it does not fit.

const touchScreen = () => window.matchMedia("(pointer: coarse)").matches;

function listType(editor: Editor) {
  return editor.isActive("taskItem") ? "taskItem" : "listItem";
}

const ALIGNS = ["left", "center", "right"] as const;

/** The bar itself. App draws it once, under the tabs, where it takes its own room. */
export function KeyboardBar() {
  const editor = activeEditor.use();
  const hearing = listening.use();
  // Redraw on every change, so the buttons show what is on.
  const [, setTick] = useState(0);
  const touch = touchScreen();

  useEffect(() => {
    if (!editor) return;
    const onChange = () => setTick((n) => n + 1);
    editor.on("selectionUpdate", onChange);
    editor.on("transaction", onChange);
    editor.on("focus", onChange);
    editor.on("blur", onChange);
    return () => {
      editor.off("selectionUpdate", onChange);
      editor.off("transaction", onChange);
      editor.off("focus", onChange);
      editor.off("blur", onChange);
    };
  }, [editor]);

  if (!touch || !editor || editor.isDestroyed || !editor.isEditable) return null;

  const run = (action: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => action(editor.chain().focus()).run();
  const level = ([1, 2, 3] as const).find((n) => editor.isActive("heading", { level: n }));
  const inList = editor.isActive("listItem") || editor.isActive("taskItem");
  const align = ALIGNS.find((a) => editor.isActive({ textAlign: a })) ?? "left";
  const size = sizeOf(editor.getAttributes("textStyle").fontSize as string | undefined);
  const stepSize = (by: 1 | -1) => {
    const now = size || Math.round(parseFloat(getComputedStyle(editor.view.dom).fontSize)) || 16;
    const at = SIZES.findIndex((s) => s >= now);
    const next = SIZES[Math.max(0, Math.min(SIZES.length - 1, (at < 0 ? SIZES.length - 1 : at) + by))];
    run((c) => c.setFontSize(`${next}px`));
  };

  const button = (label: string, content: ReactNode, onPress: () => void, on = false, disabled = false) => (
    <button
      key={label}
      className="keyboard-bar-button"
      aria-label={label}
      title={label}
      aria-pressed={on || undefined}
      disabled={disabled}
      // Pressing a button must not take the focus, or the keyboard would close.
      onPointerDown={(event) => event.preventDefault()}
      onClick={onPress}
    >
      {content}
    </button>
  );
  const icon = (name: IconName) => <Icon name={name} />;
  const line = <span className="keyboard-bar-line" aria-hidden="true" />;

  const bar = (
    <div className="keyboard-bar" role="toolbar" aria-label="Formatting">
      {button("Undo", icon("restore"), () => run((c) => c.undo()), false, !editor.can().undo())}
      {button("Redo", <span className="keyboard-bar-flip">{icon("restore")}</span>, () => run((c) => c.redo()), false, !editor.can().redo())}
      {canListen() && button(hearing ? "Stop voice typing" : "Voice typing", icon("mic"), () => (hearing ? stopVoice() : startVoice(editor)), hearing)}
      {line}
      {button(level ? `Heading ${level}, tap for the next size` : "Make a heading", level ? `H${level}` : "H", () =>
        run((c) => (level === 3 ? c.setParagraph() : c.setHeading({ level: ((level ?? 0) + 1) as 1 | 2 | 3 }))),
        !!level,
      )}
      {button("Bold", <b>B</b>, () => run((c) => c.toggleBold()), editor.isActive("bold"))}
      {button("Italic", <i>I</i>, () => run((c) => c.toggleItalic()), editor.isActive("italic"))}
      {button("Underline", <u>U</u>, () => run((c) => c.toggleUnderline()), editor.isActive("underline"))}
      {button("Strikethrough", <s>S</s>, () => run((c) => c.toggleStrike()), editor.isActive("strike"))}
      {button("Highlight", <span className="keyboard-bar-mark">A</span>, () => run((c) => c.toggleHighlight()), editor.isActive("highlight"))}
      {button("Smaller text", <span className="keyboard-bar-small">A-</span>, () => stepSize(-1))}
      <select className="keyboard-bar-size" aria-label="Font size" value={size} onChange={(event) => {
        const next = Number(event.target.value);
        run((chain) => next ? chain.setFontSize(`${next}px`) : chain.unsetFontSize());
      }}>
        <option value={0}>Default</option>
        {size > 0 && !SIZES.includes(size) && <option value={size}>{size}</option>}
        {SIZES.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
      {button("Bigger text", <span className="keyboard-bar-small">A+</span>, () => stepSize(1))}
      {line}
      {button("Bulleted list", icon("list-bullet"), () => run((c) => c.toggleBulletList()), editor.isActive("bulletList"))}
      {button("Numbered list", icon("list-number"), () => run((c) => c.toggleOrderedList()), editor.isActive("orderedList"))}
      {button("To-do list", icon("list-check"), () => run((c) => c.toggleTaskList()), editor.isActive("taskList"))}
      {button("Outdent", icon("outdent"), () => run((c) => c.liftListItem(listType(editor))), false, !inList)}
      {button("Indent", icon("indent"), () => run((c) => c.sinkListItem(listType(editor))), false, !inList)}
      {line}
      {button(`Align ${align}, tap for the next`, icon(`align-${align}`), () => run((c) => c.setTextAlign(ALIGNS[(ALIGNS.indexOf(align) + 1) % ALIGNS.length])), align !== "left")}
      {button("Quote", icon("quote"), () => run((c) => c.toggleBlockquote()), editor.isActive("blockquote"))}
      {button("Code block", icon("code"), () => run((c) => c.toggleCodeBlock()), editor.isActive("codeBlock"))}
      {button("Link to a page", "[[", () => run((c) => c.insertContent("[[")))}
      {button("Insert a block", "/", () => run((c) => c.insertContent(editor.state.selection.$from.parent.textContent ? " /" : "/")))}
      {button("Clear formatting", icon("close"), () => run((c) => c.unsetAllMarks().unsetFontSize().unsetFontFamily()))}
      {editor.isFocused && button("Hide the keyboard", icon("chevron-down"), () => editor.commands.blur())}
    </div>
  );
  return bar;
}
