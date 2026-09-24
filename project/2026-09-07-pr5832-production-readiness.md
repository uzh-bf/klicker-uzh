# Production readiness — PR 5832 (activity batch policy filter consolidation)

Reviewed head: 82247bdf4 (branch rs/idle-architecture/ia-2026-09-07/01-activity-batch-policy, base v3 @ 7f81442ad9).
Wave one: 8 dimension workers (foreground subagents of the session model — no external provider spend;
no other fan-out was running against this quota). Wave two: not required — zero blockers reported.

## Verdict

**ready-with-conditions.** No dimension reported a blocker or major finding. The change is a
behavior-preserving, service-internal refactor of Prisma where-clause construction with byte-identical
query inputs (independently re-verified by a 28-combination deep-equal harness), no schema, migration,
config, dependency, or API-surface changes, and clean exact-head CI including the full 8-shard
Playwright suite. Conditions: (1) the repository final AI review must complete on the final head;
(2) this artifact commit is the only post-CI delta and is documentation-only.

## Prior gates

| gate | artifact | status |
| --- | --- | --- |
| exact-head CI: check / test-graphql / test-unit / gitleaks / codeql / sonar / build | GitHub Actions, PR 5832 @ 82247bdf4 | present (28/28 pass, incl. full Playwright 8/8 shards) |
| repository final-ai-review (/final-review) | workflow check | pending on final head at report time |
| $code-review / $security-review / $thermo-nuclear artifacts | project/_local/reviews/ | missing (observation; the changed surface is covered by the integration battery, E2E cluster, and this audit's data-safety/UX dimensions) |
| per-slice reviews | — | not applicable (no slices; single-layer PR) |

## Findings

| severity | dimension | finding | evidence | proposed action | verification |
| --- | --- | --- | --- | --- | --- |
| minor | data safety | `UNPUBLISHED_ACTIVITY_STATUSES` is a shared mutable exported array now also used by the batch gate; a future in-place mutation would widen blast radius (today: zero mutation sites repo-wide) | activities.ts:18-21, :57; importers practiceQuizzes.ts:656, microLearning.ts:763, groups.ts:1895 | optional `as const`/readonly hardening in a follow-up | unverified (static) |
| minor | failure modes | mid-batch failure leaves committed prefix + generic error toast; client catch path does not refetch the activity list | mutation.ts:1342 (bare delegation); ActivityBatchOperationsModal.tsx:591-597 (catch without refetch) | handoff: refetch in catch; optionally return committed count | unverified (static, pre-existing) |
| minor | failure modes | per-activity transactions use Prisma default 5s timeout while comparable code budgets 60s (pin-code retries + instance updates inside one tx) | activities.ts:719 vs :209 (`{ timeout: 60000 }`) | handoff: explicit timeout on batch loop txs | unverified (static, pre-existing) |
| minor | observability | zero-update outcome is silent server-side (count 0, no log/metric); UI error toast is the only signal | activities.ts:1042-1047; modal :584-590 | follow-up: warn-log requested>0 && count==0 | unverified (static, pre-existing) |
| minor | observability | no metrics/APM on GraphQL mutations (Sentry commented out) | apps/backend-docker/src/app.ts:171-185, :199-201 | follow-up: re-enable Sentry or metrics plugin | unverified (static, pre-existing) |
| minor | observability | `data: undefined` without throw would render as "partial success" toast | ActivityBatchOperationsModal.tsx:561-583 | optional: explicit undefined handling | unverified (static, pre-existing, edge) |
| minor | UX | count copy lacks ICU plural ("1 activities will be updated") | packages/i18n/messages/en.ts:1678 | handoff to UI/i18n task | confirmed (observed live) |
| minor | UX | batch toasts not announced to screen readers (no aria-live on toaster) | observed DOM during toast | handoff to design-system owners | confirmed (observed live) |
| minor | UX | publish confirmation can close silently when the mutation resolves null (schedule branch) | PublishConfirmationModal.tsx:115; microLearning.ts schedule branch | handoff: toast on null result | confirmed (observed live) |
| minor | UX | eligibility ✓/× marks rely on color + hover/focus tooltip | modal :81-256 | acceptable (count message + disabled apply reinforce); optional text label | unverified (heuristic) |
| minor | performance | update loops are O(N) sequential transactions with per-instance updates + full permission recompute per activity | activities.ts:712-1040; util/permissions.ts:55-136 | follow-up candidate (out of scope) | unverified (static, pre-existing) |
| minor | performance | findMany unconditionally includes all instances but reads them only when setMultiplier | activities.ts:622,655,678,707 vs :799-808 | follow-up: conditional include | unverified (static, pre-existing) |
| pass | UX | client-predicted eligibility === server count on every driven apply (4/4 multiplier, 4/4 course move, 2/3 partial, 2/2 reset), success/partial/zero surfaces correct | observed live, 22 screenshots (/tmp/pr5832-ux-*.png) | none | confirmed (observed) |
| pass | data safety | all four consolidated where-clauses value-identical to originals branch-for-branch, incl. live-quiz `{courseId: null}` and gamification-on-points nuances; no prisma/SDL diff | activities.ts:34-91,603-708; empty diff under packages/prisma and public/schema.graphql | none | confirmed (static, line-by-line) |
| pass | performance | where-inputs deep-equal 28/28 combinations (4 models × 7 param combos); index usage unchanged (PK + DerivedPermission unique indexes drive all branches) | harness /tmp/pr5832-where-equiv.mjs; EXPLAIN probe on disposable DB | none | confirmed (harness + probe) |
| pass | deploy | no migrations, no flags, no env/deps/turbo changes; ships in backend-docker + hatchet-worker-general images from the same release tag; rollback = tag revert (both images atomically) | diff name-only (2 files); backend Dockerfile:33-53; worker index.ts:4 | none | confirmed (static) |
| pass | config | zero config/secret/env/dependency deltas; test addition synthetic and credential-free | full-diff greps (0 matches) | none | confirmed (static) |
| pass | docs | no doc/ADR describes the old clause layout; tutorial claims map 1:1 to the new helpers; wiki rule satisfied without a doc edit | docs/graphql-api-layer.md:20; apps/docs activity_batch_operations.mdx:27-29 | none | confirmed (static) |

## Not checked

- Production/staging clusters, registries, and live log pipelines — outside authorization by design; repository-level evidence only.
- Runtime SQL capture from the engine (substituted by where-input structural equivalence + hand-mirrored EXPLAIN; Prisma compilation is deterministic).
- Production-scale query plans (disposable DB holds seed-scale data; identical SQL to base makes scale behavior identical to status quo).
- Fault injection mid-batch (outside read-only charter).
- The `setLiveQuizPoints` modal card driven live (no second draft live quiz in seed data; covered by the integration battery + E2E cluster instead).

## Handoffs

- Client-side eligibility mirror duplicates server policy (pre-existing; server authoritative; mismatch would surface as preview-vs-count discrepancy) → code-review/maintainability track.
- Toast aria-live, ICU plural, publish-null silent close, color-only eligibility marks → UI/design-system backlog.
- Batch-loop tx timeouts + error-path refetch + zero-count warn-log + conditional include + transaction batching → future backend hardening candidates (recorded; none block this PR).
