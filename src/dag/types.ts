export type DagTask = { id: string; operator: string };

/** A DAG's shape: its tasks, and edges as [upstream, downstream] task ids. */
export type DagGraph = {
  dagId: string;
  tasks: DagTask[];
  edges: [string, string][];
};

export type CompileResult =
  | { ok: true; graph: DagGraph; ms: number }
  | { ok: false; error: string; line: number | null };
