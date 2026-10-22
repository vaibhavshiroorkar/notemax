import { useEffect, useMemo, useRef } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceRadial, forceSimulation, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import type { Graph, GraphNode } from "@notemax/core";

type Dot = GraphNode & SimulationNodeDatum;
type Line = SimulationLinkDatum<Dot> & { kind: Graph["edges"][number]["kind"] };

const ZOOM = { min: 0.1, max: 4 };

// Pages higher in the tree get bigger dots, top-level ones the biggest, and
// busier pages grow a little. The page a local graph centers on is never small.
const LEVEL_RADIUS = [8, 6.5, 5.5, 4.5];
const radiusOf = (dot: Dot, compact: boolean) => {
  const base = LEVEL_RADIUS[Math.min(dot.level ?? LEVEL_RADIUS.length - 1, LEVEL_RADIUS.length - 1)] + Math.sqrt(dot.degree) * 0.8;
  const size = dot.depth === 0 ? Math.max(base, 9) : base;
  return compact ? size * 0.75 : size;
};

/** Colors from the theme, read on every draw so the graph follows light and dark. */
function palette(el: Element) {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return { accent: v("--accent"), text: v("--text"), muted: v("--muted") };
}

const KIND_COLORS: Record<string, string> = { book: "#c2410c", board: "#0c8599", folder: "#868e96", tag: "#2f9e44" };

export interface GraphCanvasProps {
  graph: Graph;
  /** The open page. It is drawn in the accent color, and in a local graph it sits in the middle. */
  center: string | null;
  /** Rings around the center, like a mind map, instead of a free layout. */
  local: boolean;
  /** Pages whose title has this are lit; the rest fade. */
  find?: string;
  /** The small graph in the right sidebar: smaller dots, and the wheel scrolls the sidebar unless Ctrl is held. */
  compact?: boolean;
  label: string;
  className?: string;
  onOpen(id: string): void;
  /** A right click on a dot. */
  onDotMenu?(id: string, x: number, y: number): void;
}

/**
 * Pages as dots and links as lines, laid out by d3-force on a canvas. The
 * layout starts over only when the dots or lines change, not when a title
 * does, so typing in a note never makes the graph jump.
 */
