---
module: frontend
concept: shared toast store
created: 2026-09-22
updated: 2026-09-22
date: 2026-09-22
problem_type: runtime_error
severity: high
symptoms:
  - 'Toasts raised from a workspace package never appear in a built app while the same code works in development.'
  - 'A Playwright case asserting on a toast passes locally and fails in CI with the toast element never found.'
root_cause: A peer-context split installs two copies of the design system, and its built bundle inlines sonner, so the package and the app hold separate toast stores.
tags: [pnpm, uzh-bf-design-system, sonner, turbopack, nextjs, exports]
---

# Toasts from a workspace package vanish in a production build

## Problem

`packages/kb-management` raises toasts through `toast()` from
`@uzh-bf/design-system`, and `apps/frontend-manage` mounts the matching
`<Toaster>` in `_app`. In development every toast appears. In a production build
none of them do, silently: no error, no console warning, no failed request. The
first evidence was a Playwright case that passed against the local dev server and
failed in CI, where the Playwright workflow builds the app with
`NODE_ENV=test next build --turbopack`.

A dev run is not evidence for this class of defect. Neither is a screenshot taken
against `turbo dev`.

## Cause

Two effects combine, and each one alone is harmless.

The design system's `exports` map has a `development` condition that resolves to
`src/`, and an `import` condition that resolves to `dist/`. `src/` imports
`sonner` by name, so every importer reaches the one installed `sonner` and shares
its module-level store. `dist/` **inlines** sonner into its own chunk, so each
copy of the design system that a bundle loads carries a private store.

pnpm then installed more than one copy. The frontends declare `postcss ~8.5.26`
while the workspace packages declare no postcss at all and inherit next's 8.5.18.
postcss is a peer of the design system, so it is part of the peer-context hash,
and `apps/frontend-manage` and `packages/kb-management` resolved to different
`.pnpm` directories for the same `@uzh-bf/design-system@4.1.8`.

In development both copies loaded `src/` and shared the single sonner instance.
In a production build each loaded its own `dist/`, so the package wrote to a
store that the app's mounted `<Toaster>` does not render.

This is the same failure shape as
[the next-intl context split](next-intl-shared-context-split.md): one logical
module, two physical copies, module-level state that does not cross between them.
Only the symptom differs.

## Correction

Raise the existing postcss lift in the `overrides` block of
[pnpm-workspace.yaml](../../../pnpm-workspace.yaml) so the whole patch line
consolidates and the app and the packages it bundles resolve one copy:

```yaml
'postcss@>=8.0.0 <8.5.26': 8.5.26
```

Prefer consolidating the peer that causes the split over aliasing the package in
one app's bundler configuration. The override is read by every consumer and by
CI; a bundler alias fixes one app and leaves the next one to rediscover this.

`apps/chat` keeps a copy of its own because it pins `tw-animate-css` at exactly
`1.3.4` where the other consumers take `1.3.7`. It bundles no workspace package
that raises a toast, so it is left alone. Consolidate a peer when a split
actually separates a stateful module from its consumer, not on sight.

## Verification

Count the copies of the store in the built client bundle. Two chunks means two
stores:

```sh
NODE_ENV=test turbo run build:test --filter=@klicker-uzh/frontend-manage
grep -rl dismissedToasts apps/frontend-manage/.next/static/chunks
```

Before the correction this listed two chunks; afterwards, one. Confirm the
install side as well — these must print the same `.pnpm` directory:

```sh
readlink -f apps/frontend-manage/node_modules/@uzh-bf/design-system
readlink -f packages/kb-management/node_modules/@uzh-bf/design-system
```

Run both inside the devcontainer. A host worktree whose `node_modules` is
incomplete reports a single variant and looks healthy while the container and CI
resolve two.

A lockfile change of this kind is wide, so run `pnpm run build` and
`turbo run check` across the workspace before committing it.

## Failed approaches and limits

Reading the component was a dead end: the dropzone, its error handling and the
message keys were all correct, and the toast call is reached. The CI trace showed
the network settling seconds before the assertion timed out, which rules out a
timing problem but names no cause. The decisive observation was that **no**
kb-management toast rendered in CI, including one raised by an unrelated
component — the failure belonged to the package, not the change under test.

Checking `node_modules` on the host refuted the duplicate-install theory and was
simply wrong; only the container answers this question.

The chunk count and the matching realpaths prove one store exists. They do not
prove the toast renders; the CI Playwright run remains the behavioural evidence.
