import "./excalidrawAssets";
import { CaptureUpdateAction, convertToExcalidrawElements } from "@excalidraw/excalidraw";

// Sticky notes, frames, templates and dot votes for boards, made out of
// Excalidraw's own shapes so they save, sync and export like any drawing.

type Api = {
  getAppState(): { scrollX: number; scrollY: number; width: number; height: number; zoom: { value: number }; selectedElementIds: Readonly<Record<string, true>> };
  getSceneElementsIncludingDeleted(): readonly Element[];
  updateScene(scene: { elements?: readonly Element[]; appState?: Record<string, unknown>; captureUpdate?: unknown }): void;
};
type Skeleton = Parameters<typeof convertToExcalidrawElements>[0] extends (infer S)[] | null ? S : never;
interface Element {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDeleted: boolean;
  groupIds: readonly string[];
  frameId: string | null;
  customData?: Record<string, unknown>;
  version: number;
  versionNonce: number;
  updated: number;
  text?: string;
  originalText?: string;
}

export const STICKY_COLORS = [
  { name: "Yellow", value: "#ffec99" },
  { name: "Pink", value: "#fcc2d7" },
  { name: "Green", value: "#b2f2bb" },
  { name: "Blue", value: "#a5d8ff" },
  { name: "Orange", value: "#ffd8a8" },
  { name: "Purple", value: "#d0bfff" },
];

const STICKY = 180;
const GAP = 40;
const uid = () => crypto.randomUUID().slice(0, 12);

/** The middle of what is on screen, in board coordinates. */
function middle(api: Api) {
  const s = api.getAppState();
  const zoom = s.zoom.value;
  return { x: -s.scrollX + s.width / 2 / zoom, y: -s.scrollY + s.height / 2 / zoom };
}

const sticky = (x: number, y: number, color: string, text = "", frameId?: string, size = STICKY): Skeleton =>
  ({
    type: "rectangle",
    id: uid(),
    x,
    y,
    width: size,
    height: size,
    backgroundColor: color,
    fillStyle: "solid",
    strokeColor: "#868e96",
    strokeWidth: 1,
    roughness: 0,
    roundness: { type: 3 },
    frameId: frameId ?? null,
    customData: { sticky: true },
    ...(text ? { label: { text, fontSize: 20 } } : {}),
  }) as Skeleton;

const frame = (x: number, y: number, width: number, height: number, name: string, id = uid()): Skeleton =>
  ({ type: "frame", id, children: [], name, x, y, width, height }) as unknown as Skeleton;

/** Adds shapes to the board as one step of its undo, and selects the main ones so they can be dragged at once. */
function add(api: Api, skeletons: Skeleton[], select: (el: Element) => boolean = () => true) {
  const made = convertToExcalidrawElements(skeletons, { regenerateIds: false }) as unknown as Element[];
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), ...made],
    appState: { selectedElementIds: Object.fromEntries(made.filter((el) => el.type !== "text" && select(el)).map((el) => [el.id, true])) },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return made;
}

/** A sticky note in the middle of the view. */
export function addSticky(api: Api, color: string) {
  const { x, y } = middle(api);
  add(api, [sticky(x - STICKY / 2, y - STICKY / 2, color)]);
}

/** An empty frame to gather things in. */
export function addFrame(api: Api) {
  const { x, y } = middle(api);
  add(api, [frame(x - 300, y - 200, 600, 400, "Frame")]);
}

/** Columns side by side, each a frame with a first sticky in it. */
function columns(api: Api, names: string[], colors: string[], starters: string[]) {
  const { x, y } = middle(api);
  const width = STICKY + GAP * 2;
  const height = 560;
  const left = x - (names.length * width + (names.length - 1) * GAP) / 2;
  const top = y - height / 2;
  const skeletons: Skeleton[] = [];
  names.forEach((name, i) => {
    const id = uid();
    const fx = left + i * (width + GAP);
    skeletons.push(frame(fx, top, width, height, name, id));
    if (starters[i]) skeletons.push(sticky(fx + GAP, top + GAP, colors[i % colors.length], starters[i], id));
  });
  add(api, skeletons, (el) => el.type === "frame");
}

