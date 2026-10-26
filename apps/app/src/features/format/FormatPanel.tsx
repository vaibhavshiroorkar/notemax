import type { ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { activeEditor } from "@/features/editor/active";
import { FONTS as NOTE_FONTS, font as noteFont, fontFile } from "@/ui/appearance";
import { Icon } from "@/ui/Icon";
import { COLORS, FONTS, HIGHLIGHTS, LINE_HEIGHTS, SIZES, sizeOf } from "./styles";

type Chain = ReturnType<Editor["chain"]>;

/** What the selection looks like now, read on every change so the panel follows the cursor. */
function useFormat(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const style = e.getAttributes("textStyle");
      const block = e.isActive("heading", { level: 1 }) ? "h1" : e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : "p";
      const align = (["center", "right", "justify"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left";
      return {
        block,
        font: (style.fontFamily as string | undefined) ?? "",
        size: sizeOf(style.fontSize as string | undefined),
        // The size the text at the cursor is drawn at, for text with no size of its own.
        shownSize: shownSizeAt(e),
        color: (style.color as string | undefined) ?? "",
        lineHeight: ((e.isActive("heading") ? e.getAttributes("heading") : e.getAttributes("paragraph")).lineSpacing as string | null | undefined) ?? "",
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        highlight: (e.getAttributes("highlight").color as string | undefined) ?? (e.isActive("highlight") ? "yes" : ""),
        align,
        bullet: e.isActive("bulletList"),
        ordered: e.isActive("orderedList"),
        task: e.isActive("taskList"),
      };
    },
  });
}

/** The size in pixels the text at the cursor shows at, headings and the note's own size included. */
function shownSizeAt(editor: Editor): number {
  try {
    const { node } = editor.view.domAtPos(editor.state.selection.from);
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    return element ? Math.round(parseFloat(getComputedStyle(element).fontSize)) || 16 : 16;
  } catch {
    return 16;
  }
}

/** The note font's name, as Settings, Appearance calls it. */
function useNoteFontName(): string {
  const chosen = noteFont.use();
  const file = fontFile.use();
  if (chosen === "file") return file?.name ?? "Your font";
  if (chosen.startsWith("custom:")) return chosen.slice("custom:".length);
  return NOTE_FONTS[chosen as keyof typeof NOTE_FONTS]?.label ?? "Sans";
}

