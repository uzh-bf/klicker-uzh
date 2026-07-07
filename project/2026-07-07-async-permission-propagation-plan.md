# Async Permission Propagation + RBAC Hardening — Plan

## Plan Identity

- Plan: `project/2026-07-07-async-permission-propagation-plan.md`
- Branch: `permission-propagation-plan` (plan commit); implementation continues on this branch
- Target: `v3`
- PR: none yet (rename plan to `pr-<id>` form once opened)
- History: [PR #4808](https://github.com/uzh-bf/klicker-uzh/pull/4808) `[CONCEPT] New suggested approach for asynchronous permission propagation` (branch `transaction-concept`, draft, unmerged) — earlier attempt at same problem, reviewed below.

## Goal

- Problem: sharing/revoking/transferring objects recomputes the materialized `DerivedPermission` cache synchronously + recursively (Course → LiveQuiz/PracticeQuiz/MicroLearning/GroupActivity → Elements → AnswerCollections) inside request-blocking Prisma transactions. 14 call sites in `packages/graphql/src/services/sharing.ts` carry `{ timeout: 60000 }`. Slow, lock-heavy, scales with course size × user count.
- Goal: make permission writes fast and non-blocking, keep authorization fail-closed and correct, close known auth-check gaps.
- Non-goals: no external authz system (Zanzibar/SpiceDB/OpenFGA), no removal of `DerivedPermission` model, no read-path redesign (single-row `findUnique` checks stay), no UX redesign of sharing modals, no response-api rework (separate audit — see Next Steps).

## Research

Codebase investigation via 4 subagents (3 explore + 1 PR review), 2026-07-07. No external research needed; all evidence local. Limitation: perf numbers are structural inference (row-count math), not measured — Slice 1 fixes that before optimization claims are trusted.

### R1: Data model (evidence)

- `Permission` = direct grant (user XOR group, `propagation` flag, 8-way polymorphic FK columns) — `packages/prisma/src/prisma/schema/sharing.prisma:30-92`.
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
2. `changeElementStatus` gated at READ (`packages/graphql/src/schema/mutation.ts:959-972`), service does unfiltered `element.update` (`elements.ts:854-869`). Read-only collaborator can flip publish/review status. Deliberate per comment, inconsistent with WRITE-gated content mutations.
3. Batch ops (`applyElementBatchOperations`, `elements.ts:775-798`) filter on direct `permissions` relation only, not `DerivedPermission` — course-inherited editors silently excluded. Fails closed; correctness bug, bypasses canonical check path.
4. `response-api` standard mode unauthenticated by design (`apps/response-api/src/index.ts:93-157`), trusts client `liveQuizId`/`instanceId`; assessment mode in same file fully gated. Out of scope here; separate audit (Next Steps).
5. Open verification items (from plan review, resolve before Slice 5): (a) `demoteGroupAdminToMember` (`sharing.ts:6469-6512`) calls no recompute — confirm group admin-vs-member carries no differential object-level access, else pre-existing bug, file separately; (b) `transferGroupOwnership` (`sharing.ts:6623-6697`) changes only `UserGroup.ownerId`/admins, touches no `DerivedPermission` — confirm group ownership (unlike entity ownership) has no derived-permission implications, so the "ownership transfers stay sync" bucket is complete.

### R5: Existing async infra (evidence)

- Hatchet client (`packages/hatchet/src/client.ts`), task registry `prepareHatchetTasks` (`packages/hatchet/src/index.ts`), handlers injected from `@klicker-uzh/graphql` (`packages/graphql/src/index.ts:69-84` — sharing service registers zero handlers today).
- Reusable patterns from `apps/hatchet-worker-response-processor/src/index.ts`: durable tasks, `onFailure` → audit-log event push (L54-69), per-key concurrency `{expression: 'input.<key>', maxRuns: 1, GROUP_ROUND_ROBIN}` (L75-79).
- New-task wiring checklist: task in `packages/hatchet/src/index.ts` + types in `packages/types/src/hatchet.ts` + handler export in `packages/graphql/src/index.ts` + general worker picks up automatically (`HATCHET_WORKFLOWS` env or all).

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

- Keep `DerivedPermission` as materialized cache. Reduce recompute cost with set-based SQL first; async only for what remains slow.
- Order: measure → harden → set-based rewrite → decouple → async grants → revoke fast-path → reconciliation. Re-evaluate need for async after Slice 4 measurements; grants-async (Slice 5) proceeds only if set-based is still too slow for group/course fan-outs.
- Revokes + ownership transfers stay synchronous (fail-open lag unacceptable); grants + group-membership additions may be eventual (fail-closed lag acceptable).
- Hatchet as execution substrate; recompute tasks are stateless idempotent full-re-derives; per-object concurrency key `maxRuns: 1` serializes racing recomputes; last write wins correctly because recompute derives from source of truth, never applies deltas.
- No "access pending" UI in v1 — grants converge in seconds; revisit if Slice 5 telemetry shows longer lag.
- Open (user input, defaults chosen): (a) `changeElementStatus` READ→WRITE — default WRITE, applied in Slice 2 unless overruled; (b) PR #4808 disposition — default: close after new PR opens.

## Skill Routing

- `$verification-before-completion` before each slice commit.
- Review subagent + simplification subagent per slice (caveman basic form, severity-tagged).
- `$security-review` as mandatory final gate before PR (branch scope: auth-critical).
- `$df-mr-description-writer` for PR body.
- Context7 for Hatchet TypeScript SDK docs before Slice 5 (API may have moved since worker code was written).
- Independent final branch review: prefer `agy`; note plan/branch contains security findings → confirm with user before external cloud review, else Claude-independent subagent.

## Slices

Dependencies: 1 → (2, 3) independent of each other; 4 needs 3; 5 needs 4; 6 needs 3 (not 5); 7 needs 5; 8 after all.

### Slice 1 — Perf baseline + instrumentation

- Do: timing + node-count instrumentation around `recomputeDerivedPermissions` (duration, object type, mode user/object, child counts) via existing logger. Vitest-or-script benchmark on seeded DB: share/revoke/transfer on Testkurs-sized and synthetic-large (50 activities × 30 elements, 30 users) course; group-membership change on group with 20 object grants. Sub-task: create synthetic `UserGroup` + N-object-grant fixture — `packages/prisma-data` seed has zero `UserGroup` records today (grep-confirmed).
- Check: recorded before-numbers in this file under Progress. No behavior change; `pnpm --filter @klicker-uzh/util check` + graphql tests green.
- Commit: `perf(packages/util): instrument derived-permission recompute with timing + node counts`

### Slice 2 — Harden check path

- Do: (a) `checkAccess` throws on empty checks array; (b) replace conditional-spread `ObjectType` branching in sharing mutations with exhaustive switch + `never` guard; (c) route `applyElementBatchOperations`/`applyActivityBatchOperations` filters through `DerivedPermission`; (d) `changeElementStatus` READ→WRITE (default decision).
- Check: new vitest cases: empty-checks throws; batch op includes course-inherited WRITE user; READ user rejected on status change. Full `pnpm --filter @klicker-uzh/graphql test`.
- Commit: one per sub-item if diffs are large, else `fix(packages/graphql): harden object permission checks and batch-op filters`
- Risk: (c) widens batch-op access to derived-permission holders — intended, but confirm no test encodes the old exclusion.

### Slice 3 — Set-based recompute rewrite

- Do: rewrite internals of `recompute<Entity>Permissions{User,Object}` in `packages/util/src/permissions/*` as set-based SQL per hierarchy level: `INSERT ... SELECT` from `Permission` + group membership + ownership + parent joins `ON CONFLICT DO UPDATE`, and `DELETE ... USING` for removals (`$executeRaw`, parameterized — first raw-SQL use in this repo, grep-confirmed no precedent). `DerivedPermission` is one shared table with 8 parallel unique constraints — each module must name its exact conflict target (e.g. `ON CONFLICT ("courseId", "userId")`), else Postgres errors with "no unique or exclusion constraint matching". Preserve external function signatures + propagation semantics exactly (`getActivityAccessFromCourse` `util.ts:211-256`, incl. row-level `propagation`-flag conditional; activity→element rules `element.ts:21-49`). One entity module per sub-step, course last (deepest cascade).
- Check: existing permission vitest suite green after each module (5 files, ~13k lines — solid base); Slice-1 benchmark re-run — expect order-of-magnitude drop; equivalence test: run old path vs new path on same seed, diff `DerivedPermission` table. Keep a slimmed equivalence test permanently in CI — raw SQL bypasses Prisma's type-checked builder, so a future `.prisma` column rename produces no `tsc` error; the permanent test is the schema-drift tripwire. Column names in raw SQL get a comment linking back to `sharing.prisma`.
- Commit: per module — `perf(packages/util): set-based derived-permission recompute for <entity>`
- Risk: highest-complexity slice. SQL must replicate max-level dedup (`getMaxAccessLevelCombined`) and propagation-flag semantics; equivalence-diff test is the guard. Split further if any module exceeds reviewable size.

### Slice 4 — Shrink transaction scope

- Do: keep atomic: `Permission` upsert/delete + audit log + target-object `DerivedPermission` row. Move child cascade out of the `$transaction` (still in-process, after commit). Remove `{ timeout: 60000 }` overrides where no longer needed.
- Check: benchmark: mutation latency ≈ constant regardless of course size; crash-between-commit-and-cascade leaves target object correct + children stale → document as accepted pre-Slice-7 window. Explicit test for the group fan-out case: crash mid `recomputePermissionsUserGroupMember` loop leaves an arbitrary subset of the group's granted objects stale for that user (blast radius = many objects, not one object's children) — verify only completed-so-far objects updated and note the window is bounded until Slice 7 lands. Vitest green.
- Commit: `perf(packages/graphql): decouple permission cascade from sharing mutation transactions`