export const TEMPLATES: { name: string; description: string; place(api: Api): void }[] = [
  {
    name: "Kanban",
    description: "To do, Doing, Done",
    place: (api) => columns(api, ["To do", "Doing", "Done"], ["#ffec99", "#a5d8ff", "#b2f2bb"], ["First task", "", ""]),
  },
  {
    name: "Retrospective",
    description: "Went well, To improve, Actions",
    place: (api) => columns(api, ["Went well", "To improve", "Actions"], ["#b2f2bb", "#fcc2d7", "#a5d8ff"], ["Something good", "Something to change", "Who does what"]),
  },
  {
    name: "Brainstorm",
    description: "A topic with ideas around it",
    place(api) {
      const { x, y } = middle(api);
      const skeletons: Skeleton[] = [sticky(x - 120, y - 120, "#ffd8a8", "Topic", undefined, 240)];
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
        skeletons.push(sticky(x + Math.cos(angle) * 360 - STICKY / 2, y + Math.sin(angle) * 300 - STICKY / 2, STICKY_COLORS[i % STICKY_COLORS.length].value, "Idea"));
      }
      add(api, skeletons);
    },
  },
  {
    name: "SWOT",
    description: "Strengths, weaknesses, opportunities, threats",
    place(api) {
      const { x, y } = middle(api);
      const size = 420;
      const names = ["Strengths", "Weaknesses", "Opportunities", "Threats"];
      add(
        api,
        names.map((name, i) => frame(x - size - GAP / 2 + (i % 2) * (size + GAP), y - size - GAP / 2 + Math.floor(i / 2) * (size + GAP), size, size, name)),
      );
    },
  },
];

const touched = <T extends Element>(el: T, changes: Partial<T>): T => ({ ...el, ...changes, version: el.version + 1, versionNonce: Math.floor(Math.random() * 2 ** 31), updated: Date.now() });

const votesOf = (badge: Element) => Number(/\d+/.exec(badge.text ?? "")?.[0] ?? 0);

/**
 * A dot vote on each selected shape: a "+N" label at its top right, grouped
 * with it so they move together. Voting again counts up.
 */
export function vote(api: Api): number {
  const all = api.getSceneElementsIncludingDeleted();
  const picked = all.filter((el) => api.getAppState().selectedElementIds[el.id] && !el.isDeleted && el.type !== "text" && el.type !== "frame" && !el.customData?.voteFor);
  if (!picked.length) return 0;
  let elements = [...all];
  const extra: Skeleton[] = [];
  for (const target of picked) {
    const badge = elements.find((el) => !el.isDeleted && el.customData?.voteFor === target.id);
    if (badge) {
      const text = `+${votesOf(badge) + 1}`;
      elements = elements.map((el) => (el.id === badge.id ? touched(el, { text, originalText: text }) : el));
      continue;
    }
    // A group of its own with the shape, unless the shape is grouped already.
    let group = target.groupIds.at(-1);
    if (!group) {
      group = uid();
      const id = target.id;
      const g = group;
      elements = elements.map((el) => (el.id === id ? touched(el, { groupIds: [g] }) : el));
    }
    extra.push({ type: "text", text: "+1", x: target.x + target.width - 30, y: target.y + 6, fontSize: 18, strokeColor: "#c92a2a", groupIds: [group], frameId: target.frameId, customData: { voteFor: target.id } } as unknown as Skeleton);
  }
  const made = extra.length ? (convertToExcalidrawElements(extra, { regenerateIds: false }) as unknown as Element[]) : [];
  api.updateScene({ elements: [...elements, ...made], captureUpdate: CaptureUpdateAction.IMMEDIATELY });
  return picked.length;
}

/** Takes every vote off the board. */
export function clearVotes(api: Api): number {
  let count = 0;
  const elements = api.getSceneElementsIncludingDeleted().map((el) => {
    if (el.isDeleted || !el.customData?.voteFor) return el;
    count++;
    return touched(el, { isDeleted: true });
  });
  if (count) api.updateScene({ elements, captureUpdate: CaptureUpdateAction.IMMEDIATELY });
  return count;
}
