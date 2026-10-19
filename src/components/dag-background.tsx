"use client";

import { useEffect, useRef } from "react";
import { layoutGraph } from "@/dag/layout";
import type { DagGraph } from "@/dag/types";

// A DAG drawn on a canvas behind the page, with data packets flowing through
// it. Nodes near the pointer light up and packets near it speed up. When the
// graph changes, nodes glide to their new places and fade in or out.

const PACKET_COLORS = [
  "orange",
  "aqua",
  "yellow",
  "green",
  "blue",
  "purple",
] as const;

const NODE_RADIUS = 4;
const POINTER_RADIUS = 180;
const MAX_PACKETS = 28;
// Margins as a fraction of the screen, along and across the flow.
const MARGIN_ALONG = 0.07;
const MARGIN_ACROSS = 0.1;

type SceneNode = {
  id: string;
  operator: string;
  // Placement (see NodePlacement), easing toward its target.
  u: number;
  v: number;
  tu: number;
  tv: number;
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

export function DagBackground({
  graph,
  variant = "flow",
}: {
  graph: DagGraph;
  variant?: Variant;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef(graph);
  const setGraphRef = useRef<((graph: DagGraph) => void) | null>(null);

  useEffect(() => {
    graphRef.current = graph;
    setGraphRef.current?.(graph);
  }, [graph]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const nodes = new Map<string, SceneNode>();
    const edges = new Map<string, SceneEdge>();
    let outgoing = new Map<string, string[]>();
    let sources: string[] = [];
    let palette = readPalette();
    let font = "";
    let width = 0;
    let height = 0;
    let packets: Packet[] = [];
    let pointer: { x: number; y: number } | null = null;
    let raf = 0;
    let last = 0;
    let nextSpawn = 0;

    const readFont = () => {
      const family = getComputedStyle(document.body).fontFamily;
      font = `11px ${family}`;
    };
    readFont();

    // Portrait screens flow top to bottom; everything else left to right.
    const vertical = () => height > width * 1.15;
    const pos = (n: SceneNode): [number, number] => {
      const along = MARGIN_ALONG + (1 - 2 * MARGIN_ALONG) * n.u;
      const across = MARGIN_ACROSS + (1 - 2 * MARGIN_ACROSS) * n.v;
      return vertical()
        ? [across * width, along * height]
        : [along * width, across * height];
    };
    const curve = (e: SceneEdge) => {
      const [ax, ay] = pos(nodes.get(e.from)!);
      const [bx, by] = pos(nodes.get(e.to)!);
      if (vertical()) {
        const dy = (by - ay) * 0.5;
        return [ax, ay, ax, ay + dy, bx, by - dy, bx, by] as const;
      }
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
      const live = new Set<string>();
      for (const task of next.tasks) {
        const { u, v } = placements.get(task.id)!;
        live.add(task.id);
        const node = nodes.get(task.id);
        if (node) {
          Object.assign(node, { tu: u, tv: v, targetAlpha: 1 });
          node.operator = task.operator;
        } else {
          nodes.set(task.id, {
            id: task.id,
            operator: task.operator,
            u,
            v,
            tu: u,
            tv: v,
            alpha: 0,
            targetAlpha: 1,
            pulse: 0,
            pulseColor: "",
          });
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
        n.v += (n.tv - n.v) * k;
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
      width = window.innerWidth;
      height = window.innerHeight;
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
      ctx!.lineWidth = 1;

      for (const e of edges.values()) {
        const p = curve(e);
        const near = Math.max(nearness(p[0], p[1]), nearness(p[6], p[7]));
        ctx!.strokeStyle = palette.faint;
        ctx!.globalAlpha = (0.16 + 0.24 * near) * e.alpha;
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
          ctx!.globalAlpha = 0.5 * (1 - i / 7) * e.alpha;
          ctx!.beginPath();
          ctx!.arc(x, y, 1.6, 0, Math.PI * 2);
          ctx!.fill();
        }
        const [x, y] = pointAt(p, pk.t);
        ctx!.globalAlpha = 0.18 * e.alpha;
        ctx!.beginPath();
        ctx!.arc(x, y, 6, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.globalAlpha = 0.95 * e.alpha;
        ctx!.beginPath();
        ctx!.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx!.fill();
      }

      ctx!.font = font;
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
        ctx!.globalAlpha = (0.45 + 0.55 * Math.max(near, n.pulse)) * n.alpha;
        ctx!.stroke();

        // The task id, plus its operator when the pointer is close. Labels
        // that would run off the right edge flip to the node's left.
        const labelWidth = ctx!.measureText(n.id).width;
        const flip = x + 8 + labelWidth > width - 8;
        const labelX = flip ? x - 8 - labelWidth : x + 8;
        ctx!.fillStyle = near > 0.05 ? palette.fg : palette.faint;
        ctx!.globalAlpha = (0.25 + 0.65 * near) * n.alpha;
        ctx!.fillText(n.id, labelX, y + 6);
        if (near > 0.05) {
          const opWidth = ctx!.measureText(n.operator).width;
          ctx!.fillStyle = palette.faint;
          ctx!.globalAlpha = 0.8 * near * n.alpha;
          ctx!.fillText(n.operator, flip ? x - 8 - opWidth : x + 8, y + 20);
        }
      }
      ctx!.globalAlpha = 1;
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
      pointer = { x: e.clientX, y: e.clientY };
    };
    const onPointerLeave = () => {
      pointer = null;
    };
    const themeObserver = new MutationObserver(() => {
      palette = readPalette();
      readFont();
      if (reduceMotion.matches) draw();
    });

    resize();
    setGraph(graphRef.current);
    setGraphRef.current = setGraph;
    start();
    // Pick up the web font once it has loaded.
    document.fonts?.ready.then(readFont);
    window.addEventListener("resize", resize);
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
      window.removeEventListener("resize", resize);
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
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <canvas ref={canvasRef} className="size-full" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,var(--bg)_115%)]" />
    </div>
  );
}
