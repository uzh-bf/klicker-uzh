# Async Permission Propagation + RBAC Hardening — Plan

## Plan Identity

- Plan: `project/2026-07-07-pr-5144-async-permission-propagation-plan.md`
- Branch: `permission-propagation-plan`; implementation continues in this PR
- Target: `v3`
- PR: [#5144](https://github.com/uzh-bf/klicker-uzh/pull/5144) (draft)
- History: [PR #4808](https://github.com/uzh-bf/klicker-uzh/pull/4808) `[CONCEPT] New suggested approach for asynchronous permission propagation` (branch `transaction-concept`, draft, unmerged) — earlier attempt at same problem, reviewed below.
- ADR: [ADR-0001](../docs/adr/0001-fail-closed-permission-propagation.md)

## Goal

- Problem: sharing/revoking/transferring objects recomputes the materialized `DerivedPermission` cache synchronously + recursively (Course → LiveQuiz/PracticeQuiz/MicroLearning/GroupActivity → Elements → AnswerCollections) inside request-blocking Prisma transactions. 14 call sites in `packages/graphql/src/services/sharing.ts` carry `{ timeout: 60000 }`. Slow, lock-heavy, scales with course size × user count.
- Goal: make permission writes fast and non-blocking, keep authorization fail-closed and correct, close known auth-check gaps.
- Non-goals: no external authz system (Zanzibar/SpiceDB/OpenFGA), no removal of `DerivedPermission` model, no read-path redesign (single-row `findUnique` checks stay), no UX redesign of sharing modals, no response-api rework (separate audit — see Next Steps).

## Research

Codebase investigation via 4 subagents (3 explore + 1 PR review), 2026-07-07. A fresh primary review, native fact-check, external `agy`/Gemini cross-check, and current Hatchet concurrency documentation were added on 2026-07-23. Limitation: perf numbers are structural inference (row-count math), not measured — Slice 1 fixes that before optimization claims are trusted.

### R1: Data model (evidence)

- `Permission` = direct grant (user XOR group, `propagation` flag, 8-way polymorphic FK columns) — `packages/prisma/src/prisma/schema/sharing.prisma:30-92`. All object FKs on `Permission` and `DerivedPermission` are `onDelete: Cascade` — deleting an entity cleans up its permission rows at the DB level (verified during investigation; no orphan-row risk from entity deletion).
- `DerivedPermission` = materialized effective permission, one row per (object, user), groups pre-expanded, `@@unique([<objectId>, userId])` ×8 — `sharing.prisma:174-235`. Sole source of truth at check time.
- Ownership: single `ownerId` per entity, folded in as `OWNER` level during recompute.
- `AccessRequest` duplicates one row per (requester, object, each admin/owner) by design — `sharing.prisma:94-168`.
- `UserActivities` = read-time SQL VIEW over `DerivedPermission` (migration `20250818121500`) — shows read-time joins over this hierarchy perform acceptably in Postgres; the view only reads precomputed rows, so write-side set-based derivation (Slice 3) is still a new pattern.

### R2: Write path / the bottleneck (evidence)

- Dispatcher `recomputeDerivedPermissions()` — `packages/util/src/permissions.ts:55-136`; per-entity modules in `packages/util/src/permissions/*.ts` (~4.4k LOC).
- Sequential `for...of` awaits per child object (`packages/util/src/permissions/course.ts:217-240`), per-row `upsert`/`delete`, recursion into elements via `propagateActivityToElements[User]` (`util.ts:366,484`).
- Runs inline inside mutation `$transaction`; 78 `recomputeDerivedPermissions` call sites in `sharing.ts`; 14 transactions with `{ timeout: 60000 }`.
- Worst case: group membership change loops every `Permission` row the group holds × full child cascade (`recomputePermissionsUserGroupMember`, `sharing.ts:5992-6065`).
- Row math example: course with 10 activities × 15 elements ≈ 300+ recompute nodes; object-wide mode multiplies by users-with-access per node.
- No queue/batch/Hatchet usage anywhere in permission code (grep-confirmed).

### R3: Read path + enforcement (evidence)

- 3 layers: JWT middleware (`apps/backend-docker/src/app.ts:62-119`) → Pothos scope-auth (`packages/graphql/src/builder.ts:56-111`) → `checkAccess()` per object (`packages/graphql/src/services/sharing.ts:5650-5808`), single indexed `derivedPermission.findUnique` per check. Read side is healthy; no caching needed now.

### R4: Security/consistency gaps (evidence — verify each before fixing)

1. `checkAccess([]) === true` — empty checks array falls through loop, returns true. Mutations build checks via conditional spreads on client-supplied `ObjectType` (`mutation.ts:2388-2767`). All 8 types covered today; future type that misses a branch silently authorizes. Latent footgun.
2. `changeElementStatus` gated at READ (`packages/graphql/src/schema/mutation.ts:959-972`), service does unfiltered `element.update` (`elements.ts:854-869`). RESOLVED as intentional design (user, 2026-07-07): reviewers get READ so they can move element status (draft → in review → ready) without write permissions on content. Not a gap — document the invariant (Slice 8), no code change.
3. Batch ops already filter through the Prisma `permissions` relation, which is `DerivedPermission[]` on elements, courses, and all activity models (`element.prisma:53`, `course.prisma:60`, `quiz.prisma:52,126,181,287`). RESOLVED by live fact-check (2026-07-23): no query rewrite or access widening is needed. Permanent regression coverage must retain the provenance-sensitive propagation rules: course-origin WRITE can reach activities but stops before elements; course-origin ADMIN can reach elements; a direct activity WRITE grant can reach linked elements when that activity permission propagates; READ can change element review status.
4. `response-api` standard mode unauthenticated by design (`apps/response-api/src/index.ts:93-157`), trusts client `liveQuizId`/`instanceId`; assessment mode in same file fully gated. Out of scope here; separate audit (Next Steps).
5. Child creation + reparenting: creating an element inside an activity (or activity inside course) implicitly grants inherited access to all parent-authorized users; moving an object between parents is a mixed revoke+grant. Verify where creation/move currently triggers recompute and route both through the conditional async classification table.
6. Group-role changes are resolved no-ops for object access. `getMaxAccessLevelCombined` unions group owner, members, and admins without changing permission level (`packages/util/src/permissions/util.ts:138-175`). `promoteGroupMemberToAdmin`, `demoteGroupAdminToMember`, and `transferGroupOwnership` preserve that union. They must not enqueue or recompute `DerivedPermission`.

### R5: Existing async infra (evidence)

- Hatchet client (`packages/hatchet/src/client.ts`), task registry `prepareHatchetTasks` (`packages/hatchet/src/index.ts`), handlers injected from `@klicker-uzh/graphql` (`packages/graphql/src/index.ts:69-84` — sharing service registers zero handlers today).
- Reusable patterns from `apps/hatchet-worker-response-processor/src/index.ts`: durable tasks, `onFailure` → event push (L54-69), per-key concurrency `{expression: 'input.<key>', maxRuns: 1, GROUP_ROUND_ROBIN}` (L75-79).
- New-task wiring checklist: task in `packages/hatchet/src/index.ts` + types in `packages/types/src/hatchet.ts` + handler export in `packages/graphql/src/index.ts` + general worker picks up automatically (`HATCHET_WORKFLOWS` env or all).
- Current limitation: `create-audit-log-entry` only calls `ctx.logger.info` and contains a TODO for a real audit service (`packages/hatchet/src/index.ts:41-57`). It is not a persistent failure record and cannot satisfy the async rollout gate.

## PR #4808 Review

- What it is: concept docs (`permission-v2-concept.md`, `permission-v3-concept.md`, `PLANNING.md`, `TODO-EPIC-*.md`) + partial code. Mechanism: `PendingPermissionOperation` table — row-per-unit-of-work queue with operation-type enum, status, priority, `parentOperationId` recursion tree, retry counters, idempotency fingerprint + unique constraint.
- Status: shadow-write only. Mutations still run full sync recompute unchanged, then best-effort enqueue rows nothing consumes. Processor (Epic 4) 0% built. ~22% of checklist items done, all in the no-prod-risk bucket. Debug `console.log`s left in. Hierarchical propagation explicitly "not implemented in simplified version" despite being the concept's core diagram.
- Adopt:
  - v2→v3 insight: per-request status flag can't express progress; need per-unit-of-work granularity. Validates set-based + per-object async design.
  - Hard invariant: authorization reads `DerivedPermission` only, never falls back to `Permission` — fail closed during propagation lag. Keep explicit.
  - Revoke > update > grant priority ordering.
  - Idempotency-fingerprint + unique-constraint pattern → maps to Hatchet concurrency keys.
  - Their mid-epic security catch: generic "expand group" op couldn't distinguish grant/update/revoke intent — any generic recompute payload must carry explicit intent or, better, always full-re-derive (our choice, makes intent irrelevant).
- Reject:
  - `PendingPermissionOperation` table + custom processor: reschedules the identical O(users × hierarchy) per-row work into a queue ("11,050 operations" in their own example) instead of reducing it. Set-based SQL reduces the work; Hatchet replaces the queue infra.
  - All of section 6.3 (k8s CronJob+curl, custom Node worker, Bull/BullMQ) — predates Hatchet in this repo; Hatchet provides retries/backoff/concurrency/observability already.
  - Dual-mode shadow-write rollout with feature-flag traffic % — heavyweight; our recompute is idempotent full-re-derive, verified by tests + reconciliation checker instead.
- Unresolved gaps it left (we address): revoke-vs-lag semantics never validated (Slice 6), no reconciliation tool (Slice 7), operation-table cleanup moot (no table), "access pending" UX undesigned (deferred, see Decisions).
- Disposition: recommend closing PR #4808 with a comment linking this plan once the new PR exists. **User decision.**

## Decisions

- [ADR-0001](../docs/adr/0001-fail-closed-permission-propagation.md) records the consistency boundary.
- Keep `DerivedPermission` as the authorization read model. Reduce recompute cost with set-based SQL before considering async propagation.
- Phase A is fixed: measure → harden checks → set-based rewrite. The post-Slice-3 gate uses measured mutation latency and transaction duration to decide whether Phase B is needed.
- If Phase A meets the accepted SLO, keep recomputation synchronous and skip async propagation. Record the measured threshold and maintainer decision in `Progress`.
- No production path may move a cascade outside its transaction until durable dispatch, persistent failure reporting, reconciliation, and a database fence shared by synchronous mutations and workers have landed together.
- Revokes, downgrades, group removals, group deletion, and entity ownership transfers remain synchronous and fail-closed. Grants and group additions may become eventual only in conditional Phase B.
- Hatchet concurrency limits task runs; it is a throughput control, not the correctness fence. It does not serialize GraphQL mutations or tasks with different keys that update overlapping hierarchy rows.
- Async tasks must full-rederive from source state, be idempotent, and carry enough identity to recover missed or failed work. A persistent dirty marker or equivalent durable dispatch record must be written atomically with the source mutation.
- Async failures must reach a persistent database audit record or alert sink. `create-audit-log-entry` logging alone is insufficient.
- Do not add an "access pending" UI by default. Revisit it before Slice 7 if the approved recovery SLO or user testing shows that grant lag needs an explicit state.
- Resolved by user (2026-07-07): (a) `changeElementStatus` stays READ-gated — intentional reviewer workflow (status transitions without write permissions); (b) [PR #4808](https://github.com/uzh-bf/klicker-uzh/pull/4808) stays open; new plan PR created and cross-linked via comment on #4808; (c) external `agy` review of this plan approved despite security findings in scope.
- Resolved by review (2026-07-23): group owner/member/admin role changes do not affect group-derived object access; promotion, demotion, and group ownership transfer are excluded from recompute routing.

## Skill Routing

- Run the slice's repository-native checks and inspect their fresh output before each commit; use the relevant KlickerUZH browser/E2E skill when a later change affects a user-facing path.
- Review subagent + simplification subagent per slice (caveman basic form, severity-tagged).
- `$security-review` as mandatory final gate before the draft PR is marked ready (branch scope: auth-critical).
- `$rs-mr-description-writer` for PR body.
- Current Hatchet documentation before conditional Phase B; do not rely on the installed SDK examples alone.
- Update `docs/auth-model.md`, `docs/async-and-workers.md`, and the relevant agent-facing skill when runtime behavior changes.
- Independent final branch review: prefer `agy` in read-only plan mode.

## Slices

Phase A is unconditional: 1 → 2 → 3 → Gate A. Phase B is conditional: 4 → 5 → 6 → 7. Slice 8 closes either path.

Gate A after Slice 3:

- Re-run Slice-1 benchmarks and record mutation latency, transaction duration, rows changed, and the slowest fan-out.
- Compare the result with the SLO approved after Slice 1. The maintainer decides whether synchronous set-based recompute meets it.
- If yes: keep recompute synchronous, skip Slices 4-7, and finish Slice 8.
- If no: run Slice 4. Do not move work out of transactions before its design is approved and Slices 5-6 have landed.

### Slice 1 — Perf baseline + instrumentation

- Do: add benchmark-only timing around the full sharing-mutation transaction and its nested `recomputeDerivedPermissions` call, plus Prisma query count, rows changed, root object type, mode (user/object), and known descendant counts. Avoid a production-wide mutable counter. Benchmark on a seeded DB: share/revoke/transfer on Testkurs-sized and synthetic-large (50 activities × 30 elements, 30 users) courses; group membership change on a group with 20 object grants. Create a synthetic `UserGroup` + N-object-grant fixture because `packages/prisma-data` has no reusable group fixture.
- Check: record before-numbers and the proposed mutation-latency and transaction-duration SLO in `Progress`. The maintainer approves the fixture and SLO before Slice 3 begins. No behavior change; `pnpm --filter @klicker-uzh/util check` + focused GraphQL permission tests green.
- Commit: `test(packages/graphql): baseline permission propagation performance`

### Slice 2 — Harden check path

- Do: (a) `checkAccess` throws on empty checks array; (b) replace conditional-spread `ObjectType` branching in sharing mutations with one exhaustive selector plus a `never` guard; (c) verify, rather than rewrite, the existing `DerivedPermission` batch filters and lock their intended propagation levels in tests. (`changeElementStatus` stays READ-gated — intentional reviewer workflow, see R4.2.)
- Check: new vitest cases: empty checks throw; unsupported `USER_GROUP` sharing dispatch fails closed; activity batch includes a course-inherited WRITE user; element batch includes a course-inherited ADMIN user without broadening course-origin WRITE propagation to elements; READ user can still call the `changeElementStatus` GraphQL mutation. Full `pnpm --filter @klicker-uzh/graphql test`.
- Commit: one per sub-item if diffs are large, else `fix(packages/graphql): harden object permission checks and batch-op filters`
- Risk: exhaustive dispatch changes unsupported sharing types from a late Prisma validation failure to a nullable fail-closed result. The batch behavior itself must remain unchanged.

### Slice 3 — Set-based recompute rewrite

- Do: rewrite internals of `recompute<Entity>Permissions{User,Object}` in `packages/util/src/permissions/*` as set-based SQL per hierarchy level: `INSERT ... SELECT` from `Permission` + group membership + ownership + parent joins `ON CONFLICT DO UPDATE`, and `DELETE ... USING` for removals. This is the first runtime permission path using raw SQL, though scripts and Playwright setup already use `$executeRaw`. Hard rule: `$executeRawUnsafe` and string interpolation into SQL are prohibited; only Prisma's tagged-template `$executeRaw`/`Prisma.sql` parameterization. `DerivedPermission` is one shared table with 8 parallel unique constraints; each module must name its exact conflict target. Preserve external function signatures + propagation semantics exactly (`getActivityAccessFromCourse` `util.ts:211-256`, including the row-level `propagation` flag; activity→element rules `element.ts:21-49`). One entity module per sub-step, course last.
- Check: existing permission DB test suites green after each module; Slice-1 benchmark re-run. While both paths exist, run old and new implementations on the same fixtures and diff canonicalized `DerivedPermission` rows. Before deleting the old path, convert the important scenarios into permanent expected-row fixtures/reference cases. The permanent suite, not retained production code, is the independent oracle and schema-drift tripwire.
- Commit: per module — `perf(packages/util): set-based derived-permission recompute for <entity>`
- Risk: highest-complexity slice. SQL must replicate max-level dedup (`getMaxAccessLevelCombined`) and propagation-flag semantics; equivalence-diff test is the guard. Split further if any module exceeds reviewable size.

### Slice 4 — Prove the async safety contract (conditional)

- Trigger: Gate A shows synchronous set-based recompute misses the accepted SLO.
- Do: create a bounded database-backed prototype and amend this plan/ADR with one chosen contract before production changes. It must prove: (a) source mutation + durable dirty/outbox record are atomic; (b) synchronous mutations and workers share a database fence; (c) tasks for different roots that touch overlapping hierarchy rows cannot commit stale state; (d) crash after source commit but before Hatchet enqueue is recovered; (e) failed work reaches a persistent database audit record or alert sink; (f) the maximum recovery SLO is explicit.
- Candidate approaches: transactionally written dirty-state/outbox row with a monotonic generation; database locking plus a durable dirty marker; or keep recomputation synchronous. Hatchet `maxRuns` is not an eligible correctness mechanism by itself.
- Check: deterministic tests reproduce the grant-worker/revoke race and the commit-before-enqueue crash. The stale worker must not resurrect access; missed dispatch must converge within the proposed SLO.
- Commit: `docs(project): record async permission propagation safety contract` plus a test/prototype commit if code is needed.
- Pause: maintainer approval required because the selected fence changes data shape and concurrency semantics.

### Slice 5 — Durable async foundation + reconciliation (conditional)

- Do: implement the approved durable dispatch record, generation/fence, `recompute-derived-permissions` task, persistent failure sink, and reconciliation task. Do not convert sharing call sites yet. Task identity must include object type and object ID; user/mode scope is included when the selected contract requires it. Reconciliation selects unresolved dirty records first, then unions recent `Permission`, `UserGroup`, ownership/audit, child creation, and reparent signals; it also samples the remaining graph and performs a bounded off-peak full sweep.
- Check: source transaction rollback creates no work; crash after source commit but before enqueue is recovered; worker failure is persisted; synthetic drift heals; concurrent parent/child recomputes converge without stale writes. Hatchet-lite integration + focused DB tests green.
- Commit: `enhance(packages/hatchet): add durable permission propagation foundation`
- Deployment gate: ship the database migration first, then worker and reconciliation support, then the API call sites that create and enqueue work.

### Slice 6 — Keep revokes fail-closed (conditional)

- Do: revoke/downgrade removes or downgrades affected child `DerivedPermission` rows synchronously under the approved fence. If a user still deserves access through another path, record a durable settle in the same source transaction. If Slice-3 full recompute meets the revoke SLO, prefer the simpler fully synchronous rederive over strip + settle.
- Mutation classification table (routing contract; a downgrade revokes the delta, while a durable settle may restore the remainder):

  | Mutation | Class | Path |
  |---|---|---|
  | `shareObject` (new grant) | grant | async cascade (Slice 7) |
  | `shareObject` (upsert to higher level) | grant | async cascade |
  | `changeObjectPermissionLevel` upgrade | grant | async cascade |
  | `changeObjectPermissionLevel` downgrade | revoke | sync strip/rederive + durable settle |
  | `revokeObjectAccess` | revoke | sync strip/rederive + durable settle |
  | `addUserToUserGroup` | grant | async cascade |
  | `removeUserFromGroup` / `leaveUserGroup` | revoke | sync strip/rederive + durable settle |
  | `deleteUserGroup` | revoke | sync strip/rederive for affected users + durable settle |
  | `promoteGroupMemberToAdmin` / `demoteGroupAdminToMember` / `transferGroupOwnership` | no access change | no recompute |
  | `transfer*Ownership` (entity-level) | mixed | fully synchronous initially¹ |
  | child-object creation (element added to activity, activity added to course) | grant | async cascade (inherit parent grants) |
  | move/reparent (e.g. activity to different course), if supported | mixed | sync strip old-parent access + durable settle for new parent |

  ¹ If Slice 1/3 benchmarks show transfers still slow post-Slice-3, split: sync strip old owner's derived rows + durable settle for the new owner (new owner briefly lacking child access is fail-closed, acceptable).

- Check: in-flight grant task + revoke cannot resurrect access; direct + group user loses only the revoked delta after settle; revoked-only user has zero rows when the mutation returns; ADMIN→READ downgrade removes ADMIN-derived access synchronously; group role changes enqueue nothing.
- Commit: `fix(packages/graphql): fence fail-closed permission revokes`

### Slice 7 — Move grant cascades out of transactions (conditional)

- Do: atomically write the source grant, target-object `DerivedPermission`, audit entry, and durable dispatch record. Return after commit; Hatchet handles the child cascade. Convert only grant-classified call sites: new/higher `shareObject`, permission upgrade, `addUserToUserGroup`, and verified child creation. Group-add fan-out writes durable work in one database operation, not N network round-trips. Remove `{ timeout: 60000 }` only where measurements show it is no longer needed.
- Check: share course → child rows appear within the approved SLO; crash before Hatchet enqueue still converges; two overlapping parent/child grants serialize through the correctness fence; group removal remains synchronous; propagation lag is recorded without object/user PII. Staging proves worker-before-API deployment ordering.
- Commit: `perf(packages/graphql): dispatch grant permission cascades durably`
- Risk: grant recipients may briefly lack child access. This is fail-closed and accepted only within the approved recovery SLO.

### Slice 8 — Docs + notes

- Do: update `docs/auth-model.md`, `docs/async-and-workers.md`, and the relevant agent-facing skill. Document `DerivedPermission` invariants, the synchronous/async split, failure recovery, and the Gate-A decision. Prune stale comments about sequential recompute.
- Check: `pnpm run check:all`.
- Commit: `docs(project): document permission propagation architecture`

## Independent Plan Review

- Round 1: native adversarial plan review, 2026-07-07. It verified the original code references and added downgrade classification, group fan-out, schema-drift, deployment-ordering, fixture, and hierarchy-race requirements.
- Round 2: user-approved external `agy`/Gemini review, 2026-07-07. It added child creation/reparenting, raw-SQL safety, ownership-transfer, revoke-lag, and batched fan-out concerns. The 2026-07-23 review supersedes its earlier recommendation to enqueue grants before a durable dispatch and database-fence design existed.
- Round 3: fresh primary review, native fact-check, and external `agy`/Gemini cross-check, 2026-07-23. Six accepted corrections reshaped the plan:
  1. Hatchet per-key concurrency is not a correctness fence for GraphQL mutations or overlapping hierarchy tasks.
  2. Best-effort post-commit enqueue can lose propagation work indefinitely.
  3. Group promotion, demotion, and group ownership transfer do not change effective object access.
  4. Permanent tests need expected-row fixtures or a reference model independent of the removed implementation.
  5. Reconciliation must cover group, ownership, creation, and reparent signals, not only recent `Permission` rows.
  6. `create-audit-log-entry` is application logging, not a persistent failure record.
- Result: Phase A now optimizes the synchronous path first. Phase B is conditional and cannot convert production call sites until durable dispatch, a shared database fence, persistent failure reporting, and reconciliation are implemented and approved together.
- Round 4: exact-commit native review after the external reviewer timed out, 2026-07-23. All six Round-3 findings were confirmed resolved and the plan was judged safe to begin Slice 1. Three later-gate corrections were accepted: include group/hierarchy state in ADR-0001, measure full transaction duration and approve the SLO before Slice 3, and deploy the Phase-B database migration before workers and API call sites. The unavailable `$verification-before-completion` reference was replaced with explicit repository-native verification.

## Progress

- 2026-07-07: investigation done (4 subagents), [PR #4808](https://github.com/uzh-bf/klicker-uzh/pull/4808) reviewed, plan drafted, independent plan review integrated (12/12 findings accepted), plan committed to `permission-propagation-plan` and pushed.
- 2026-07-07 (later): user decisions resolved (READ-gated status change intentional; #4808 stays open + cross-linked; agy approved). External agy review round 2 integrated (8 accepted, 1 rebutted). Execution order corrected to 3 → 6 → 4. Draft PR opened. Next: Slice 1.
- 2026-07-23: branch synchronized with current `v3`. Fresh review found unsafe concurrency, durability, reconciliation, group-role, test-oracle, and audit assumptions. Plan revised around a synchronous-first Phase A and conditional, fenced Phase B; ADR-0001 added. Exact-commit review confirmed all six findings resolved and no blocker to Slice 1; three later-gate corrections were integrated. Next: Slice 1.
- 2026-07-23 (implementation): Slice 1 benchmark and instrumentation implemented in an isolated linked-worktree devcontainer. Installed and repo-pinned devrouter are both 0.0.35; `devrouter upgrade` reports no newer target. Exact-commit correctness and simplification reviews were integrated: util now rebuilds before every benchmark, write mode rejects `NODE_ENV=production` and requires `PERMISSION_BENCHMARK_CONFIRM_LOCAL=1`, audit cleanup is scoped only through generated users, Testkurs answer-collection links are cloned, and large group revoke is independently prepared outside the timed measurement. Benchmark safeguards passed in dry-run and write mode: local-host guard, generated `@example.invalid` users, prefix-scoped writes, before/results snapshots under gitignored `project/_local/permission-propagation-benchmark/`, and cleanup verification (8 successes, 0 mismatches). The authoritative single-run report is `20260723174833-b1618efa-results.json`.

  | Scenario | Status | Total ms | Tx ms | Queries | Query ms¹ | Rows | Recompute calls | Recompute total ms | Recompute max ms |
  |---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
  | Testkurs-sized user share | success | 4,168.64 | 4,167.17 | 6,114 | 3,032.98 | 52 | 1 | 4,142.95 | 4,142.95 |
  | Testkurs-sized user revoke | success | 3,295.90 | 3,295.21 | 5,060 | 2,371.81 | 52 | 1 | 3,290.88 | 3,290.88 |
  | Testkurs-sized ownership transfer | success | 8,206.23 | 8,204.69 | 14,560 | 5,943.37 | 104 | 2 | 8,198.84 | 4,129.36 |
  | Testkurs-sized group share | success | 3,555.57 | 3,554.94 | 12,564 | 2,803.33 | 52 | 1 | 3,550.18 | 3,550.18 |
  | Testkurs-sized group revoke | success | 7,186.07 | 7,179.92 | 11,967 | 5,215.53 | 52 | 2 | 7,174.93 | 3,910.23 |
  | Synthetic-large user share | success | 18,362.37 | 18,361.84 | 33,824 | 12,644.50 | 1,551 | 1 | 18,357.01 | 18,357.01 |
  | Synthetic-large user revoke | success | 15,055.59 | 15,054.74 | 21,414 | 9,875.42 | 1,551 | 1 | 15,049.99 | 15,049.99 |
  | Synthetic-large ownership transfer | success | 38,003.89 | 38,002.66 | 61,440 | 27,027.86 | 3,102 | 2 | 37,997.75 | 19,254.83 |
  | Synthetic-large group share | timeout | 60,022.17 | 60,018.23 | 302,475 | 23,753.62 | 1 | 1 | 60,016.12 | 60,016.12 |
  | Synthetic-large group revoke | success | 31,881.63 | 31,874.51 | 50,580 | 21,729.17 | 1,551 | 2 | 31,865.03 | 17,279.29 |
  | Add member to group with 20 object grants | success | 228.91 | 224.63 | 411 | 144.82 | 20 | 20 | 220.16 | 12.30 |

  ¹ Prisma query duration is a summed driver metric and may exceed wall time when queries run concurrently.

  Testkurs-sized cloned the seeded Testkurs topology (20 activities, 29 unique elements, 286 element traversals, 2 linked answer collections). Synthetic-large used the approved 50 activities × 30 distinct elements and 30 permission users. The large group share timed out at Prisma's 60-second boundary and left one affected-user `DerivedPermission` snapshot difference; the independently prepared group revoke then completed in 31.88 seconds, and final prefix-scoped cleanup returned every benchmark table to zero. Focused GraphQL verification passed: `coursePermissions.test.ts`, `courseSharing.test.ts`, and `userGroups.test.ts` (89/89 tests). Proposed SLO for maintainer approval before Slice 3: p95 mutation latency ≤ 2.0 s, p95 transaction duration ≤ 1.5 s, and a 5.0 s hard ceiling for any supported sharing mutation. This is an SLO proposal, not a claim derived from the single local run. An initial full-worker attempt hit an SDK heartbeat logger crash; Slice 2 later proved that a narrowly scoped local `createAuditLogEntry` worker can start and process the full test suite. Conditional Phase B still requires fresh verification of the complete worker set.

- 2026-07-23 (Slice 2 implementation): live schema inspection corrected R4.3: the Prisma `permissions` relation used by both batch services is already `DerivedPermission[]`, so no access-widening query rewrite was made. `checkAccess` now rejects empty input, and `shareObject`, `revokeObjectAccess`, `changePermissionLevel`, and `transferObjectOwnership` use one exhaustive `ObjectType` selector with a `never` guard; unsupported `USER_GROUP` dispatch fails closed. Regression coverage now proves course-inherited WRITE on activity batches, course-inherited ADMIN on element batches, and the intentional READ-gated `changeElementStatus` GraphQL workflow. Full-suite verification also exposed and fixed three ambiguous audit-log `findFirst` assertions by selecting the latest matching entry. Verification: GraphQL typecheck and repository-wide `pnpm run check:all` passed; affected permission files passed 61/61 tests; full GraphQL suite passed 57/57 suites and 527/527 tests against a disposable PostgreSQL 15 database with a narrowly scoped local audit worker.
- 2026-07-23 (Slice 2 review): exact-range correctness review of `5c08e15c5..a3691d171` found no code or security defect and corrected one plan ambiguity: course-origin WRITE stops before elements, while a direct propagating activity WRITE grant can reach linked elements. The separate simplification pass centralized the selector/check type union, replaced nullable ordered audit lookups with `findFirstOrThrow`, and reused the shared live-quiz fixture. Post-review verification passed the three adjusted files (97/97 tests), the full GraphQL suite (57/57 suites, 527/527 tests), and repository-wide `pnpm run check:all`. The full-suite environment used the disposable PostgreSQL database, a narrowly scoped audit worker, and temporary loopback Redis relays required by the existing test harness.
- 2026-07-29 (Slice 3 start): maintainer approved the proposed Gate-A SLO: p95 mutation latency ≤ 2.0 s, p95 transaction duration ≤ 1.5 s, and a 5.0 s hard ceiling for every supported sharing mutation. Current `v3`, including the Prisma 7 upgrade, was merged before raw-SQL implementation. Slice 3 is active. The first sub-step is the isolated catalog-collection module, used to prove the tagged set-based delete/upsert pattern and its permanent expected-row coverage before applying it to hierarchical modules.
- 2026-07-29 (Slice 3 catalog implementation): catalog-collection recomputation now expands direct users plus group owners, members, and admins in one tagged SQL statement, ranks permission levels explicitly, deletes stale scoped rows, and upserts on the exact catalog/user conflict target. Permanent expected-row coverage proves all group roles, propagation tie-breaking, user-scoped isolation, and object-wide convergence; the focused suite passes 11/11 tests against a disposable database. Util and GraphQL typechecks pass. The `v3` Prisma 7 merge also required declaring the benchmark's existing direct `@prisma/adapter-pg` import in the GraphQL package; the lockfile change is limited to that importer.
- 2026-07-29 (Slice 3 catalog review): the simplification review recommended no changes. Correctness review identified that a dual-principal `Permission` row could be expanded to its group by the SQL while the previous reducer's `if`/`else if` honored only its direct user. Migrated databases enforce `UserOrGroupRequired`, but Prisma `db push` does not recreate that migration-only XOR constraint. The SQL now also requires `userId IS NULL` on every group-expansion branch, preserving fail-closed prior behavior across both construction paths. Post-review util typecheck, build, and all 11 catalog tests pass.
- 2026-07-29 (Slice 3 answer-collection implementation): user-scoped and object-wide answer-collection recomputation now share one tagged set-based statement. It expands direct and group grants, preserves owner/direct/linked-element/linked-template precedence, retains inherited READ access after soft deletion, preserves the activity-template relation priority, deletes stale scoped rows, and upserts on the exact answer-collection/user conflict target. A permanent exact-row oracle covers direct, group, element, and template sources plus user-scoped isolation and object-wide convergence. Focused answer-collection, template, sharing, soft-deletion, and revocation coverage passes 70/70 tests; util and GraphQL typechecks pass, and the util build passes after regenerating its ignored incremental build cache.
- 2026-07-29 (Slice 3 answer-collection review): correctness review found no blocker and confirmed that the set-based user path intentionally repairs the previous impossible four-relation template predicate so it converges with object-wide behavior. The simplification review found the explicit template branches justified. Accepted coverage findings now prove equal-level propagation tie-breaking, group-admin expansion and scoped revocation, user-scoped inheritance through live quiz, practice quiz, microlearning, and group activity templates, and soft-deletion convergence where owner/direct rows disappear while linked element/template READ rows remain. The production migration rejects malformed dual-principal rows, and every SQL group branch independently retains the `userId IS NULL` fail-closed guard for Prisma `db push` databases that lack that migration-only constraint. Post-review GraphQL and util typechecks pass, as do the strengthened focused suites (48/48 tests).
- 2026-07-29 (Slice 3 element implementation): user-scoped and object-wide element recomputation now share one tagged set-based statement. It expands direct and group grants, selects the maximum effective level across owner, direct, and all four parent-activity sources, preserves activity-to-element propagation rules and provenance, deletes stale scoped rows, and upserts on the exact element/user conflict target before retaining access-request and linked answer-collection propagation. Permanent precedence coverage now proves that a propagating activity READ or WRITE grant cannot downgrade a higher direct element grant, correcting the previous iteration-order-dependent object path while making user-scoped and object-wide results converge. The focused element suite passes 24/24 tests, adjacent activity/resource propagation suites pass 72/72 tests, and util plus GraphQL typechecks and focused formatting checks pass against the disposable database and freshly rebuilt util bundle.
- 2026-07-29 (Slice 3 element review): exact-commit correctness review found no defect and independently verified group expansion, fail-closed dual-principal guards, all four activity sources, the course-origin boundary, deterministic max-level provenance, scoped deletion, soft deletion, the exact conflict target, tagged SQL safety, and downstream recomputation. The simplification pass found the SQL appropriately explicit and only identified stale JSDoc plus two unused selected fields; both were corrected. Both reviews suggested a malformed dual-principal runtime test for `db push` schemas, but CI uses `prisma migrate reset` and enforces `UserOrGroupRequired`, so the fixture cannot be created without transactional schema DDL in the shared suite. The production constraint and explicit `permission."userId" IS NULL` guards remain the proportionate defense.
- 2026-07-29 (Slice 3 live-quiz implementation): user-scoped and object-wide live-quiz recomputation now share one tagged set-based statement. It expands direct and group grants, maps linked-course access through the existing propagation contract, preserves direct-over-course ties, deletes stale scoped rows, and upserts on the exact live-quiz/user conflict target before retaining access-request and element propagation. A permanent exact-row oracle proves scoped isolation, owner/direct/group/course precedence, non-propagating course WRITE to activity EXECUTE, object-wide convergence, stale direct-row removal, and fallback to a remaining group grant. The freshly rebuilt util bundle passes the complete activity-permission suite (49/49 tests), and util plus GraphQL typechecks and focused formatting checks pass.
- 2026-07-29 (Slice 3 live-quiz review): exact-commit correctness review found no defect and verified every course mapping, direct/group expansion, fail-closed guards, nullable-course and soft-deletion behavior, scoped convergence, exact conflict target, tagged SQL safety, and downstream propagation. The simplification pass found the security-relevant CTEs appropriately explicit and removed only a redundant `sourceKey` ranking column. Both reviews independently requested an equal-level direct-live-quiz WRITE versus propagating-course WRITE case; the exact oracle now proves direct provenance wins in both scoped and object-wide recomputation and that revoking it falls back to the course-derived WRITE row. The complete activity suite still passes 49/49 tests after the accepted adjustments.
- 2026-07-29 (Slice 3 practice-quiz implementation): user-scoped and object-wide practice-quiz recomputation now share the reviewed tagged set-based activity pattern with explicit practice-quiz columns and the exact practice-quiz/user conflict target. It preserves course mapping, direct-over-course ties, fail-closed group expansion, soft deletion, access-request updates, and downstream element propagation. A permanent exact-row oracle proves scoped isolation, group-owner/admin expansion, non-propagating course WRITE to EXECUTE, object-wide convergence, and scoped stale-row deletion without disturbing other users. The freshly rebuilt util bundle passes the complete activity-permission suite (50/50 tests), and util plus GraphQL typechecks and focused formatting checks pass.

## Goal Prompt Requirements (for handoff)

- Reference this plan by exact path; update `Progress` while working; execute one tracer-bullet slice at a time; run the fastest meaningful verification; make a clean conventional commit; send that exact commit or range to separate review and simplification subagents; integrate accepted findings and commit adjustments before the next slice. Run applicable E2E, `$security-review`, independent branch review, and `$thermo-nuclear-code-quality-review` before marking the draft PR ready. Maintain the PR body with `$rs-mr-description-writer`. Pause at Gate A and Slice 4 for the decisions recorded above.

## Next Steps

- Commit and review the practice-quiz module.
- Continue Slice 3 with microlearning and group activity, with course last; run the Gate-A benchmark against the approved SLO.
- Separate task (not this branch): response-api standard-mode auth audit (R4.4).
