# Production readiness — PR 5833 (activity permission recompute consolidation)

Reviewed head: bf5a96710 (branch rs/idle-architecture/ia-2026-09-07/02-util-permissions-recompute,
base v3 @ 7f81442ad9). Wave one: 8 dimension workers (foreground subagents of the session model; no
external provider spend; dispatch ran sequentially after a session-ticket parallelism limit, recorded
below). Wave two: not required — zero blockers reported.

## Verdict

**ready-with-conditions.** No dimension reported a blocker or major finding. The change consolidates
four token-identical derived-permission recompute modules into one shared core behind the unchanged
public API; query shapes are byte-identical (programmatic comparison of all 8 findUnique bodies),
all four idField→delegate→key mappings audited correct against the schema, and behavior is pinned by
156/156 permission-battery tests plus a live UX drive of the share-grant and batch-reassignment flows.
Conditions: (1) repository final AI review on the final head; (2) this artifact commit is the only
post-CI delta (documentation only); (3) noted environment incident (dev-stack death from a chat
crash-loop, recovered via scoped profile) is operational, not a PR defect.

## Prior gates

| gate | artifact | status |
| --- | --- | --- |
| exact-head CI: check / test-graphql / test-unit / gitleaks / codeql / build / Playwright 8-shard (hosted, draft) | GitHub Actions, PR 5833 @ bf5a96710 | present (28/28 pass) |
| repository final-ai-review (/final-review) | workflow check | pending on ready head at report time |
| $code-review / $security-review / $thermo artifacts | project/_local/reviews/ | missing (observation; covered indirectly by permission batteries and this audit) |
| per-slice reviews | — | not applicable (single-layer PR) |

## Findings

| severity | dimension | finding | evidence | proposed action | verification |
| --- | --- | --- | --- | --- | --- |
| minor | failure modes | shared core is now a single failure domain for all four activity models with no in-repo unit tests (coverage not reduced vs v3 — none existed) | diff: 0 test files; packages/util/test has no permission tests | follow-up: commit a parametrized unit battery for the ternary builders + throw/silent semantics | unverified (static) |
| minor | failure modes | ternary-key dispatch relies on each descriptor's idField matching its delegate; tsc checks each against the union independently, not against each other | activity.ts:99-118; wrappers :19-23 | low-priority hardening: derive delegate/scope from idField in the type | unverified (static; all 4 current mappings audited correct) |
| minor | data safety | Object-path empty access map → deleteMany removes all rows for the activity; byte-identical pre-existing semantics, unreachable for live objects (owner always seeds the map) | activity.ts:360-364; util.ts:172-178 | none | confirmed (line-by-line vs v3) |
| minor | observability | user-variant not-found is fully silent (pre-existing, byte-preserved) | activity.ts:244-246 ≡ v3 liveQuiz.ts:147-150 | follow-up: log not-found id in user variant | confirmed (verbatim compare) |
| minor | failure modes | user-variant not-found leaves an existing derived-permission row unreclaimed (pre-existing) | activity.ts:236-246 ≡ v3 | follow-up: delete orphaned row or log | confirmed |
| minor | failure modes | transferActivitiesBetweenCourses script calls recompute non-transactionally (pre-existing; all GraphQL mutation paths roll back) | scripts/transferActivitiesBetweenCourses.ts:73,107,138 vs sharing.ts:1569 | follow-up: wrap in transaction | confirmed (call-site audit) |
| minor | UX | icon-only activity-row overflow buttons lack accessible names; dialogs missing description (pre-existing UI, outside diff) | observed live, a11y tree | handoff to UI track | confirmed (observed) |
| minor | performance | O(N) sequential per-element propagation and unbounded parallel upserts in object recompute (pre-existing, untouched) | util.ts:388-394,504-510; activity.ts:342-387 | future capacity pass (batching/offload) | confirmed (static) |
| pass | data safety | all four idField→delegate→compound-key mappings correct; 0 wrong-row writes in live DB (16 rows, 0 multi-model rows); snapshot projection drops nothing | activity.ts:99-166 vs wrappers; DB check | none | confirmed |
| pass | failure modes | wrapper→core indirection preserves await/error propagation and return values (all `return await`; no new catch/swallow) | wrappers :144,163,178; activity.ts:190,198 | none | confirmed |
| pass | observability | both historical signals preserved byte-identically for all four models (notFoundLabel/label descriptors) | activity.ts:344-349,393-398 vs v3 | none | confirmed (verbatim) |
| pass | performance | all 8 findUnique bodies whitespace-identical to v3; literal-key ternaries emit identical SQL (Prisma strips undefined) | programmatic comparison | none | confirmed |
| pass | deploy | 6 files under packages/util only; migrator lockstep no-op; tag rollback reverts all bundling images (backend-docker, both workers, olat-api) atomically if values.yaml pins move together | diff name-only; v3_backend-docker-prd.yml:19-26 | none | confirmed |
| pass | config | zero env/config/secret/dependency surface; log strings carry labels + ids only | 2,507-line diff greps | none | confirmed |
| pass | UX | share grant persists (UI + DB), batch reassignment applies both directions with success toasts, unknown-user error path clean | /tmp/pr5833-*.png (19 screenshots) | none | confirmed (observed live) |
| pass | docs | no doc/ADR describes the old structure; wiki rule satisfied without edit; log wording preserved for operator triage | docs greps | none | confirmed |

## Not checked

- Production/staging clusters and log pipelines (outside authorization).
- EXPLAIN probes on the disposable DB (endpoint rejected TLS handshakes at worker time; substituted by byte-identical query shapes vs v3, which makes plan behavior identical to status quo).
- Live Quiz / MicroLearning models not individually re-driven through the UI (one share + one batch move driven; all four models covered by the 156-test battery and 5/5 E2E cluster).

## Handoffs

- No in-repo unit tests for the recompute core → follow-up test battery (failure-modes/data-safety workers).
- Silent user-variant not-found + orphaned derived permission row → backend hardening candidate.
- Script-path (non-transactional) recompute callers → reconciliation/transaction follow-up.
- UI a11y gaps (icon-button names, dialog descriptions, error-toast next steps) → design-system track.

## Environment incident (operational record)

The task workspace's dev stack had died ~17h before the UX drive (chat dev crash-loop aborted all turbo
dev tasks; all routes 502). The UX worker recovered with the sanctioned scoped command
`devrouter ensure <worktree> --profile manage --json` after verifying the worktree was clean at the
exact PR head; manage/api/auth/redis restored, chat intentionally excluded pending its startup
investigation. Earlier the same session, a full reset+reseed+repair sequence was applied after E2E
global-setup wiped the seeded DB (documented recovery ritual). No retained environment was touched.
