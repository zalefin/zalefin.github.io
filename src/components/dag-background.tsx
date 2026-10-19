"use client";

import { useEffect, useRef } from "react";

// An ambient, randomly generated DAG with data packets flowing through it,
// drawn on a canvas behind the page. Nodes near the pointer light up and
// packets near it speed up.

const LABELS = [
  "extract",
  "s3",
  "spark",
  "nifi",
  "airflow",
  "agent",
  "validate",
  "load",
  "kafka",
  "iceberg",
  "athena",
  "emr",
  "mcp",
  "transform",
  "schema",
  "sensor",
  "postgres",
  "redis",
  "lambda",
  "terraform",
  "docker",
  "dedupe",
  "publish",
];

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

type Node = {
  // Position normalized to 0..1, so a resize only rescales the graph.
  nx: number;
  ny: number;
  label: string;
  out: number[];
  pulse: number;
  pulseColor: string;
};

type Edge = { from: number; to: number; length: number };

type Packet = { edge: number; t: number; speed: number; color: string };

type Palette = Record<
  (typeof PACKET_COLORS)[number] | "fg" | "faint" | "bg" | "red",
  string
>;

type Variant = "flow" | "crashed";

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function layerCountFor(width: number) {
  return Math.max(4, Math.min(7, Math.round(width / 260)));
}