### Slice 5 — Async cascade via Hatchet (grants + group additions only) — conditional on Slice 4 measurements

- Prereq: resolve R4.5 verification items (admin-demote no-op, group-ownership transfer) first.
- Do: new task `recompute-derived-permissions` (payload `{objectType, objectId, userId?, mode}`; retries 3; `onFailure` → `create-audit-log-entry` event; concurrency key `objectId`, `maxRuns: 1`, GROUP_ROUND_ROBIN). Wire per R5 checklist. Converted call sites — grants only, named explicitly: `shareObject` (new grant path), `addUserToUserGroup`, `promoteGroupMemberToAdmin`. NOT converted (stay synchronous; revoke semantics): `revokeObjectAccess`, `removeUserFromGroup`, `demoteGroupAdminToMember`, all `transfer*Ownership`, and the downgrade path of `changeObjectPermissionLevel` (see Slice 6 decision table). Caution: grant and revoke group paths share `recomputePermissionsUserGroupMember` (`sharing.ts:5992`) today — a blanket "group changes async" edit would async-ify revokes and violate the fail-closed invariant; split or parameterize the helper so the revoke path provably keeps the sync branch, with a dedicated test asserting group-removal effects are visible synchronously.
- Check: integration test with hatchet-lite (Cypress/dev compose stack): share course → child `DerivedPermission` rows appear async; kill worker mid-cascade → retry converges; two concurrent shares on same course → serialized, final state correct; group removal → synchronous, no enqueue. Telemetry: propagation-lag metric logged. Deploy ordering: worker registering the new task ships before the graphql service that enqueues to it — verify on staging (share succeeds, task consumed) before merge.
- Commit: `feat(packages/hatchet): async derived-permission propagation task` + `refactor(packages/graphql): enqueue permission cascade for grants`
- Risk: eventual consistency for grants — recipient may briefly lack child access (fail closed, acceptable). Group-add fans out N per-object tasks for one user with no cross-object ordering — safe because each task is a full re-derive reading current `Permission`/group state fresh; there is no cross-object invariant to violate, so interleaving cannot produce a wrong final state for any single object.

