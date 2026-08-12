# Deterministic application fonts

## Goal

Remove build-time Google Fonts downloads from the five Next.js applications so
production and Docker builds are deterministic and the current `v3` release can
complete its required image matrix.

## Plan identity

- Branch: `rs/ci-local-fonts`
- Worktree: `trees/ci-local-fonts`
- Target: `v3`
- Base: `5264353ff77afc598ea69f05f262b25f882ca38c`
- PR: not created
- Planning review:
  `project/_local/reviews/2026-08-12-ci-reliability-recovery-planning-stage.md`

## Non-goals

- No font-family, typography, or visual redesign.
- No package dependency.
- No changes to staging promotion, SonarCloud, Prisma, or Playwright.
- No push, PR creation, merge, manual promotion, release cut, or deployment
  without separate authorization.

## Research

- Source Sans 3 and JetBrains Mono are distributed under OFL-1.1.
- Next.js supports package-local WOFF2 assets through `next/font/local`.
- The current shared definitions are consumed by auth, chat, frontend-control,
  frontend-manage, and frontend-pwa.

## Test portfolio

| Risk | Existing protection | Obligation | Primary seam | Distinct failure |
| --- | --- | --- | --- | --- |
| Affected apps still fetch Google fonts | Production builds only prove compilation | No new test | Browser network log | Runtime requests still depend on Google hosts |
| Font assets are missing after workspace pruning | Docker image builds | Extend existing verification | One pruned frontend Docker build | Local source build passes but image build cannot resolve WOFF2 files |
| Typography contract changes | Browser rendering | No new test | Computed style and screenshots | CSS variables, family, style, or weights drift |
| Binary provenance is unclear | None | Add repository evidence | Asset hashes and adjacent license files | Untraceable or incorrectly licensed vendored files |

## Slice 1: Vendor and activate local fonts

- Route: executor
- Acceptance: pinned upstream versions and hashes recorded; OFL licenses
  adjacent; `next/font/google` removed from the shared font definition; existing
  CSS variables, normal style, display behavior, and weight ranges preserved.
- Files: `packages/shared-components/src/font.ts` and a package-local font asset
  directory.
- Verification: shared-components check and formatting, then affected app
  production builds.
- Commit: `fix(build): self-host application fonts`
- Slice review: not required; no trust or data boundary changes.
- Simplifier: required because the implementation is substantive.

## Slice 2: Record and verify the build contract

- Route: main
- Acceptance: frontend wiki states the local-font build invariant; new wiki log
  validates; all five affected app builds pass; one pruned Docker build passes;
  representative browser pages use the expected local fonts and make no Google
  font requests; screenshots are captured.
- Files: `docs/frontend-conventions.md` and a new `docs/log/` entry.
- Verification: wiki validator, Prettier, `pnpm run check:all`, production builds,
  Docker build, and browser inspection.
- Commit: `docs(frontend): document self-hosted fonts`
- Slice review: not required; documentation only.
- Simplifier: not applicable; documentation only.

## Final gate

- Run the integrated final review over the committed range after all local
  verification passes.
- A separately authorized merge is staging-proven only when that exact merge
  SHA has a green required-check and ARM/AMD image matrix and all staging release
  annotations point to it.

## Rollback

Revert the asset, implementation, and documentation commits together. The
previous network-dependent build path must not be used as grounds to manually
promote the failed alpha.68 commit.

## Progress

- 2026-08-12: Approved program plan and planning-stage review complete.
- 2026-08-12: Package worktree created from `v3` at `5264353ff`.
- 2026-08-13: Slice 1 implemented with pinned Source Sans 3 3.052R and
  JetBrains Mono 2.304 assets, upstream licenses, and recorded SHA-256 hashes.
- 2026-08-13: Node 24 shared-components check and all five affected production
  builds pass. The PWA Docker installer-stage build also passes after Turbo
  pruning, proving the local assets survive the image path.
- 2026-08-13: Slice 1 committed as `b93214ce0`; frontend wiki and agent guidance
  now record the local-font build contract.
- 2026-08-13: Slice 1 simplifier returned `SIMPLIFIED_AS_IS`. The full check
  suite passed on both commits. The wiki's new entry validates; its 24 remaining
  conformance errors are pre-existing files outside this package.
- 2026-08-13: Auth, Chat, Control, Manage, and PWA loaded their package-local
  WOFF2 assets in the browser with no Google font requests. Authenticated Control
  and Manage pages were also inspected. The final PWA Docker installer-stage
  build passed after Turbo pruning.
- Current: run the integrated final review over the committed package range.
