import type { DagGraph } from "./types";

/**
 * Where a task sits: `u` runs along the flow (0 = first layer, 1 = last) and
 * `v` across it, both 0..1. The background maps these onto the screen.
 */
export type NodePlacement = { u: number; v: number };

// A small, stable per-task offset, so recompiling the same DAG doesn't move
// anything but the layout still looks hand-placed rather than gridded.
function jitter(id: string, salt: number) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++)
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000 - 0.5;
}

/** Layered layout: each task's layer is its longest path from a source. */
export function layoutGraph(graph: DagGraph): Map<string, NodePlacement> {
  const ids = graph.tasks.map((t) => t.id);
  const upstream = new Map(ids.map((id) => [id, [] as string[]]));
  const downstream = new Map(ids.map((id) => [id, [] as string[]]));
  for (const [up, down] of graph.edges) {
    downstream.get(up)?.push(down);
    upstream.get(down)?.push(up);
  }

  // Kahn's algorithm, tracking the longest path to each task.
  const layer = new Map(ids.map((id) => [id, 0]));
  const pending = new Map(ids.map((id) => [id, upstream.get(id)!.length]));
  const queue = ids.filter((id) => pending.get(id) === 0);
  while (queue.length) {
    const id = queue.shift()!;
    for (const down of downstream.get(id)!) {
      layer.set(down, Math.max(layer.get(down)!, layer.get(id)! + 1));
      pending.set(down, pending.get(down)! - 1);
      if (pending.get(down) === 0) queue.push(down);
    }
  }

  const layerCount = Math.max(0, ...layer.values()) + 1;
  const layers: string[][] = Array.from({ length: layerCount }, () => []);
  for (const id of ids) layers[layer.get(id)!].push(id);

  // Order each layer by the average position of its parents, to cut down on
  // crossing edges.
  const position = new Map<string, number>();
  const placements = new Map<string, NodePlacement>();
  layers.forEach((members, l) => {
    const keyed = members.map((id, i) => {
      const parents = upstream.get(id)!.filter((p) => position.has(p));
      const key = parents.length
        ? parents.reduce((sum, p) => sum + position.get(p)!, 0) / parents.length
        : i / Math.max(1, members.length - 1);
      return { id, key };
    });
    keyed.sort((a, b) => a.key - b.key);
    keyed.forEach(({ id }, i) => {
      const slot = members.length === 1 ? 0.5 : i / (members.length - 1);
      position.set(id, slot);
      const v = members.length === 1 ? 0.5 : 0.08 + 0.84 * slot;
      placements.set(id, {
        u: layerCount === 1 ? 0.5 : l / (layerCount - 1) + jitter(id, 1) * 0.03,
        v: v + jitter(id, 2) * (0.35 / Math.max(2, members.length)),
      });
    });
  });
  return placements;
}
