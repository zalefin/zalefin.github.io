# zachlef.in

Source for [zachlef.in](https://zachlef.in): a Next.js static export in
gruvbox, deployed to GitHub Pages.

## Develop

```sh
pnpm install
pnpm dev          # http://localhost:3000
```

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
