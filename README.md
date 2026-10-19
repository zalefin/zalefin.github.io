# zachlef.in

Source for [zachlef.in](https://zachlef.in): a Next.js static export in
gruvbox, deployed to GitHub Pages.

## Develop

```sh
pnpm install
pnpm dev          # http://localhost:3000
```

## The DAG editor

The graph behind the page is an Airflow DAG. `src/dag/zachlef_in.py` is the DAG file
shown in the editor, and `src/dag/airflow_stub.py` is a stand-in `airflow`
package: real import paths resolve, but only the DAG's shape is recorded.

In the browser, Pyodide (from jsDelivr) runs in a module worker
(`public/pyodide-worker.mjs`) and compiles the editor's code with the stub.
`pnpm build` first runs `pnpm dag`, which compiles the shipped DAG the same way
in Node and writes `src/dag/generated.ts`, so the page can draw the graph before
Pyodide loads. Run `pnpm dag` after editing either `.py` file.

## Check

```sh
pnpm lint
pnpm format:check # or `pnpm format` to fix
pnpm typecheck
pnpm build        # static export to out/
pnpm exec playwright install chromium   # once
pnpm test:e2e     # smoke tests against out/
```

## Deploy

`.github/workflows/ci.yml` runs the checks above on every pull request. Pushes
to `master` also deploy `out/` to GitHub Pages (Settings → Pages → Source must
be "GitHub Actions").

zachlef.in is a reverse proxy in front of zalefin.github.io, so don't add a
`CNAME` file or set a custom domain in the Pages settings.
