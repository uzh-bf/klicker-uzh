# Office Add-in Working Notes

Follow the repository-level `AGENTS.md` and the engineering wiki. This file only
records the package-specific invariants that are easy to miss.

## Architecture

- Office content add-in for PowerPoint, not a task pane or ribbon extension.
- Vanilla TypeScript bundled by Rollup; HTML, CSS, manifest, and assets are build inputs.
- Development origin: `https://localhost:3020/`.
- Production origin: `https://www.klicker.uzh.ch/office-addin/`.
- The deployed artifact is `apps/docs/static/office-addin`; never copy files by hand.

## Invariants

- Accept only the URL contract implemented and tested in `src/content/evaluation-url.ts`.
- Keep `sandbox="allow-scripts allow-same-origin allow-forms"` restrictive.
- Store the URL under `embeddedUrl`; Office scopes document settings to this content-add-in instance and document.
- Preserve one-time migration from `selectedURL<slideId>` until old presentations no longer need it.
- Keep TypeScript in browser/bundler mode with explicit `office-js` global types.
- Do not restore Tailwind Play CDN, runtime polyfills, the Microsoft debug launcher, or live reload without a demonstrated requirement and a fresh security review.

## Required checks

```bash
pnpm --filter @klicker-uzh/office-addin check
pnpm --filter @klicker-uzh/office-addin lint
pnpm --filter @klicker-uzh/office-addin test
pnpm --filter @klicker-uzh/office-addin build:docs
pnpm --filter @klicker-uzh/office-addin verify:docs
pnpm --filter @klicker-uzh/office-addin validate
```

Use `agent-browser` with a stubbed Office API for UI states. Before release,
sideload in real PowerPoint to verify persistence, multiple add-in instances,
embedded evaluation rendering, and Change URL behavior.
