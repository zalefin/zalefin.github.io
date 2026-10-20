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

// Screens where Python warms up in the background before the editor is
// opened. On smaller ones it waits until the dropdown is.
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
  // CodeMirror mounts on first open and then stays, keeping edits when the
  // dropdown closes.
  const [opened, setOpened] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

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

  function toggle() {
    setOpen((o) => !o);
    setOpened(true);
  }

  // Escape closes the dropdown, wherever focus is.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Return focus to the toggle once the dropdown has closed. Doing it here
  // rather than in the close handlers runs it after any pending effect that
  // focuses the editor, so the editor can't take focus back.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) wasOpen.current = true;
    else if (wasOpen.current) toggleRef.current?.focus();
  }, [open]);

  // Load CodeMirror the first time the dropdown opens.
  useEffect(() => {
    if (!opened || viewRef.current) return;
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
  }, [opened]);

  useEffect(() => {
    if (open && editorReady) viewRef.current?.focus();
  }, [open, editorReady]);

  useEffect(() => () => viewRef.current?.destroy(), []);

  // Warm up Python once the intro has played and the browser is idle, or
  // right away when the dropdown opens.
  useEffect(() => {
    if (!wide && !opened) return;
    const timer = setTimeout(
      () => {
        if ("requestIdleCallback" in window) requestIdleCallback(preload);
        else preload();
      },
      opened ? 0 : preloadAfter * 1000,
    );
    return () => clearTimeout(timer);
  }, [wide, opened, preloadAfter, preload]);

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
    <>
      <button
        ref={toggleRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="dag-editor"
        className="fixed top-4 right-16 z-30 flex h-10 items-center gap-2 rounded-full border border-panel-border bg-panel px-4 text-sm text-fg-muted backdrop-blur-md transition-colors hover:text-orange aria-expanded:text-orange"
      >
        <span className="text-orange">{"</>"}</span> edit dag
      </button>

      <motion.section
        id="dag-editor"
        aria-label="Airflow DAG editor"
        inert={!open}
        initial={false}
        animate={open ? "open" : "closed"}
        variants={{
          open: { opacity: 1, y: 0, scale: 1, visibility: "visible" },
          closed: {
            opacity: 0,
            y: reduceMotion ? 0 : -8,
            scale: reduceMotion ? 1 : 0.98,
            transitionEnd: { visibility: "hidden" },
          },
        }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ visibility: "hidden", transformOrigin: "top right" }}
        className="fixed top-16 right-4 z-30 w-[min(34rem,calc(100vw-2rem))]"
      >
        <TerminalWindow
          title="~/dags/zachlef_in.py"
          // Nearly opaque: the dropdown sits over the card on small screens.
          className="bg-bg/95!"
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
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close the DAG editor"
                className="grid size-6 place-items-center rounded-md text-fg-faint transition-colors hover:text-orange"
              >
                ✕
              </button>
            </>
          }
        >
          <div className="relative h-72 text-left sm:h-80">
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
    </>
  );
}
