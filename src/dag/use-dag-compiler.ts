"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CompileResult } from "./types";

// Messages to and from public/pyodide-worker.mjs.
type WorkerRequest =
  | { type: "load"; indexURL: string; runtime: string }
  | { type: "compile"; id: number; source: string };

type WorkerResponse =
  | { type: "ready"; runtime: string }
  | { type: "load-error"; message: string }
  | { type: "compiled"; id: number; json: string };

export type CompilerPhase = "idle" | "loading" | "ready" | "failed";

// User code can loop forever; past this, the worker is torn down.
const COMPILE_TIMEOUT_MS = 5000;

type Pending = {
  resolve: (result: CompileResult) => void;
  started: number;
  timer: ReturnType<typeof setTimeout>;
};

/** Compiles DAG files with Pyodide in a Web Worker, loaded on first use. */
export function useDagCompiler() {
  const [phase, setPhase] = useState<CompilerPhase>("idle");
  const [runtime, setRuntime] = useState("");
  const workerRef = useRef<Worker | null>(null);
  const readyRef = useRef<Promise<boolean> | null>(null);
  const pendingRef = useRef(new Map<number, Pending>());
  const nextId = useRef(0);

  const teardown = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    readyRef.current = null;
  }, []);

  const ensureWorker = useCallback(() => {
    if (readyRef.current) return readyRef.current;
    const worker = new Worker("/pyodide-worker.mjs", { type: "module" });
    workerRef.current = worker;
    setPhase("loading");
    readyRef.current = new Promise<boolean>((resolve) => {
      worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
        if (data.type === "ready") {
          setRuntime(data.runtime);
          setPhase("ready");
          resolve(true);
        } else if (data.type === "load-error") {
          setPhase("failed");
          setRuntime(data.message);
          resolve(false);
          teardown();
        } else {
          const pending = pendingRef.current.get(data.id);
          if (!pending) return;
          pendingRef.current.delete(data.id);
          clearTimeout(pending.timer);
          const out = JSON.parse(data.json);
          pending.resolve(
            out.ok
              ? {
                  ok: true,
                  graph: {
                    dagId: out.dagId,
                    tasks: out.tasks,
                    edges: out.edges,
                  },
                  ms: Math.round(performance.now() - pending.started),
                }
              : { ok: false, error: out.error, line: out.line },
          );
        }
      };
      worker.onerror = (event) => {
        setPhase("failed");
        setRuntime(event.message || "the Python worker crashed");
        resolve(false);
        teardown();
      };
    });
    // The runtime is only needed once Python loads, so it's fetched lazily too.
    import("./generated").then(({ DAG_RUNTIME, PYODIDE_VERSION }) =>
      worker.postMessage({
        type: "load",
        indexURL: `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
        runtime: DAG_RUNTIME,
      } satisfies WorkerRequest),
    );
    return readyRef.current;
  }, [teardown]);

  const preload = useCallback(() => {
    void ensureWorker();
  }, [ensureWorker]);

  const compile = useCallback(
    async (source: string): Promise<CompileResult> => {
      const ready = await ensureWorker();
      const worker = workerRef.current;
      if (!ready || !worker) {
        return { ok: false, error: "Python failed to load", line: null };
      }
      const id = nextId.current++;
      return new Promise<CompileResult>((resolve) => {
        const timer = setTimeout(() => {
          pendingRef.current.delete(id);
          teardown();
          setPhase("idle");
          resolve({
            ok: false,
            error: `TimeoutError: still running after ${COMPILE_TIMEOUT_MS / 1000}s (an infinite loop?)`,
            line: null,
          });
        }, COMPILE_TIMEOUT_MS);
        pendingRef.current.set(id, {
          resolve,
          started: performance.now(),
          timer,
        });
        worker.postMessage({
          type: "compile",
          id,
          source,
        } satisfies WorkerRequest);
      });
    },
    [ensureWorker, teardown],
  );

  useEffect(() => teardown, [teardown]);

  return { phase, runtime, preload, compile };
}
