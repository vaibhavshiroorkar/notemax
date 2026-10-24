import { escapeHtml, toHtml, toPlainText, type DocNode, type Resolve } from "@/features/export/serialize";

/**
 * Two versions of a note, compared block by block and then word by word, as
 * HTML: blocks only the old side has are "gone" (red), blocks only the new
 * side has are "new" (green), and blocks both have but worded differently are
 * "changed" (yellow), with the words that went and came marked inside.
 */

/** A block of text as it reads on the page: a paragraph, a heading, a list line. */
interface Leaf {
  node: DocNode;
  /** What compares: the kind of block and its words. */
  key: string;
  text: string;
  /** "bullet", "number" or "task" for a list line, with how deep it sits. */
  list?: string;
  depth: number;
}

const LISTS: Record<string, string> = { bulletList: "bullet", orderedList: "number", taskList: "task" };
const LEAVES = new Set(["paragraph", "heading", "codeBlock", "horizontalRule", "image", "video"]);

function leavesOf(nodes: DocNode[], r: Resolve, list?: string, depth = 0, out: Leaf[] = []): Leaf[] {
  for (const node of nodes) {
    if (LEAVES.has(node.type)) {
      const text = toPlainText({ type: "doc", content: [node] }, r).trim();
      const level = node.type === "heading" ? `h${String(node.attrs?.level ?? 1)}` : node.type;
      out.push({ node, key: `${level}|${list ?? ""}|${text || JSON.stringify(node.attrs ?? {})}`, text, list, depth });
    } else if (LISTS[node.type]) leavesOf(node.content ?? [], r, LISTS[node.type], list ? depth + 1 : depth, out);
    else leavesOf(node.content ?? [], r, list, depth, out);
  }
  return out;
}

type Step<T> = { op: "same"; a: T; b: T } | { op: "gone"; a: T } | { op: "new"; b: T };

/**
 * The longest common run of two lists, as steps. The equal start and end are
 * taken off first, so a long note with one change costs little. Past a size
 * where the full table would be slow, the middle counts as all changed.
 */
function align<T>(a: T[], b: T[], same: (x: T, y: T) => boolean): Step<T>[] {
  let start = 0;
  while (start < a.length && start < b.length && same(a[start], b[start])) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && same(a[endA - 1], b[endB - 1])) {
    endA--;
    endB--;
  }
  const head: Step<T>[] = a.slice(0, start).map((x, i) => ({ op: "same", a: x, b: b[i] }));
  const tail: Step<T>[] = a.slice(endA).map((x, i) => ({ op: "same", a: x, b: b[endB + i] }));
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const n = midA.length;
  const m = midB.length;
  if (n * m > 4_000_000) return [...head, ...midA.map((x): Step<T> => ({ op: "gone", a: x })), ...midB.map((y): Step<T> => ({ op: "new", b: y })), ...tail];

  // lengths[i][j]: the longest common run of midA from i and midB from j.
  const lengths = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lengths[i][j] = same(midA[i], midB[j]) ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
  const middle: Step<T>[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (same(midA[i], midB[j])) middle.push({ op: "same", a: midA[i++], b: midB[j++] });
    else if (lengths[i + 1][j] >= lengths[i][j + 1]) middle.push({ op: "gone", a: midA[i++] });
    else middle.push({ op: "new", b: midB[j++] });
  }
  while (i < n) middle.push({ op: "gone", a: midA[i++] });
  while (j < m) middle.push({ op: "new", b: midB[j++] });
  return [...head, ...middle, ...tail];
}

const words = (text: string) => text.split(/(\s+)/).filter(Boolean);

/** How much of two texts is the same, from 0 to 1, by words. */
function likeness(a: string, b: string): number {
  const x = words(a).filter((w) => w.trim());
  const y = words(b).filter((w) => w.trim());
  if (!x.length || !y.length) return 0;
  const kept = align(x, y, (p, q) => p === q).filter((s) => s.op === "same").length;
  return (2 * kept) / (x.length + y.length);
}

