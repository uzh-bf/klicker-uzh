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
  - `/Users/rolandschlaefli/.codex/worktrees/eaff/klicker-uzh/packages/word-cloud/src/index.ts`
  - `/Users/rolandschlaefli/.codex/worktrees/eaff/klicker-uzh/packages/word-cloud/src/layout.ts`
  - `/Users/rolandschlaefli/.codex/worktrees/eaff/klicker-uzh/packages/word-cloud/src/render.ts`
  - `/Users/rolandschlaefli/.codex/worktrees/eaff/klicker-uzh/packages/word-cloud/src/random.ts`
  - `/Users/rolandschlaefli/.codex/worktrees/eaff/klicker-uzh/packages/word-cloud/src/types.ts`
- [x] Added standalone demo + tiny static server for isolated smoke testing
  - `/Users/rolandschlaefli/.codex/worktrees/eaff/klicker-uzh/packages/word-cloud/demo/index.html`
  - `/Users/rolandschlaefli/.codex/worktrees/eaff/klicker-uzh/packages/word-cloud/demo/main.js`
  - `/Users/rolandschlaefli/.codex/worktrees/eaff/klicker-uzh/packages/word-cloud/demo/server.mjs`
- [x] Added package-level tests for deterministic behavior, collisions, scales, and relayout
  - `/Users/rolandschlaefli/.codex/worktrees/eaff/klicker-uzh/packages/word-cloud/test/layout.test.ts`
- [x] Integrated native renderer into `Standard` mode in `ElementWordcloud`
  - `/Users/rolandschlaefli/.codex/worktrees/eaff/klicker-uzh/packages/shared-components/src/charts/ElementWordcloud.tsx`
  - `/Users/rolandschlaefli/.codex/worktrees/eaff/klicker-uzh/packages/shared-components/src/charts/NativeD3WordCloud.tsx`
- [x] Kept `Premium` mode temporarily on legacy renderer as migration fallback
- [x] Wired workspace package usage and build dependency chain
  - `/Users/rolandschlaefli/.codex/worktrees/eaff/klicker-uzh/packages/shared-components/package.json`
  - `/Users/rolandschlaefli/.codex/worktrees/eaff/klicker-uzh/turbo.json`
  - `/Users/rolandschlaefli/.codex/worktrees/eaff/klicker-uzh/pnpm-lock.yaml`
- [x] Added temporary Cypress assertion to confirm Premium fallback still renders
  - `/Users/rolandschlaefli/.codex/worktrees/eaff/klicker-uzh/cypress/cypress/e2e/O-live-quiz-workflow.cy.ts`

## Open Migration Steps

- [ ] Migrate `Premium` mode to native package path
- [ ] Remove legacy renderer wiring/callbacks/options once Premium is migrated
- [ ] Remove legacy dependencies from shared components (`react-wordcloud`, `d3-cloud`) when no longer needed
- [ ] Re-check and clean remaining ancillary word-cloud deps (including legacy tag-cloud typings/packages where unused)
- [ ] Replace remaining observer-based empty-state fallback logic with layout-result driven logic for all modes
- [ ] Keep/expand regression coverage for Standard + Premium parity after full migration
- [ ] Re-run and resolve failing `syncpack` conformity check before merge

## Public API Introduced

Package: `@klicker-uzh/word-cloud`

- `computeWordCloudLayout(words, options): LayoutResult`
- `renderWordCloud(container, layoutResult, renderOptions): RendererHandle`
- `RendererHandle.update(nextLayoutResult): void`
- `RendererHandle.destroy(): void`

## Validation Performed

- [x] `pnpm --filter @klicker-uzh/word-cloud check`
- [x] `pnpm --filter @klicker-uzh/word-cloud test`
- [x] `pnpm --filter @klicker-uzh/word-cloud build`
- [x] Demo server smoke checks for `/` and `/dist/index.js`
- [x] Browser-level tooltip/hover behavior verified during local demo checks

## Risks / Gaps

- `Premium` is still on legacy fallback, so full dependency cleanup is not complete yet.
- CI currently reports a failing syncpack conformity check on `/Users/rolandschlaefli/.codex/worktrees/eaff/klicker-uzh/packages/shared-components/package.json`.
- Full app-level typecheck for shared-components depends on broader workspace build prerequisites and should be validated in CI/fully prepared local environment.

## Done Criteria for Full Migration

- [ ] Both `Standard` and `Premium` modes use native `@klicker-uzh/word-cloud` path
- [ ] Legacy renderer dependencies removed from active usage and manifests
- [ ] Existing word-cloud Cypress behavior remains green without test rewrites (except intentional migration-specific updates)
- [ ] Empty-state handling is consistent and layout-result driven for all modes
- [ ] CI checks pass, including syncpack and relevant frontend checks
