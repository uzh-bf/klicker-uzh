# Native Word Cloud Migration

## Goal of Rework

Replace the outdated legacy word-cloud renderer with a native D3-based implementation that is deterministic, maintainable, and incrementally adoptable without breaking current evaluation behavior.

The migration target is a complete backend switch for `ElementWordcloud` from legacy renderer integration to `@klicker-uzh/word-cloud`, while preserving existing user-visible contracts (data handling, filtering outcomes, empty states, and interaction behavior).

## Concepts Applied

- [x] Native D3 rendering with `selection.join` for stable enter/update/exit behavior
- [x] Deterministic RNG (`seed: '42'`) for repeatable layouts
- [x] Archimedean spiral placement around chart center
- [x] Axis-aligned bounding-box (AABB) collision checks
- [x] Shrink-and-relayout retry strategy (`shrinkFactor`, `maxRelayouts`)
- [x] Staged migration strategy (`Standard` first, `Premium` fallback path)

## Implemented (Achieved)

- [x] Introduced standalone package `@klicker-uzh/word-cloud` with layout/render API
  - `packages/word-cloud/src/index.ts`
  - `packages/word-cloud/src/layout.ts`
  - `packages/word-cloud/src/render.ts`
  - `packages/word-cloud/src/random.ts`
  - `packages/word-cloud/src/types.ts`
- [x] Added standalone demo + tiny static server for isolated smoke testing
  - `packages/word-cloud/demo/index.html`
  - `packages/word-cloud/demo/main.js`
  - `packages/word-cloud/demo/server.mjs`
- [x] Added package-level tests for deterministic behavior, collisions, scales, and relayout
  - `packages/word-cloud/test/layout.test.ts`
- [x] Integrated native renderer into `Standard` mode in `ElementWordcloud`
  - `packages/shared-components/src/charts/ElementWordcloud.tsx`
  - `packages/shared-components/src/charts/NativeD3WordCloud.tsx`
- [x] Wired workspace package usage and build dependency chain
  - `packages/shared-components/package.json`
  - `turbo.json`
  - `pnpm-lock.yaml`

## Open Migration Steps

- [ ] Re-check and clean remaining ancillary word-cloud deps (including legacy tag-cloud typings/packages where unused)
- [ ] Replace remaining observer-based empty-state fallback logic with layout-result driven logic for all modes
- [ ] Keep/expand regression coverage for Standard + Premium parity after full migration
- [ ] Re-run and resolve failing `syncpack` conformity check before merge

## Public API Introduced

Package: `@klicker-uzh/word-cloud`

- `computeWordCloudLayout(words, options): LayoutResult`
- `renderWordCloud(container, layoutResult, renderOptions): RendererHandle`
- `RendererHandle.update(nextLayoutResult, nextRenderOptions?): void`
- `RendererHandle.destroy(): void`

## Validation Performed

- [x] `pnpm --filter @klicker-uzh/word-cloud check`
- [x] `pnpm --filter @klicker-uzh/word-cloud test`
- [x] `pnpm --filter @klicker-uzh/word-cloud build`
- [x] Demo server smoke checks for `/` and `/dist/index.js`
- [x] Browser-level tooltip/hover behavior verified during local demo checks

## Risks / Gaps

- Full cleanup of old tag-cloud dependencies should be handled after confirming no other chart path still imports them.
- CI currently reports a failing syncpack conformity check on `packages/shared-components/package.json`.
- Full app-level typecheck for shared-components depends on broader workspace build prerequisites and should be validated in CI/fully prepared local environment.

## Done Criteria for Full Migration

- [ ] Legacy renderer dependencies removed from active usage and manifests
- [ ] Existing word-cloud Cypress behavior remains green without test rewrites (except intentional migration-specific updates)
- [ ] Empty-state handling is consistent and layout-result driven for all modes
- [ ] CI checks pass, including syncpack and relevant frontend checks