### Slice 6 — Revoke fast-path (independent of Hatchet — can start right after Slice 3)

- Do: revoke/downgrade: synchronous set-based `DELETE`/downgrade of all child `DerivedPermission` rows for affected users (fail-closed over-delete acceptable), then enqueue async recompute to restore anything still deserved via other grants/groups (until Slice 5 lands, "enqueue" = in-process post-commit call).
- Mutation classification table (routing contract; a downgrade is a revoke of the delta plus a grant of the remainder — the strip is synchronous, the settle may be async):

  | Mutation | Class | Path |
  |---|---|---|
  | `shareObject` (new grant) | grant | async cascade (Slice 5) |
  | `shareObject` (upsert to higher level) | grant | async cascade |
  | `changeObjectPermissionLevel` upgrade | grant | async cascade |
  | `changeObjectPermissionLevel` downgrade | revoke | sync strip + async settle (this slice) |
  | `revokeObjectAccess` | revoke | sync strip + async settle |
  | `addUserToUserGroup` / `promoteGroupMemberToAdmin` | grant | async cascade |
  | `removeUserFromGroup` / `demoteGroupAdminToMember` | revoke | sync strip + async settle |
  | `transfer*Ownership` (entity-level) | mixed | fully synchronous (both directions) |

- Check: test: user with two access paths (direct + group) loses direct → immediately loses over-granted child rows, async restore returns group-derived level; revoked-only user has zero rows immediately after mutation returns; ADMIN→READ downgrade strips ADMIN-derived child rows synchronously.
- Commit: `fix(packages/graphql): fail-closed synchronous revoke with async permission restore`

