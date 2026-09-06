# Hosted test build cache compatibility

The existing Playwright seed is not a compatible cache producer for hosted
GraphQL and unit builds. Keep those workflows on their existing `build`
semantics, and retain ordinary compilation on fresh runners. No new cache
writer or service is introduced by this package.

## Contract comparison

| Dimension     | Hosted GraphQL and unit builds                                                    | Existing Playwright seed                                                         | Decision                                                     |
| ------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Task identity | `build`, dependencies through `^build`                                            | `build:test`, dependencies through `^build:test`                                 | Different Turbo identities; do not share snapshots           |
| Toolchain     | Node from root Volta pin; pnpm 11.5.0; lockfile-pinned Turbo                      | Node 24; pnpm 11.5.0; same lockfile                                              | Matching major versions alone do not establish compatibility |
| Runtime       | `ubuntu-latest`, outside a job container                                          | Pinned Playwright Noble image, separate ARM64 and x64 keys                       | Preserve the existing image/architecture boundary            |
| Environment   | Build steps do not set `NODE_ENV`; package commands set production where required | Synthetic test environment including `NODE_ENV=test`, hashed through `globalEnv` | Do not remove environment hash inputs to obtain hits         |
| Seed coverage | Eight GraphQL/worker tasks; four unit dependency tasks                            | Playwright application `build:test` closure                                      | No hosted `build` seed coverage                              |
| Persistence   | Existing setup-node pnpm store cache                                              | Trusted `v3` writer, public restore-only consumers                               | Keep pnpm cache; do not add redundant restoration            |

## Per-task outputs and dependencies

All tasks retain Turbo's default source inputs and dependency hashes. The
lockfile and package manifests remain authoritative. The table inventories
produced files. Downstream compilation imports built package interfaces from
`dist`, including Prisma's Pothos declarations.

| Build task     | Workspace dependencies                                                      | Command                                 | Produced generated/runtime outputs                                   |
| -------------- | --------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| Prisma         | None                                                                        | Generate, then Rollup                   | `dist/**`; generated `src/prisma/client/**`, including Pothos types  |
| Types          | Prisma                                                                      | TypeScript                              | `dist/**`, including declarations and incremental metadata           |
| Grading        | Types                                                                       | Rollup                                  | `dist/**`                                                            |
| Util           | Prisma, types, grading                                                      | Rollup                                  | `dist/**`                                                            |
| Feature flags  | None                                                                        | TypeScript                              | `dist/**`                                                            |
| Hatchet        | Prisma, types                                                               | Rollup                                  | `dist/**`                                                            |
| GraphQL        | Prisma, types, grading, util, feature flags; Hatchet development dependency | Production code generation, then Rollup | `dist/**`, `src/ops.ts`, generated public client/server maps and SDL |
| General worker | GraphQL, Hatchet, Prisma, types                                             | Rollup                                  | `dist/index.js` and its accompanying outputs                         |

GraphQL and unit workflows select only these dependency builds. Chat and PWA
tests remain selected but neither application production build is added.
Database setup and tests are never bypassed by a build cache hit.

## Evidence and remaining verification

Baseline: `1387f884ba731400b251e5646d83de6a9aa9e3b9`. The latest Playwright run
remains [the pre-activation run](https://github.com/uzh-bf/klicker-uzh/actions/runs/33993694804)
at head `8c056044a83ba5c82fe626cf430aef8376b07f04`; no newer run was found on
2026-09-06. It cannot measure activated caching.

Cold compilation and restored-output test execution pass. The cold graph
completed eight tasks with zero cache hits in 79.193 seconds. After moving every
selected `dist` tree and ignored generated Prisma/GraphQL source aside, all eight
tasks hit cache and restored the built artifacts in 2.265 seconds (3.837 seconds
including the probe command). Prisma's generated source remained absent, but
its built client and Pothos declaration tree were present. The built GraphQL
documents and persisted-query maps were also present.

Both cold and restored outputs passed Chat (581), PWA (7), grading (10),
Markdown (45), util (65), and GraphQL (786) tests. The built worker remained
running during GraphQL verification. No Turbo output expansion is needed for
these consumers. This does not claim that every repository consumer can run
without generated source.

GraphQL tests took 74.851 seconds in the cold-output run and 304.320 seconds in
the restored-output run. The samples ran sequentially on a shared developer
machine, not dedicated hosted runners. Report this spread; do not attribute it
to cache behavior. Installation took 174.9 seconds including cold downloads and
supply-chain policy checks. Synthetic service setup was isolated and published
no host ports. A first GraphQL probe failed on hard-coded localhost Redis
addresses; the corrected probe supplied local forwarding without changing tests.

Mixed-hit compilation passed all eight tasks in 38.174 seconds with five cache
hits. An isolated synthetic feature-flags source addition invalidated that
producer, GraphQL, and the general worker. Prisma and the other dependencies
restored successfully; the cold downstream GraphQL/worker builds passed without
Prisma generated source. The synthetic addition was moved out of source after
the probe. No queue, artifact-transfer, or cache
download measurements exist for this package. There is no new seed/storage
overhead because no persistent cache wiring changed.
Local verification uses the repository's Node 24.16.0/pnpm 11.5.0 container
toolchain on Linux ARM64. It does not claim hosted x64 performance or cache
transfer savings. New `build` seed workloads are deferred because the approved
plan does not authorize their additional recurring CI work.
