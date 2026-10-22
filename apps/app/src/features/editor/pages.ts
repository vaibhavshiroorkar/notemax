import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { savedStore } from "@/platform/store";

/** Paper sizes at 96 dots per inch, the way browsers measure. */
export const PAPER = {
  a4: { label: "A4", width: 794, height: 1123 },
  letter: { label: "Letter", width: 816, height: 1056 },
} as const;
export type PaperSize = keyof typeof PAPER;

export const paperSize = savedStore<PaperSize>("paperSize", "a4", { decode: (raw) => (raw === "letter" ? "letter" : "a4"), encode: (v) => v });

/** Space around the text on a page (about 2 cm) and between two pages. */
export const PAGE_MARGIN = 76;
export const PAGE_GAP = 28;

export interface PageGeometry {
  /** Height of one sheet. */
  height: number;
  /** Where the first sheet starts, from the top of the editor's own box. */
  offset: number;
}

const key = new PluginKey<DecorationSet>("pages");

/**
 * Lays a note out on pages. The text is still one flowing document; this only
 * moves a block that would cross the bottom of a page down to the top of the
 * next one, by giving it a bigger top margin. Blocks taller than a page are
 * left to cross. The note's own frame draws the sheets behind the text.
 *
 * `measure` gets the editor and returns the page size and where page one
 * starts, or null while pages are off.
 */
export const Pages = Extension.create<{ measure(view: EditorView): PageGeometry | null; onPages(count: number): void }>({
  name: "pages",

  addOptions() {
    return { measure: () => null, onPages: () => {} };
  },

  addProseMirrorPlugins() {
    const { measure, onPages } = this.options;
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const next = tr.getMeta(key) as DecorationSet | undefined;
            return next ?? set.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations: (state) => key.getState(state),
        },
        view(view) {
          let frame = 0;
          let lastCount = -1;
          const schedule = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => layout(view));
          };
          const layout = (view: EditorView) => {
            const geometry = measure(view);
            const current = key.getState(view.state)!;
            if (!geometry) {
              if (current !== DecorationSet.empty) view.dispatch(view.state.tr.setMeta(key, DecorationSet.empty).setMeta("addToHistory", false));
              if (lastCount !== 0) onPages((lastCount = 0));
              return;
            }
            const { decorations, pages } = paginate(view, view.state, current, geometry);
            if (pages !== lastCount) onPages((lastCount = pages));
            if (decorations) view.dispatch(view.state.tr.setMeta(key, decorations).setMeta("addToHistory", false));
          };
          const resize = new ResizeObserver(schedule);
          resize.observe(view.dom);
          schedule();
          return {
            // Any change can move blocks. Laying out again after our own change finds
            // nothing new to push, so it settles after one extra measure.
            update: schedule,
            destroy() {
              cancelAnimationFrame(frame);
              resize.disconnect();
            },
          };
        },
      }),
    ];
  },
});

/** Asks the extension to lay the pages out again, after the page size or layout changed. */
export const relayoutPages = (view: EditorView) => view.dispatch(view.state.tr.setMeta("pagesRelayout", true));

/**
 * Works out the pushes. Returns new decorations only when they differ from the
 * current ones, so laying out twice in a row settles instead of looping.
 */
function paginate(view: EditorView, state: EditorState, current: DecorationSet, { height, offset }: PageGeometry) {
  const stride = height + PAGE_GAP;
  const top = view.dom.getBoundingClientRect().top;
  const blocks: { pos: number; el: HTMLElement; push: number }[] = [];
  state.doc.forEach((node, pos) => {
    const el = view.nodeDOM(pos);
    if (!(el instanceof HTMLElement)) return;
    // find() also returns the block before, whose decoration ends where this one starts.
    const pushed = current.find(pos, pos + node.nodeSize, (spec) => spec.pagePush !== undefined).find((d) => d.from === pos);
    blocks.push({ pos, el, push: pushed ? (pushed.spec.pagePush as number) : 0 });
  });

  // Where each block would sit with no pushes at all.
  let pushedSoFar = 0;
  const natural = blocks.map((block) => {
    pushedSoFar += block.push;
    const rect = block.el.getBoundingClientRect();
    return { top: rect.top - top - pushedSoFar + offset, bottom: rect.bottom - top - pushedSoFar + offset, gap: 0 };
  });
  natural.forEach((box, i) => (box.gap = i ? box.top - natural[i - 1].bottom : 0));

  const pushes: number[] = [];
  let shift = 0;
  natural.forEach((box, i) => {
    const t = box.top + shift;
    const b = box.bottom + shift;
    const page = Math.floor(t / stride);
    const textTop = page * stride + PAGE_MARGIN;
    const textBottom = page * stride + height - PAGE_MARGIN;
    const fits = b - t <= height - 2 * PAGE_MARGIN;
    let push = 0;
    // Into the bottom margin or the gap: move to the top of the next page.
    if (i > 0 && (t >= textBottom || (b > textBottom && fits && t > textTop + 1))) push = (page + 1) * stride + PAGE_MARGIN - t;
    pushes.push(Math.max(0, Math.round(push)));
    shift += pushes[i];
  });

  const last = natural.at(-1);
  const pages = Math.max(1, Math.ceil(((last?.bottom ?? 0) + shift + PAGE_MARGIN) / stride));
  const same = blocks.every((block, i) => block.push === pushes[i]);
  if (same) return { decorations: null, pages };
  const decorations = DecorationSet.create(
    state.doc,
    blocks.flatMap((block, i) =>
      pushes[i]
        ? [
            Decoration.node(
              block.pos,
              block.pos + state.doc.nodeAt(block.pos)!.nodeSize,
              // The gap it had plus the push, so margin collapsing cannot eat the push.
              { style: `margin-top: ${natural[i].gap + pushes[i]}px`, class: "page-start" },
              { pagePush: pushes[i] },
            ),
          ]
        : [],
    ),
  );
  return { decorations, pages };
}
