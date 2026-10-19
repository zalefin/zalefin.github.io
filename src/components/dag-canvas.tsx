"use client";

import { useEffect, useRef } from "react";
import { layoutGraph } from "@/dag/layout";
import type { DagGraph } from "@/dag/types";

// A DAG drawn on a canvas that fills its (positioned) parent, with data
// packets flowing through it. Nodes near the pointer light up and packets near
// it speed up. When the graph changes, nodes glide to their new places and
// fade in or out.

const PACKET_COLORS = [
  "orange",
  "aqua",
  "yellow",
  "green",
  "blue",
  "purple",
] as const;

const NODE_RADIUS = 5;
const POINTER_RADIUS = 180;
const MAX_PACKETS = 28;
// Margins as a fraction of the screen, along and across the flow.
const MARGIN_ALONG = 0.07;
const MARGIN_ACROSS = 0.1;
// Minimum distance, in pixels, between neighbors in a layer.
const MIN_GAP = 80;

type SceneNode = {
  id: string;
  operator: string;
  // Placement (see NodePlacement). `u` and `v` ease toward `tu` and the
  // across-the-flow position worked out from slot, size and jitter.
  u: number;
  v: number;
  tu: number;
  layer: number;
  slot: number;
  size: number;
  jitter: number;
  alpha: number;
  targetAlpha: number;
  pulse: number;
  pulseColor: string;
};

type SceneEdge = {
  from: string;
  to: string;
  alpha: number;
  targetAlpha: number;
};

type Packet = { edge: string; t: number; speed: number; color: string };

type Palette = Record<
  (typeof PACKET_COLORS)[number] | "fg" | "faint" | "bg" | "red",
  string
>;

type Variant = "flow" | "crashed";

const edgeKey = (from: string, to: string) => `${from}\u0000${to}`;

function pointAt(p: readonly number[], t: number): [number, number] {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p[0] + b * p[2] + c * p[4] + d * p[6],
    a * p[1] + b * p[3] + c * p[5] + d * p[7],
  ];
}

function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(`--${name}`).trim();
  return {
    fg: v("fg"),
    faint: v("fg-faint"),
    bg: v("bg"),
    red: v("red"),
    orange: v("orange-bright"),
    aqua: v("aqua"),
    yellow: v("yellow"),
    green: v("green"),
    blue: v("blue"),
    purple: v("purple"),
  };
}