### Slice 7 — Reconciliation + observability

- Do: Hatchet cron (daily, pattern per `packages/hatchet/src/index.ts:213-275`): recompute-vs-stored diff over sampled/all objects, log discrepancies + auto-heal, audit-log entry on drift. Alerting hook = audit log for now.
- Check: seed artificial drift (manual row delete) → cron heals + logs.
- Commit: `feat(packages/hatchet): derived-permission reconciliation cron`

### Slice 8 — Docs + notes

- Do: update `project/CODEBASE_NOTES.md` (permission architecture section: invariants, sync/async split, fail-closed rule); prune stale comments about sequential recompute.
- Check: `pnpm run check:all`.
- Commit: `docs(project): document permission propagation architecture`

## Independent Plan Review

- Reviewer: Claude-independent subagent (fresh context, adversarial prompt), 2026-07-07. Status: DONE_WITH_CONCERNS. External cloud review (`agy`/Codex) deliberately not used without asking: plan text contains security findings (R4), which per data-protection rules requires explicit user approval first — offer stands in Next Steps.
- Reviewer re-verified all load-bearing file:line claims against the worktree; none found false. Additional facts established: no `$executeRaw` precedent in repo; no `UserGroup` in test seed; `runNoWait()` exists in installed `@hatchet-dev/typescript-sdk@1.9.4` but is unused so far; permission vitest suite = 5 files / ~13k lines.
- Findings, all accepted and integrated: (C1) grant/revoke group paths share `recomputePermissionsUserGroupMember` — Slice 5 now names exact converted call sites + helper-split requirement; (C2) `demoteGroupAdminToMember` calls no recompute — added R4.5 verification item; (C3) downgrade-as-revoke classification — added routing table to Slice 6; (I4) group fan-out crash blast radius — Slice 4 check extended; (I5) cross-object same-user race safety — stated explicitly in Slice 5 risk; (I6) raw-SQL schema-drift tripwire — equivalence test now permanent CI test; (I7) `ON CONFLICT` constraint targeting on shared 8-constraint table — added to Slice 3; (I8) worker-before-enqueuer deploy ordering — added to Slice 5 check; (I9) `transferGroupOwnership` asymmetry — added R4.5 verification item; (M10) missing UserGroup fixture — Slice 1 sub-task; (M11) `UserActivities` evidence claim softened; (M12) Slice 6 independence noted in its header.

## Progress

- 2026-07-07: investigation done (4 subagents), [PR #4808](https://github.com/uzh-bf/klicker-uzh/pull/4808) reviewed, plan drafted, independent plan review integrated (12/12 findings accepted), plan committed to `permission-propagation-plan` and pushed. Next: user decisions (see Next Steps), then Slice 1.

## Goal Prompt Requirements (for handoff)

- Reference this plan by exact path; update `Progress` while working; one slice at a time; verification + review subagent + simplification subagent + clean conventional commit per slice; rename plan file with `pr-<id>` in separate metadata commit once PR exists; final `$security-review` + independent branch review before PR; PR body via `$df-mr-description-writer`; end with `Next Steps`.

## Next Steps

- User: approve/adjust open decisions — `changeElementStatus` level, PR #4808 closure, approval for external (`agy`) review despite security findings in scope.
- Then: execute Slice 1 on this branch.
- Separate task (not this branch): response-api standard-mode auth audit (R4.4).
