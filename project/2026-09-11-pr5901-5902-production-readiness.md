# Production readiness — Stack #5903: PR 5901 (scoring characterization) + PR 5902 (scoring consolidation)

Heads at audit time: 5901 @ 03172a2956 (base v3 @ b34104e9c7), 5902 @ ed6b95de3a (base = 5901).
Wave one: dimension workers over the cumulative stack diff (foreground subagents of the session model;
no external provider spend). Wave two: not required — zero blockers reported.

## Verdict

**ready-with-conditions.** The stack adds a 28-case characterization battery for the previously untested
response-scoring helpers (PR 5901, test-only) and consolidates the ten duplicated helpers into five
per-type grading cores + two shared award finalizations with named guard predicates (PR 5902,
behavior-preserving). Output equivalence is proven at the grading-package domain level (numerical/free-text
percentages are {0,1,null}; at 1 the percentage path equals the removed getsMaxPoints path; at 0/null both
score zero) and pinned numerically by the battery. Conditions: (1) final AI reviews on both final heads;
(2) exact-head CI including the full Playwright suite as the canonical live-scoring journey; (3) the
readiness-report commit is the only post-CI delta (docs-only).

## Prior gates

| gate | artifact | status |
| --- | --- | --- |
| worker battery + tsc + build (container, exact heads) | local | present (28/28; clean; rollup ok) |
| check:all + build (host boundary) | local | present |
| exact-head CI (test-unit incl. new suite; Playwright full suite; check) | GitHub Actions | pending at report time |
| final AI reviews (/final-review on 5901; /final-review-stack on 5902) | workflow check | pending |
| code-review / security-review artifacts | — | missing (observation; coverage via battery + audits) |

## Findings

| severity | dimension | finding | evidence | action | verification |
| --- | --- | --- | --- | --- | --- |
| minor | deploy | single runtime image bundles the changed code; tag-granular rollback is clean per layer; reverted tree self-consistent (getsMaxPoints remains a supported grading param) | worker Dockerfile:14,56; repo-wide importer grep | none | confirmed |
| minor | failure modes | grading `getsMaxPoints` branch becomes production-unused after the stack | grading index.ts:264,304; caller census | optional future deprecation in packages/grading | confirmed |
| minor | observability | no metrics on the scoring path (pre-existing; signal-neutral refactor — 27 logger sites identical, per-response success log byte-identical) | processor.ts diff; greps | standing gap note | confirmed |
| minor | docs | docs/testing.md + docs/chat-platform.md suite enumerations updated in-stack and verified against workflow reality | testing.md:249-251; chat-platform.md:1054-1058 | none | confirmed |
| minor | docs | test header/one test name referenced the removed getsMaxPoints mechanism — reworded in-stack | scoringHelpers.test.ts:24-25,194 | done | confirmed |
| minor | process | an earlier revision lost the processor call-site swap while keeping imports; caught by review worker and fixed in-stack (d68eb3c96 → ed6b95de3a after rebase) | processor.ts guards vs origin/v3 | done | confirmed |
| note | UX | no UI surface; the affected live-quiz flow is exercised by CI's full Playwright suite (canonical gate per repo testing skill). Local O1 executions fail parent-identically at a PWA state unrelated to scoring (dev-runtime artifact; 3 documented attempts incl. stash-proof and clean restart) | PR 5902 body | rely on CI journey | documented |
| pass | data safety | no schema/API/data changes; fixtures synthetic; battery pins null-percentage and fractional-selection boundaries | diff; test file | none | confirmed |
| pass | config | vitest devDep only (~3.2.4, consistent with 11 importers), excluded from runtime image (pnpm i --prod); lockfile minimal after unrelated @types/react drift reverted | lockfile diff; Dockerfile runtime stage | none | confirmed |
| pass | performance | per-response work operation-identical; added cost = one call indirection + bounded O(1) params spread | helpers.ts wrappers vs origin/v3 | none | confirmed |
| pass | failure modes | guard predicates truthy-identical incl. empty-array quirk; XP ?? 0 removal equivalent; assessmentProcessor consumption keys unchanged | predicates vs old inline conditions | none | confirmed (verbatim) |

## Not checked

- Runtime worker execution against a live quiz locally (documented journey limitation above; CI full suite is the canonical journey).
- Docker image build via the CI runner (Dockerfile verified by local rollup build only).
- Node-24 image execution locally (host verification ran on Node 22 with engine warnings; no failures).

## Handoffs

- getsMaxPoints deprecation candidate in packages/grading (no remaining production caller).
- Scoring-path metrics gap (standing; pre-existing).
- Local dev-runtime PWA state issue affecting O1:3249 outside CI — environment investigation candidate (pre-existing on v3; parent-identical).

## Addendum — PR 5918 (layer 3: response-validity invariants), heads 70b10b4bc + c58da6263

Proportionate audit (equivalence/config/performance/docs worker + local verification):

| severity | dimension | finding | evidence | action | verification |
| --- | --- | --- | --- | --- | --- |
| info | equivalence | all six adoption sites expression-identical to origin/v3 (verbatim helper body); stacks undefined propagation preserved exactly for every input | grading index.ts:417-419; stacks.ts:3088-3091; validateResponse.ts:117-119 | none | confirmed (verbatim quotes) |
| low | failure modes | worker numerical core: null solutions now yield null grading instead of TypeError — strictly safer superset; blocks.ts site exactly equivalent (outer guard) | grading index.ts:99 guard | none | confirmed |
| low | config | client bundles gain grading's two helpers (~few hundred bytes); grading not previously in client JS despite transitive node_modules presence; remeda already a shared-components dep | shared-components imports; graphql dist/ops has no grading import | bundle note in PR body | confirmed |
| low | maintainability | one validation-side duplicate remained unadopted — adopted in c58da6263 | helpers.ts validation guard | done | confirmed |
| info | performance | per-call cost identical (one filter pass; one O(1) object return against JSON.parse+Redis in the same path) | wrapper comparison | none | confirmed |
| pass | data safety / UX / observability / docs | N/A — no schema/data/UI/logging change; GraphQL snapshot unchanged; no doc describes the old duplicated expressions (greps) | diff + greps | none | confirmed |

Verdict for 5918: ready-with-conditions (final AI review of the cumulative stack — see stack-level status; all automated checks green at c58da6263 incl. full Playwright suite).