export function DagCanvas({
  graph,
  variant = "flow",
}: {
  graph: DagGraph;
  variant?: Variant;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef(graph);
  const setGraphRef = useRef<((graph: DagGraph) => void) | null>(null);

  useEffect(() => {
    graphRef.current = graph;
    setGraphRef.current?.(graph);
  }, [graph]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!wrapper || !canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const nodes = new Map<string, SceneNode>();
    const edges = new Map<string, SceneEdge>();
    let outgoing = new Map<string, string[]>();
    let sources: string[] = [];
    let palette = readPalette();
    let fontFamily = "";
    let width = 0;
    let height = 0;
    let packets: Packet[] = [];
    let pointer: { x: number; y: number } | null = null;
    let raf = 0;
    let last = 0;
    let nextSpawn = 0;

    const readFont = () => {
      fontFamily = getComputedStyle(document.body).fontFamily;
    };
    readFont();

    // The widest layer in the current graph, which sets the spacing.
    let widest = 1;
    // The graph flows left to right.
    const pos = (n: SceneNode): [number, number] => [
      (MARGIN_ALONG + (1 - 2 * MARGIN_ALONG) * n.u) * width,
      (MARGIN_ACROSS + (1 - 2 * MARGIN_ACROSS) * n.v) * height,
    ];
    // Spread a layer's tasks to use up to ~3/4 of the height the widest layer
    // leaves, keeping small layers bunched in the middle.
    const targetV = (n: SceneNode) => {
      const across = height * (1 - 2 * MARGIN_ACROSS);
      const gap = Math.min(
        MIN_GAP * 2.5,
        Math.max(MIN_GAP, (across * 0.75) / Math.max(1, widest - 1)),
      );
      const spread =
        n.size <= 1
          ? 0
          : Math.min(1, (gap * (n.size - 1)) / Math.max(across, 1));
      return 0.5 + (n.slot - 0.5) * spread + n.jitter * 0.03;
    };
    const curve = (e: SceneEdge) => {
      const [ax, ay] = pos(nodes.get(e.from)!);
      const [bx, by] = pos(nodes.get(e.to)!);
      const dx = (bx - ax) * 0.5;
      return [ax, ay, ax + dx, ay, bx - dx, by, bx, by] as const;
    };
    const nearness = (x: number, y: number) =>
      pointer
        ? Math.max(
            0,
            1 - Math.hypot(x - pointer.x, y - pointer.y) / POINTER_RADIUS,
          )
        : 0;

    function setGraph(next: DagGraph) {
      const placements = layoutGraph(next);
      widest = Math.max(1, ...[...placements.values()].map((p) => p.size));
      const live = new Set<string>();
      for (const task of next.tasks) {
        const { u, ...placement } = placements.get(task.id)!;
        live.add(task.id);
        const node = nodes.get(task.id);
        if (node) {
          Object.assign(node, placement, { tu: u, targetAlpha: 1 });
          node.operator = task.operator;
        } else {
          const added: SceneNode = {
            id: task.id,
            operator: task.operator,
            u,
            v: 0,
            tu: u,
            ...placement,
            alpha: 0,
            targetAlpha: 1,
            pulse: 0,
            pulseColor: "",
          };
          added.v = targetV(added);
          nodes.set(task.id, added);
        }
      }
      for (const node of nodes.values()) {
        if (!live.has(node.id)) node.targetAlpha = 0;
      }

      const liveEdges = new Set<string>();
      outgoing = new Map();
      const hasUpstream = new Set<string>();
      for (const [from, to] of next.edges) {
        const key = edgeKey(from, to);
        liveEdges.add(key);
        const edge = edges.get(key);
        if (edge) edge.targetAlpha = 1;
        else edges.set(key, { from, to, alpha: 0, targetAlpha: 1 });
        outgoing.set(from, [...(outgoing.get(from) ?? []), key]);
        hasUpstream.add(to);
      }
      for (const [key, edge] of edges) {
        if (!liveEdges.has(key)) edge.targetAlpha = 0;
      }
      sources = [...live].filter(
        (id) => !hasUpstream.has(id) && outgoing.has(id),
      );
      packets = packets.filter((pk) => liveEdges.has(pk.edge));

      if (reduceMotion.matches) {
        settle(Infinity);
        draw();
      }
    }

    // Ease nodes and edges toward their targets; drop the ones that faded out.
    function settle(dt: number) {
      const k = 1 - Math.exp(-dt * 5);
      for (const [id, n] of nodes) {
        n.u += (n.tu - n.u) * k;
        n.v += (targetV(n) - n.v) * k;
        n.alpha += (n.targetAlpha - n.alpha) * k;
        n.pulse = Math.max(0, n.pulse - dt * 1.6);
        if (n.targetAlpha === 0 && n.alpha < 0.01) nodes.delete(id);
      }
      for (const [key, e] of edges) {
        e.alpha += (e.targetAlpha - e.alpha) * k;
        const gone = !nodes.has(e.from) || !nodes.has(e.to);
        if (gone || (e.targetAlpha === 0 && e.alpha < 0.01)) edges.delete(key);
      }
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = wrapper!.clientWidth;
      height = wrapper!.clientHeight;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduceMotion.matches) draw();
    }

    function packetColor() {
      if (variant === "crashed") return palette.red;
      return palette[
        PACKET_COLORS[Math.floor(Math.random() * PACKET_COLORS.length)]
      ];
    }

    function spawn() {
      if (!sources.length) return;
      const src = sources[Math.floor(Math.random() * sources.length)];
      const out = outgoing.get(src) ?? [];
      if (!out.length) return;
      packets.push({
        edge: out[Math.floor(Math.random() * out.length)],
        t: 0,
        speed: (variant === "crashed" ? 45 : 70) + Math.random() * 40,
        color: packetColor(),
      });
    }

    function step(dt: number, now: number) {
      settle(dt);
      if (now >= nextSpawn && packets.length < MAX_PACKETS) {
        spawn();
        nextSpawn = now + 450 + Math.random() * 700;
      }
      packets = packets.filter((pk) => {
        const e = edges.get(pk.edge);
        if (!e || e.targetAlpha === 0) return false;
        const p = curve(e);
        const [x, y] = pointAt(p, pk.t);
        const length = Math.hypot(p[6] - p[0], p[7] - p[1]) * 1.15;
        const boost = 1 + 1.4 * nearness(x, y);
        pk.t += (pk.speed * boost * dt) / Math.max(length, 1);
        if (pk.t < 1) return true;

        const node = nodes.get(e.to)!;
        node.pulse = 1;
        node.pulseColor = pk.color;
        const out = outgoing.get(e.to) ?? [];
        // On the 404 page, packets segfault at nodes now and then.
        if (!out.length || (variant === "crashed" && Math.random() < 0.4))
          return false;
        pk.edge = out[Math.floor(Math.random() * out.length)];
        pk.t = 0;
        return true;
      });
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);
      ctx!.lineWidth = 1.25;

      for (const e of edges.values()) {
        const p = curve(e);
        const near = Math.max(nearness(p[0], p[1]), nearness(p[6], p[7]));
        ctx!.strokeStyle = palette.faint;
        ctx!.globalAlpha = (0.3 + 0.3 * near) * e.alpha;
        ctx!.beginPath();
        ctx!.moveTo(p[0], p[1]);
        ctx!.bezierCurveTo(p[2], p[3], p[4], p[5], p[6], p[7]);
        ctx!.stroke();
      }

      for (const pk of packets) {
        const e = edges.get(pk.edge);
        if (!e) continue;
        const p = curve(e);
        const trailStep = 5 / Math.max(Math.hypot(p[6] - p[0], p[7] - p[1]), 1);
        ctx!.fillStyle = pk.color;
        for (let i = 6; i >= 1; i--) {
          const t = pk.t - i * trailStep;
          if (t < 0) continue;
          const [x, y] = pointAt(p, t);
          ctx!.globalAlpha = 0.6 * (1 - i / 7) * e.alpha;
          ctx!.beginPath();
          ctx!.arc(x, y, 1.9, 0, Math.PI * 2);
          ctx!.fill();
        }
        const [x, y] = pointAt(p, pk.t);
        ctx!.globalAlpha = 0.22 * e.alpha;
        ctx!.beginPath();
        ctx!.arc(x, y, 7, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.globalAlpha = 0.95 * e.alpha;
        ctx!.beginPath();
        ctx!.arc(x, y, 2.8, 0, Math.PI * 2);
        ctx!.fill();
      }

      // A notch smaller on phone-sized canvases, where layers are tighter.
      ctx!.font = `${width < 520 ? 10.5 : 12}px ${fontFamily}`;
      ctx!.lineJoin = "round";
      ctx!.textBaseline = "top";
      for (const n of nodes.values()) {
        const [x, y] = pos(n);
        const near = nearness(x, y);

        if (n.pulse > 0) {
          ctx!.strokeStyle = n.pulseColor;
          ctx!.globalAlpha = n.pulse * 0.7 * n.alpha;
          ctx!.beginPath();
          ctx!.arc(x, y, NODE_RADIUS + (1 - n.pulse) * 12, 0, Math.PI * 2);
          ctx!.stroke();
        }

        ctx!.globalAlpha = n.alpha;
        ctx!.fillStyle = palette.bg;
        ctx!.beginPath();
        ctx!.arc(x, y, NODE_RADIUS, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.strokeStyle = n.pulse > 0.2 ? n.pulseColor : palette.faint;
        ctx!.globalAlpha = (0.7 + 0.3 * Math.max(near, n.pulse)) * n.alpha;
        ctx!.stroke();

        // The task id, plus its operator when the pointer is close.
        // Each is outlined in the background color so edges don't cut
        // through the text.
        const [idX, idY, opX, opY] = labelPosition(n, x, y);
        const label = (text: string, lx: number, ly: number, color: string) => {
          ctx!.strokeStyle = palette.bg;
          ctx!.lineWidth = 4;
          ctx!.strokeText(text, lx, ly);
          ctx!.fillStyle = color;
          ctx!.fillText(text, lx, ly);
        };
        ctx!.globalAlpha = (0.65 + 0.35 * near) * n.alpha;
        label(n.id, idX, idY, near > 0.05 ? palette.fg : palette.faint);
        if (near > 0.05) {
          ctx!.globalAlpha = 0.8 * near * n.alpha;
          label(n.operator, opX, opY, palette.faint);
        }
        ctx!.lineWidth = 1.25;
      }
      ctx!.globalAlpha = 1;
    }

    // Labels are centered on their node, alternating above and below by layer
    // so neighboring columns don't collide.
    function labelPosition(n: SceneNode, x: number, y: number) {
      const idWidth = ctx!.measureText(n.id).width;
      const opWidth = ctx!.measureText(n.operator).width;
      const clampX = (w: number) =>
        Math.min(Math.max(x - w / 2, 4), width - w - 4);
      return n.layer % 2 === 0
        ? [clampX(idWidth), y + 10, clampX(opWidth), y + 24]
        : [clampX(idWidth), y - 23, clampX(opWidth), y - 37];
    }

    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      step(dt, now);
      draw();
      raf = requestAnimationFrame(frame);
    }

    function start() {
      cancelAnimationFrame(raf);
      if (reduceMotion.matches || document.hidden) {
        settle(Infinity);
        draw();
        return;
      }
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onPointerLeave = () => {
      pointer = null;
    };
    const themeObserver = new MutationObserver(() => {
      palette = readPalette();
      readFont();
      if (reduceMotion.matches) draw();
    });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(wrapper);
    resize();
    setGraph(graphRef.current);
    setGraphRef.current = setGraph;
    start();
    // Pick up the web font once it has loaded.
    document.fonts?.ready.then(readFont);
    window.addEventListener("pointermove", onPointerMove);
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", start);
    reduceMotion.addEventListener("change", start);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      setGraphRef.current = null;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener(
        "pointerleave",
        onPointerLeave,
      );
      document.removeEventListener("visibilitychange", start);
      reduceMotion.removeEventListener("change", start);
      themeObserver.disconnect();
    };
  }, [variant]);

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
    </div>
  );
}