function Toggle({ label, on, onClick, children, disabled, title }: { label: string; on: boolean; onClick(): void; children: ReactNode; disabled?: boolean; title?: string }) {
  return (
    <button className="format-toggle" aria-label={label} title={title ?? label} aria-pressed={on} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

function Swatches({ label, value, colors, onPick }: { label: string; value: string; colors: readonly { name: string; value: string }[]; onPick(value: string): void }) {
  return (
    <div className="format-swatches" role="group" aria-label={label}>
      {colors.map((color) => (
        <button
          key={color.name}
          className="format-swatch"
          aria-label={`${label}: ${color.name}`}
          title={color.name}
          aria-pressed={value === color.value}
          style={color.value ? { background: color.value } : undefined}
          data-none={!color.value || undefined}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(color.value)}
        />
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="format-row">
      <span className="format-label">{label}</span>
      <div className="format-controls">{children}</div>
    </div>
  );
}

function Controls({ editor }: { editor: Editor }) {
  const f = useFormat(editor);
  const noteFontName = useNoteFontName();
  // Text with no size of its own shows the size it is drawn at.
  const size = f.size || f.shownSize;
  const run = (change: (chain: Chain) => Chain) => change(editor.chain().focus()).run();
  const stepSize = (by: 1 | -1) => {
    const at = SIZES.findIndex((s) => s >= size);
    const next = SIZES[Math.max(0, Math.min(SIZES.length - 1, (at < 0 ? SIZES.length - 1 : at) + by))];
    run((c) => c.setFontSize(`${next}px`));
  };

  return (
    <div className="format">
      <Row label="Style">
        <select
          aria-label="Paragraph style"
          value={f.block}
          onChange={(event) => {
            const value = event.target.value;
            run((c) => (value === "p" ? c.setParagraph() : c.setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 })));
          }}
        >
          <option value="p">Text</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
      </Row>
      <Row label="Font">
        <select aria-label="Font" value={f.font} onChange={(event) => run((c) => (event.target.value ? c.setFontFamily(event.target.value) : c.unsetFontFamily()))}>
          {FONTS.map((font) => (
            <option key={font.name} value={font.value} style={font.value ? { fontFamily: font.value } : undefined}>
              {font.value ? font.name : `${noteFontName} (note font)`}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Size">
        <button className="format-toggle" aria-label="Smaller text" title="Smaller" onMouseDown={(event) => event.preventDefault()} onClick={() => stepSize(-1)}>
          <Icon name="minus" />
        </button>
        <select aria-label="Text size" value={size} onChange={(event) => run((c) => (Number(event.target.value) === 0 ? c.unsetFontSize() : c.setFontSize(`${event.target.value}px`)))}>
          {[...new Set([...SIZES, size])].sort((a, b) => a - b).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          {f.size !== 0 && <option value={0}>Back to the note's size</option>}
        </select>
        <button className="format-toggle" aria-label="Bigger text" title="Bigger" onMouseDown={(event) => event.preventDefault()} onClick={() => stepSize(1)}>
          <Icon name="plus" />
        </button>
      </Row>
      <Row label="Text">
        {/* A heading is bold already, so Bold there would add a mark that changes nothing. */}
        <Toggle label="Bold" on={f.bold || f.block !== "p"} disabled={f.block !== "p" && !f.bold} title={f.block !== "p" && !f.bold ? "Headings are bold already" : undefined} onClick={() => run((c) => c.toggleBold())}>
          <b>B</b>
        </Toggle>
        <Toggle label="Italic" on={f.italic} onClick={() => run((c) => c.toggleItalic())}>
          <i>I</i>
        </Toggle>
        <Toggle label="Underline" on={f.underline} onClick={() => run((c) => c.toggleUnderline())}>
          <u>U</u>
        </Toggle>
        <Toggle label="Strikethrough" on={f.strike} onClick={() => run((c) => c.toggleStrike())}>
          <s>S</s>
        </Toggle>
      </Row>
      <Row label="Color">
        <Swatches label="Text color" value={f.color} colors={COLORS} onPick={(value) => run((c) => (value ? c.setColor(value) : c.unsetColor()))} />
      </Row>
      <Row label="Highlight">
        <Swatches label="Highlight" value={f.highlight} colors={HIGHLIGHTS} onPick={(value) => run((c) => (value ? c.setHighlight({ color: value }) : c.unsetHighlight()))} />
      </Row>
      <Row label="Align">
        {(["left", "center", "right", "justify"] as const).map((align) => (
          <Toggle key={align} label={`Align ${align}`} on={f.align === align} onClick={() => run((c) => c.setTextAlign(align))}>
            <Icon name={`align-${align}`} />
          </Toggle>
        ))}
      </Row>
      <Row label="Spacing">
        <select aria-label="Line spacing" value={f.lineHeight} onChange={(event) => run((c) => c.setLineSpacing(event.target.value || null))}>
          {LINE_HEIGHTS.map((height) => (
            <option key={height.name} value={height.value}>
              {height.name}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Lists">
        <Toggle label="Bulleted list" on={f.bullet} onClick={() => run((c) => c.toggleBulletList())}>
          <Icon name="list-bullet" />
        </Toggle>
        <Toggle label="Numbered list" on={f.ordered} onClick={() => run((c) => c.toggleOrderedList())}>
          <Icon name="list-number" />
        </Toggle>
        <Toggle label="To-do list" on={f.task} onClick={() => run((c) => c.toggleTaskList())}>
          <Icon name="list-check" />
        </Toggle>
        <Toggle label="Outdent" on={false} onClick={() => run((c) => c.outdent())}>
          <Icon name="outdent" />
        </Toggle>
        <Toggle label="Indent" on={false} onClick={() => run((c) => c.indent())}>
          <Icon name="indent" />
        </Toggle>
      </Row>
      <button className="footer-button" onMouseDown={(event) => event.preventDefault()} onClick={() => run((c) => c.unsetAllMarks().unsetTextAlign().setLineSpacing(null))}>
        <Icon name="close" />
        <span>Clear formatting</span>
      </button>
    </div>
  );
}

/** Word-like formatting for the open note, in the right sidebar. */
export function FormatPanel() {
  const editor = activeEditor.use();
  if (!editor || editor.isDestroyed) return <p className="format-empty">Click in the note to format its text.</p>;
  return <Controls editor={editor} />;
}
