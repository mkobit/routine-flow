## Local development

```bash
bun install
bun run start
```

Starts a local dev server with live reload.

## Build

```bash
bun run build
```

Generates static content into `build/`.

## Deployment

Deployment is automatic: `.github/workflows/docs.yml` builds and publishes this site to GitHub Pages on every push to `main` that touches `docs/**`.
There's no manual deploy step.