/**
 * The new text with the words that went in <del> and the words that came in
 * <ins>. A run of changed words reads as one: "this laptop" went and "the
 * phone" came, not each word in turn. A space between two changes joins them.
 */
function wordDiff(a: string, b: string): string {
  const steps = align(words(a), words(b), (p, q) => p === q);
  const out: string[] = [];
  let gone = "";
  let came = "";
  const flush = () => {
    if (gone) out.push(`<del>${escapeHtml(gone)}</del>`);
    if (came) out.push(`<ins>${escapeHtml(came)}</ins>`);
    gone = came = "";
  };
  steps.forEach((step, i) => {
    if (step.op === "gone") gone += step.a;
    else if (step.op === "new") came += step.b;
    else if ((gone || came) && !step.a.trim() && steps[i + 1] && steps[i + 1].op !== "same") {
      gone += step.a;
      came += step.a;
    } else {
      flush();
      out.push(escapeHtml(step.a));
    }
  });
  flush();
  return out.join("");
}

const wrap = (leaf: Leaf, mark: string | null, inner: string) =>
  `<div class="diff-block"${mark ? ` data-diff="${mark}"` : ""}${leaf.list ? ` data-list="${leaf.list}" style="--diff-depth:${leaf.depth}"` : ""}>${inner}</div>`;

/** A block as the page shows it, with its formatting. */
const whole = (leaf: Leaf, r: Resolve) => toHtml([leaf.node], r);

/** Words changed inside a block keep its kind: a heading stays a heading. */
function changed(old: Leaf, now: Leaf): string {
  const tag = now.node.type === "heading" ? `h${Math.min(6, Number(now.node.attrs?.level ?? 1))}` : now.node.type === "codeBlock" ? "pre" : "p";
  return wrap(now, "changed", `<${tag}>${wordDiff(old.text, now.text)}</${tag}>`);
}

export interface DiffResult {
  html: string;
  gone: number;
  added: number;
  changed: number;
}

/** `old` and `now` are note bodies as stored. */
export function diffHtml(old: DocNode, now: DocNode, r: Resolve): DiffResult {
  const steps = align(leavesOf(old.content ?? [], r), leavesOf(now.content ?? [], r), (x, y) => x.key === y.key);
  const out: string[] = [];
  const counts = { gone: 0, added: 0, changed: 0 };
  // Between two equal blocks, a run of gone and new blocks. Ones that read
  // alike are the same block rewritten; the rest went or came whole.
  let gone: Leaf[] = [];
  let came: Leaf[] = [];
  const flush = () => {
    // Pair each new block with the next gone one that reads like it, keeping their order.
    const pairOf: number[] = [];
    let from = 0;
    for (const leaf of came) {
      const at = gone.findIndex((g, i) => i >= from && g.node.type === leaf.node.type && likeness(g.text, leaf.text) >= 0.4);
      pairOf.push(at);
      if (at >= 0) from = at + 1;
    }
    // Blocks that went come before what replaced them, so the page reads in order.
    let next = 0;
    const goneUpTo = (end: number) => {
      for (; next < end; next++) {
        counts.gone++;
        out.push(wrap(gone[next], "gone", whole(gone[next], r)));
      }
    };
    came.forEach((leaf, i) => {
      const at = pairOf[i];
      if (at >= 0) {
        goneUpTo(at);
        next = at + 1;
        counts.changed++;
        out.push(changed(gone[at], leaf));
      } else {
        goneUpTo(pairOf.slice(i).find((p) => p >= 0) ?? gone.length);
        counts.added++;
        out.push(wrap(leaf, "new", whole(leaf, r)));
      }
    });
    goneUpTo(gone.length);
    gone = [];
    came = [];
  };
  for (const step of steps) {
    if (step.op === "gone") gone.push(step.a);
    else if (step.op === "new") came.push(step.b);
    else {
      flush();
      out.push(wrap(step.b, null, whole(step.b, r)));
    }
  }
  flush();
  return { html: out.join("\n"), ...counts };
}