function generateGraph(layerCount: number) {
  const labels = shuffle(LABELS);
  const nodes: Node[] = [];
  const layers: number[][] = [];

  for (let l = 0; l < layerCount; l++) {
    const edgeLayer = l === 0 || l === layerCount - 1;
    const count = edgeLayer
      ? 2 + Math.round(Math.random())
      : 2 + Math.floor(Math.random() * 3);
    const ids: number[] = [];
    for (let i = 0; i < count; i++) {
      const slot = (i + 0.5) / count;
      nodes.push({
        nx: 0.06 + (0.88 * l) / (layerCount - 1) + (Math.random() - 0.5) * 0.05,
        ny: 0.1 + 0.8 * slot + (Math.random() - 0.5) * (0.5 / count),
        label: labels[nodes.length % labels.length],
        out: [],
        pulse: 0,
        pulseColor: "",
      });
      ids.push(nodes.length - 1);
    }
    layers.push(ids);
  }

  const edges: Edge[] = [];
  const seen = new Set<string>();
  const connect = (from: number, to: number) => {
    const key = `${from}-${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    nodes[from].out.push(edges.length);
    edges.push({ from, to, length: 0 });
  };
  const byDistance = (from: number, candidates: number[]) =>
    [...candidates].sort(
      (a, b) =>
        Math.abs(nodes[a].ny - nodes[from].ny) -
        Math.abs(nodes[b].ny - nodes[from].ny),
    );

  for (let l = 0; l < layerCount - 1; l++) {
    const next = layers[l + 1];
    for (const id of layers[l]) {
      const near = byDistance(id, next);
      connect(id, near[0]);
      if (Math.random() < 0.45 && near[1] !== undefined) connect(id, near[1]);
      if (l < layerCount - 2 && Math.random() < 0.12) {
        connect(id, byDistance(id, layers[l + 2])[0]);
      }
    }
    // Every node past the first layer needs at least one input.
    for (const id of next) {
      if (!edges.some((e) => e.to === id))
        connect(byDistance(id, layers[l])[0], id);
    }
  }

  const sources = nodes.flatMap((_, i) =>
    edges.some((e) => e.to === i) ? [] : [i],
  );
  return { nodes, edges, sources };
}

function bezierPoints(ax: number, ay: number, bx: number, by: number) {
  const dx = (bx - ax) * 0.5;
  return [ax, ay, ax + dx, ay, bx - dx, by, bx, by] as const;
}

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

export function DagBackground({ variant = "flow" }: { variant?: Variant }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let palette = readPalette();
    let font = `11px ${getComputedStyle(document.body).fontFamily}`;
    let width = 0;
    let height = 0;
    let layerCount = 0;
    let graph = generateGraph(4);
    let packets: Packet[] = [];
    let pointer: { x: number; y: number } | null = null;
    let raf = 0;
    let last = 0;
    let nextSpawn = 0;

    const pos = (n: Node) => [n.nx * width, n.ny * height] as const;
    const curve = (e: Edge) => {
      const [ax, ay] = pos(graph.nodes[e.from]);
      const [bx, by] = pos(graph.nodes[e.to]);
      return bezierPoints(ax, ay, bx, by);
    };
    const nearness = (x: number, y: number) =>
      pointer
        ? Math.max(
            0,
            1 - Math.hypot(x - pointer.x, y - pointer.y) / POINTER_RADIUS,
          )
        : 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const layers = layerCountFor(width);
      if (layers !== layerCount) {
        layerCount = layers;
        graph = generateGraph(layers);
        packets = [];
      }
      for (const e of graph.edges) {
        const p = curve(e);
        let len = 0;
        let [px, py] = pointAt(p, 0);
        for (let i = 1; i <= 16; i++) {
          const [x, y] = pointAt(p, i / 16);
          len += Math.hypot(x - px, y - py);
          [px, py] = [x, y];
        }
        e.length = len;
      }
      if (reduceMotion.matches) draw();
    }

    function packetColor() {
      if (variant === "crashed") return palette.red;
      return palette[
        PACKET_COLORS[Math.floor(Math.random() * PACKET_COLORS.length)]
      ];
    }

    function spawn() {
      const src =
        graph.sources[Math.floor(Math.random() * graph.sources.length)];
      const out = graph.nodes[src].out;
      if (!out.length) return;
      packets.push({
        edge: out[Math.floor(Math.random() * out.length)],
        t: 0,
        speed: (variant === "crashed" ? 45 : 70) + Math.random() * 40,
        color: packetColor(),
      });
    }

    function step(dt: number, now: number) {
      if (now >= nextSpawn && packets.length < MAX_PACKETS) {
        spawn();
        nextSpawn = now + 450 + Math.random() * 700;
      }
      packets = packets.filter((pk) => {
        const e = graph.edges[pk.edge];
        const [x, y] = pointAt(curve(e), pk.t);
        const boost = 1 + 1.4 * nearness(x, y);
        pk.t += (pk.speed * boost * dt) / Math.max(e.length, 1);
        if (pk.t < 1) return true;

        const node = graph.nodes[e.to];
        node.pulse = 1;
        node.pulseColor = pk.color;
        // On the 404 page, packets segfault at nodes now and then.
        if (!node.out.length || (variant === "crashed" && Math.random() < 0.4))
          return false;
        pk.edge = node.out[Math.floor(Math.random() * node.out.length)];
        pk.t = 0;
        return true;
      });
      for (const n of graph.nodes) n.pulse = Math.max(0, n.pulse - dt * 1.6);
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);
      ctx!.lineWidth = 1;

      for (const e of graph.edges) {
        const p = curve(e);
        const near = Math.max(nearness(p[0], p[1]), nearness(p[6], p[7]));
        ctx!.strokeStyle = palette.faint;
        ctx!.globalAlpha = 0.16 + 0.24 * near;
        ctx!.beginPath();
        ctx!.moveTo(p[0], p[1]);
        ctx!.bezierCurveTo(p[2], p[3], p[4], p[5], p[6], p[7]);
        ctx!.stroke();
      }

      for (const pk of packets) {
        const e = graph.edges[pk.edge];
        const p = curve(e);
        const trailStep = 5 / Math.max(e.length, 1);
        ctx!.fillStyle = pk.color;
        for (let i = 6; i >= 1; i--) {
          const t = pk.t - i * trailStep;
          if (t < 0) continue;
          const [x, y] = pointAt(p, t);
          ctx!.globalAlpha = 0.5 * (1 - i / 7);
          ctx!.beginPath();
          ctx!.arc(x, y, 1.6, 0, Math.PI * 2);
          ctx!.fill();
        }
        const [x, y] = pointAt(p, pk.t);
        ctx!.globalAlpha = 0.18;
        ctx!.beginPath();
        ctx!.arc(x, y, 6, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.globalAlpha = 0.95;
        ctx!.beginPath();
        ctx!.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx!.fill();
      }

      ctx!.font = font;
      ctx!.textBaseline = "top";
      for (const n of graph.nodes) {
        const [x, y] = pos(n);
        const near = nearness(x, y);

        if (n.pulse > 0) {
          ctx!.strokeStyle = n.pulseColor;
          ctx!.globalAlpha = n.pulse * 0.7;
          ctx!.beginPath();
          ctx!.arc(x, y, NODE_RADIUS + (1 - n.pulse) * 12, 0, Math.PI * 2);
          ctx!.stroke();
        }

        ctx!.globalAlpha = 1;
        ctx!.fillStyle = palette.bg;
        ctx!.beginPath();
        ctx!.arc(x, y, NODE_RADIUS, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.strokeStyle = n.pulse > 0.2 ? n.pulseColor : palette.faint;
        ctx!.globalAlpha = 0.45 + 0.55 * Math.max(near, n.pulse);
        ctx!.stroke();

        ctx!.fillStyle = near > 0.05 ? palette.fg : palette.faint;
        ctx!.globalAlpha = 0.25 + 0.65 * near;
        // Flip labels that would run off the right edge to the node's left.
        const labelWidth = ctx!.measureText(n.label).width;
        const labelX =
          x + 8 + labelWidth > width - 8 ? x - 8 - labelWidth : x + 8;
        ctx!.fillText(n.label, labelX, y + 6);
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
      font = `11px ${getComputedStyle(document.body).fontFamily}`;
      if (reduceMotion.matches) draw();
    });

    resize();
    start();
    // Pick up the web font once it has loaded.
    document.fonts?.ready.then(() => {
      font = `11px ${getComputedStyle(document.body).fontFamily}`;
    });
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