export function GraphCanvas({ graph, center, local, find = "", compact = false, label, className = "graph-canvas", onOpen, onDotMenu }: GraphCanvasProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const shape = useMemo(
    () => JSON.stringify([graph.nodes.map((n) => [n.id, n.kind, n.degree, n.depth]), graph.edges.map((e) => [e.source, e.target, e.kind])]),
    [graph],
  );
  // Everything the drawing reads but that must not restart the layout.
  const latest = useRef({ graph, find, onOpen, onDotMenu, redraw: () => {} });
  latest.current = { ...latest.current, graph, find, onOpen, onDotMenu };

  useEffect(() => latest.current.redraw(), [graph, find]);

  useEffect(() => {
    const el = canvas.current!;
    const ctx = el.getContext("2d")!;
    const { graph } = latest.current;
    const dots: Dot[] = graph.nodes.map((node) => ({ ...node }));
    const byId = new Map(dots.map((dot) => [dot.id, dot]));
    const lines: Line[] = graph.edges.map((edge) => ({ source: edge.source, target: edge.target, kind: edge.kind }));
    const neighbors = new Map<string, Set<string>>();
    for (const edge of graph.edges) {
      for (const [a, b] of [[edge.source, edge.target], [edge.target, edge.source]]) {
        if (!neighbors.has(a)) neighbors.set(a, new Set());
        neighbors.get(a)!.add(b);
      }
    }
    const ring = compact ? 80 : 130;

    let view = { x: 0, y: 0, zoom: local ? 1 : Math.max(0.3, Math.min(1, 30 / Math.sqrt(dots.length + 1))) };
    let hover: Dot | null = null;
    let size = { w: 0, h: 0 };
    const dpr = window.devicePixelRatio || 1;
    const radius = (dot: Dot) => radiusOf(dot, compact);

    const simulation = forceSimulation(dots)
      .force("link", forceLink<Dot, Line>(lines).id((d) => d.id).distance((l) => (l.kind === "link" ? 70 : 40)).strength(0.4))
      .force("charge", forceManyBody().strength(local ? (compact ? -160 : -260) : -60))
      .force("collide", forceCollide<Dot>((d) => radius(d) + 3))
      .force("center", forceCenter(0, 0).strength(0.05));
    if (local && center) {
      const middle = byId.get(center);
      if (middle) {
        middle.fx = 0;
        middle.fy = 0;
      }
      simulation.force("ring", forceRadial<Dot>((d) => (d.depth ?? 0) * ring, 0, 0).strength(0.9));
    }

    const toWorld = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      return { x: (clientX - rect.left - size.w / 2 - view.x) / view.zoom, y: (clientY - rect.top - size.h / 2 - view.y) / view.zoom };
    };
    const dotAt = (clientX: number, clientY: number): Dot | null => {
      const p = toWorld(clientX, clientY);
      let best: Dot | null = null;
      let bestDist = Infinity;
      for (const dot of dots) {
        const d = Math.hypot((dot.x ?? 0) - p.x, (dot.y ?? 0) - p.y);
        if (d < radius(dot) + 6 / view.zoom && d < bestDist) {
          best = dot;
          bestDist = d;
        }
      }
      return best;
    };

    const draw = () => {
      if (!size.w) return;
      const { graph, find } = latest.current;
      const titles = new Map(graph.nodes.map((n) => [n.id, n.title]));
      const query = find.trim().toLowerCase();
      const colors = palette(el);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.w, size.h);
      ctx.translate(size.w / 2 + view.x, size.h / 2 + view.y);
      ctx.scale(view.zoom, view.zoom);
      const focus = hover ? (neighbors.get(hover.id) ?? new Set<string>()) : null;
      const lit = (dot: Dot) => !focus || dot === hover || focus.has(dot.id);
      const titleOf = (dot: Dot) => titles.get(dot.id) ?? dot.title;
      const matched = (dot: Dot) => !!query && titleOf(dot).toLowerCase().includes(query);

      ctx.lineWidth = 1 / view.zoom;
      for (const line of lines) {
        const a = line.source as Dot;
        const b = line.target as Dot;
        const on = !focus || a === hover || b === hover;
        ctx.strokeStyle = on && focus ? colors.accent : colors.muted;
        ctx.globalAlpha = on ? (line.kind === "link" ? 0.45 : 0.25) : 0.08;
        ctx.beginPath();
        ctx.moveTo(a.x ?? 0, a.y ?? 0);
        ctx.lineTo(b.x ?? 0, b.y ?? 0);
        ctx.stroke();
      }
      for (const dot of dots) {
        ctx.globalAlpha = lit(dot) && (!query || matched(dot)) ? 1 : 0.18;
        ctx.fillStyle = dot.id === center || matched(dot) ? colors.accent : (KIND_COLORS[dot.kind] ?? colors.muted);
        ctx.beginPath();
        ctx.arc(dot.x ?? 0, dot.y ?? 0, radius(dot), 0, Math.PI * 2);
        ctx.fill();
      }
      // Names: always in a local graph, and in the full one for the hovered dot, its
      // neighbors, matches, and everything once zoomed in far enough to read.
      ctx.font = `${(compact ? 11 : 12) / view.zoom}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const dot of dots) {
        const named = local || view.zoom > 1.3 || dot === hover || (focus && focus.has(dot.id)) || matched(dot) || dot.id === center;
        if (!named) continue;
        ctx.globalAlpha = lit(dot) ? 1 : 0.25;
        ctx.fillStyle = colors.text;
        const name = titleOf(dot) || "Untitled";
        ctx.fillText(compact && name.length > 22 ? `${name.slice(0, 20)}...` : name, dot.x ?? 0, (dot.y ?? 0) + radius(dot) + 3 / view.zoom);
      }
      ctx.globalAlpha = 1;
    };

    let frame = 0;
    const redraw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    };
    latest.current.redraw = redraw;
    // Once the layout has mostly settled, zoom to show all of it. Only once, so it never fights the user.
    let fitted = false;
    const fit = () => {
      if (!dots.length || !size.w) return;
      const xs = dots.map((d) => d.x ?? 0);
      const ys = dots.map((d) => d.y ?? 0);
      const pad = compact ? 30 : 40;
      if (local) {
        // The open page stays in the middle; only the zoom changes, so everything around it fits.
        const reach = Math.max(...xs.map(Math.abs), ...ys.map(Math.abs), 1);
        view = { zoom: Math.min(ZOOM.max, Math.max(ZOOM.min, Math.min((size.w / 2 - pad) / reach, (size.h / 2 - pad) / reach, 1.5))), x: 0, y: 0 };
        return;
      }
      const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, Math.min((size.w - 2 * pad) / (maxX - minX || 1), (size.h - 2 * pad) / (maxY - minY || 1), 1.5)));
      view = { zoom, x: -((minX + maxX) / 2) * zoom, y: -((minY + maxY) / 2) * zoom };
    };
    simulation.on("tick", () => {
      if (!fitted && simulation.alpha() < 0.2) {
        fitted = true;
        fit();
      }
      redraw();
    });

    const resize = () => {
      size = { w: el.clientWidth, h: el.clientHeight };
      el.width = size.w * dpr;
      el.height = size.h * dpr;
      redraw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    // Dragging empty space pans; dragging a dot moves it; a click without moving opens the page.
    let drag: { dot: Dot | null; startX: number; startY: number; view: typeof view; moved: boolean } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      drag = { dot: dotAt(e.clientX, e.clientY), startX: e.clientX, startY: e.clientY, view: { ...view }, moved: false };
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) {
        const next = dotAt(e.clientX, e.clientY);
        if (next !== hover) {
          hover = next;
          el.style.cursor = hover ? "pointer" : "grab";
          el.title = hover ? titlesNow().get(hover.id) || "Untitled" : "";
          redraw();
        }
        return;
      }
      if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 4) return;
      drag.moved = true;
      if (drag.dot) {
        const p = toWorld(e.clientX, e.clientY);
        drag.dot.fx = p.x;
        drag.dot.fy = p.y;
        simulation.alphaTarget(0.3).restart();
      } else {
        view = { ...drag.view, x: drag.view.x + e.clientX - drag.startX, y: drag.view.y + e.clientY - drag.startY };
        redraw();
      }
    };
    const titlesNow = () => new Map(latest.current.graph.nodes.map((n) => [n.id, n.title]));
    const onUp = () => {
      if (!drag) return;
      const { dot, moved } = drag;
      drag = null;
      if (dot && !moved) {
        latest.current.onOpen(dot.id);
        return;
      }
      if (dot && !(local && dot.id === center)) {
        dot.fx = null;
        dot.fy = null;
      }
      simulation.alphaTarget(0);
    };
    const onLeave = () => {
      if (hover && !drag) {
        hover = null;
        redraw();
      }
    };
    const onWheel = (e: WheelEvent) => {
      // In the sidebar the wheel scrolls the sidebar. Ctrl+wheel, or a pinch on a touchpad, zooms.
      if (compact && !e.ctrlKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left - size.w / 2;
      const py = e.clientY - rect.top - size.h / 2;
      const zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, view.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      const k = zoom / view.zoom;
      view = { zoom, x: px - (px - view.x) * k, y: py - (py - view.y) * k };
      redraw();
    };
    const onMenu = (e: MouseEvent) => {
      const dot = dotAt(e.clientX, e.clientY);
      const menu = latest.current.onDotMenu;
      if (!dot || !menu) return;
      e.preventDefault();
      menu(dot.id, e.clientX, e.clientY);
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onMenu);
    return () => {
      simulation.stop();
      observer.disconnect();
      cancelAnimationFrame(frame);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onMenu);
    };
    // `shape` stands for the graph here: the layout restarts only when dots or lines change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, local, center, compact]);

  return <canvas ref={canvas} className={className} aria-label={label} />;
}
