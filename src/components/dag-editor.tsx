"use client";

import type { EditorView } from "@codemirror/view";
import { motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { DEFAULT_DAG_SOURCE } from "@/dag/generated";
import type { DagGraph } from "@/dag/types";
import { useDagCompiler } from "@/dag/use-dag-compiler";
import { TerminalWindow } from "./terminal-window";

type EditorSetup = typeof import("@/dag/editor-setup");

// The graph stays legible up to about this many tasks.
const MAX_TASKS = 100;

// Matches Tailwind's lg breakpoint, where the editor is always open in the
// left column.
const WIDE_QUERY = "(min-width: 64rem)";
const subscribeWide = (onChange: () => void) => {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

type Outcome =
  | { ok: true; dagId: string; tasks: number; edges: number; ms: number }
  | { ok: false; message: string; line: number | null };

export function DagEditor({
  onCompiled,
  preloadAfter,
}: {
  onCompiled: (graph: DagGraph) => void;
  /** Seconds to wait before warming up Python, so it doesn't compete with the intro. */
  preloadAfter: number;
}) {
  const reduceMotion = useReducedMotion();
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
  const [open, setOpen] = useState(false);
  const onScreen = wide || open;

  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const setupRef = useRef<EditorSetup | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const { phase, runtime, preload, compile } = useDagCompiler();

  const run = useCallback(async () => {
    const source = viewRef.current?.state.doc.toString() ?? DEFAULT_DAG_SOURCE;
    setCompiling(true);
    const result = await compile(source);
    setCompiling(false);

    let next: Outcome;
    if (!result.ok) {
      next = { ok: false, message: result.error, line: result.line };
    } else if (result.graph.tasks.length > MAX_TASKS) {
      next = {
        ok: false,
        message: `too many tasks (${result.graph.tasks.length}); the graph draws up to ${MAX_TASKS}`,
        line: null,
      };
    } else {
      onCompiled(result.graph);
      next = {
        ok: true,
        dagId: result.graph.dagId,
        tasks: result.graph.tasks.length,
        edges: result.graph.edges.length,
        ms: result.ms,
      };
    }
    setOutcome(next);
    if (viewRef.current && setupRef.current) {
      setupRef.current.showError(viewRef.current, next.ok ? null : next);
    }
  }, [compile, onCompiled]);

  // CodeMirror's keymap is created once; route it to the latest `run`.
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  // Load CodeMirror once the editor is on screen.
  useEffect(() => {
    if (!onScreen || viewRef.current) return;
    let cancelled = false;
    import("@/dag/editor-setup").then((setup) => {
      if (cancelled || !hostRef.current || viewRef.current) return;
      setupRef.current = setup;
      viewRef.current = setup.createEditor(
        hostRef.current,
        DEFAULT_DAG_SOURCE,
        () => void runRef.current(),
      );
      setEditorReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [onScreen]);

  useEffect(() => () => viewRef.current?.destroy(), []);

  // Warm up Python once the intro has played and the browser is idle.
  useEffect(() => {
    if (!onScreen) return;
    const timer = setTimeout(
      () => {
        if ("requestIdleCallback" in window) requestIdleCallback(preload);
        else preload();
      },
      wide ? preloadAfter * 1000 : 0,
    );
    return () => clearTimeout(timer);
  }, [onScreen, wide, preloadAfter, preload]);

  // Then compile the shipped DAG, so Pyodide draws the graph rather
  // than the build-time snapshot.
  const compiledOnce = useRef(false);
  useEffect(() => {
    if (phase !== "ready" || compiledOnce.current) return;
    compiledOnce.current = true;
    void runRef.current();
  }, [phase]);

  function reset() {
    if (!viewRef.current || !setupRef.current) return;
    setupRef.current.setDocument(viewRef.current, DEFAULT_DAG_SOURCE);
    void run();
  }

  let status: { text: string; tone: "muted" | "ok" | "error" };
  if (compiling) {
    status = {
      text: phase === "ready" ? "compiling…" : "loading python…",
      tone: "muted",
    };
  } else if (outcome?.ok) {
    status = {
      text: `✓ ${outcome.dagId} · ${outcome.tasks} tasks · ${outcome.edges} edges · ${outcome.ms} ms`,
      tone: "ok",
    };
  } else if (outcome) {
    const where = outcome.line ? ` (line ${outcome.line})` : "";
    status = { text: `✗ ${outcome.message}${where}`, tone: "error" };
  } else if (phase === "loading") {
    status = { text: "loading python…", tone: "muted" };
  } else if (phase === "failed") {
    status = { text: `✗ python failed to load: ${runtime}`, tone: "error" };
  } else {
    status = { text: "edit the DAG, then compile", tone: "muted" };
  }

  return (
    <div className="flex w-full max-w-xl min-w-0 flex-col items-center gap-3 lg:h-full lg:min-h-0 lg:max-w-none">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="dag-editor"
        className="rounded-lg border border-panel-border bg-panel px-4 py-2 text-sm text-fg-muted backdrop-blur-md transition-colors hover:text-orange lg:hidden"
      >
        <span className="text-orange">{"</>"}</span>{" "}
        {open ? "hide the dag" : "edit the dag"}
      </button>

      <motion.section
        id="dag-editor"
        aria-label="Airflow DAG editor"
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className={`${open ? "flex" : "hidden"} w-full flex-1 flex-col lg:flex lg:min-h-0`}
      >
        <TerminalWindow
          title="~/dags/zachlef_in.py"
          className="flex-1 lg:min-h-0"
          actions={
            <>
              <span className="hidden text-[11px] text-fg-faint sm:inline">
                ctrl/⌘ + enter
              </span>
              <button
                type="button"
                onClick={() => void run()}
                disabled={compiling}
                className="rounded-md bg-orange-bright px-2.5 py-1 text-xs font-semibold text-bg transition-opacity hover:opacity-85 disabled:opacity-60"
              >
                ▶ compile
              </button>
            </>
          }
        >
          <div className="relative h-80 min-h-0 text-left lg:h-auto lg:min-h-48 lg:flex-1">
            <div ref={hostRef} className="absolute inset-0" />
            {!editorReady && (
              // Until CodeMirror loads: the same source, unhighlighted.
              <pre className="absolute inset-0 overflow-auto py-2.5 pr-4 pl-11 text-[12.5px] leading-[1.6] text-fg-muted">
                {DEFAULT_DAG_SOURCE}
              </pre>
            )}
          </div>
          <div className="flex items-center gap-3 border-t border-panel-border px-4 py-2 text-[11px]">
            <p
              role="status"
              aria-live="polite"
              title={runtime || undefined}
              className={`min-w-0 flex-1 truncate ${
                status.tone === "ok"
                  ? "text-green"
                  : status.tone === "error"
                    ? "text-red"
                    : "text-fg-faint"
              }`}
            >
              {status.text}
            </p>
            <button
              type="button"
              onClick={reset}
              className="shrink-0 text-fg-faint underline-offset-4 transition-colors hover:text-orange hover:underline"
            >
              reset
            </button>
          </div>
        </TerminalWindow>
      </motion.section>
    </div>
  );
}
