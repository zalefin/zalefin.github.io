// Runs Pyodide off the main thread. Served as-is from public/ rather than
// bundled: Turbopack emits classic workers, and Pyodide needs a module worker.
//
// Protocol (see src/dag/use-dag-compiler.ts):
//   in:  { type: "load", indexURL, runtime }   then   { type: "compile", id, source }
//   out: { type: "ready", runtime } | { type: "load-error", message }
//        | { type: "compiled", id, json }

let pyodide = null;

async function load({ indexURL, runtime }) {
  const { loadPyodide } = await import(`${indexURL}pyodide.mjs`);
  const py = await loadPyodide({ indexURL });
  py.runPython(runtime);
  return py;
}

self.onmessage = async ({ data }) => {
  if (data.type === "load") {
    try {
      pyodide ??= load(data);
      const py = await pyodide;
      const python = py.runPython("import sys; sys.version.split()[0]");
      self.postMessage({
        type: "ready",
        runtime: `python ${python} · pyodide ${py.version}`,
      });
    } catch (err) {
      self.postMessage({ type: "load-error", message: String(err) });
    }
  } else if (data.type === "compile") {
    const py = await pyodide;
    const json = py.globals.get("compile_dag")(data.source);
    self.postMessage({ type: "compiled", id: data.id, json });
  }
};
