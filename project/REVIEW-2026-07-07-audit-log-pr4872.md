# Review: PR #4872 — Audit log for assessment mode

- **Date**: 2026-07-07
- **Scope**: Branch `audit-log` at `0a45f9725` vs `v3` (100 files, +20,658 / −7,625)
- **Goal being reviewed against**: a detailed, immutable audit log for **all** actions happening in assessment mode
- **Companion review**: `project/REVIEW-2026-07-07-audit-log-ui-pr4946.md` on branch `audit-log-ui` (PR #4946)

## Verdict

The architecture is sound and further along than typical WIP: a dedicated Hono service writing append-only entities to Azure Table Storage, a durable Hatchet ingestion path, deployable QA/prod manifests, and ~5,400 lines of tests. It is **not production-ready yet**. The blockers are: (1) frontend events are rejected with 401 for the login methods actually used in exams, (2) grade/point corrections are not audited at all, (3) "immutable" currently means "our code never updates" — nothing stops deletion/modification at the storage-account level, (4) the branch is 138 commits behind `v3` with ~20 conflicting files and red CI.

Recommended order of work: rebase + green CI first (everything else builds on it), then the coverage and immutability fixes below, then the operational hardening.

---

## What is genuinely good (keep as-is)

- **Append-only write semantics**: despite the misleading name, `upsertEntity` calls `createEntity` and treats 409 `EntityAlreadyExists` as success (`apps/audit/src/storage/table-client.ts:202-232`). Existing entities are never updated or deleted by the service. There is no delete/update code path anywhere in `apps/audit`.
- **Durable ingestion path exists**: the `create-audit-log-entry` Hatchet task with `retries: 3` (`packages/hatchet/src/index.ts:49-65`) gives at-least-once delivery for backend producers. `apps/response-api` uses it consistently for the whole response lifecycle (`apps/response-api/src/index.ts:177-431`).
- **Public endpoint enforces identity server-side**: client-supplied `subject`/`scope` are discarded and replaced from the verified JWT (`apps/audit/src/routes/audit-public.ts:99-123`), and public actions are allow-listed (`apps/audit/src/schemas/audit-event.ts:8-16`).
- **Sane storage schema**: minute-bucket + shard partition keys for range queries (`apps/audit/src/storage/entities.ts:83-100`), deterministic event IDs for idempotency, 32KB attribute cap aligned with Table Storage limits.
- **Fail-fast config** via zod on startup (`apps/audit/src/config.ts`), request logging via hono/pino, Prometheus-style counters (`apps/audit/src/utils/metrics.ts`).
- **Deploy surface is real**: 2–10 autoscaled replicas, resource requests/limits, prod/QA values and dedicated workflows (`deploy/env-prod-v3/values.yaml:536-557`, `.github/workflows/v3_audit-{qa,prod}.yml`).
- **PII hygiene**: helper for hashing sensitive values (`packages/util/src/audit.ts:13-15`), used for PINs and emails.

---

## Findings

Severity: 🔴 blocker for production · 🟠 major, fix before semester start · 🟡 minor / hygiene.

### A. Authentication & integrity

1. 🔴 **Frontend audit events get 401 for password-login and temporary participants.** The public endpoint only reads the `next-auth.participant-session-token` cookie (`apps/audit/src/routes/audit-public.ts:36-47`). But participants logging in via username/password receive `participant_token` (`packages/graphql/src/services/accounts.ts:89`) and temporary participants receive `temporary_participant_token` (`packages/graphql/src/services/accounts.ts:243`). Exam setups commonly use exactly these seat/temporary accounts, so **the entire UI audit trail silently fails for the primary exam scenario**. Codex flagged this on the PR as P1; it is still open. Fix: accept all three cookies (and verify each with the appropriate issuer/claims), or better, verify a single canonical participant JWT independent of cookie name.
2. 🟠 **Client-controlled `timestamp` on the public path.** `subject` and `scope` are overridden server-side, but `timestamp` is not — the zod default only applies when the client omits it (`apps/audit/src/schemas/audit-event.ts:35-40`). A student can post events with arbitrary timestamps, which places entities in arbitrary partition buckets (`entities.ts:83-100`) and forges the visible timeline. Azure's system `Timestamp` property records true write time, which limits the damage, but timeline queries use `eventTimestamp`/partition key. Fix: on `/audit/public`, override `timestamp` with server time (keep the client value in `attributes.clientTimestamp` for skew analysis).
3. 🟠 **Client-supplied `eventId` on the public path enables self-suppression.** `eventId` from the request body survives into the entity row key (`entities.ts:52-55`), and duplicates are treated as success. A participant could pre-insert an eventId and cause a later identical-id event to be dropped. The current UI client never sends `eventId`, so exposure is low today — but strip/ignore `eventId` on the public route the same way `subject` is ignored (`audit-public.ts:99-105`).
4. 🟡 **Static shared token for all internal producers** (`apps/audit/src/middleware/auth.ts:15-34`), compared with `!==` (not constant-time). Acceptable MVP inside the cluster (the author noted this on the PR); the roadmap item is per-service JWTs with distinct issuers, which also gives you producer attribution for free. Constant-time compare (`crypto.timingSafeEqual`) is a one-line hardening.
5. 🟡 **`rejectUnauthorized: false` outside production** (`packages/util/src/audit.ts:125-128`). Flagged by code scanning. Don't disable verification at all: local dev uses mkcert certificates, so point Node at the mkcert root CA instead (`NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"` in the dev scripts) and delete the custom `https.Agent`. That removes the MITM hole and the `NODE_ENV` footgun in one move.

### B. Immutability (the core requirement)

6. 🔴 **Immutability is application-level only.** The service connects with a full read-write account connection string (`AUDIT_TABLE_CONNECTION_STRING`, `apps/audit/src/config.ts`). Anyone with that secret — the service, ops staff, an attacker who obtains it — can update or delete entities directly. Azure **Table** Storage has no WORM/immutability policies (only Blob Storage does). For an exam-dispute-grade audit log you need at least one of:
   - **(cheapest, do first)** A dedicated storage account for audit only + a SAS credential for the service scoped to *Add-only* on the table (Table SAS supports `a` (add) without update/delete). Keep the account key in a break-glass vault, not in the cluster.
   - **(stronger)** A scheduled export job (daily) that writes the day's partition range as JSON to a Blob container with a time-based immutability policy (WORM) — then even account-key holders cannot alter history after export.
   - **(optional, evidence-grade)** Hash chaining: store `prevHash`/`entryHash` per entity or per-minute Merkle roots in the WORM blob. Only do this after the two items above; it is the least urgent.
7. 🟠 **No retention/lifecycle policy.** Exam audit data contains behavioral data and (in `attributes.response`) full answer content (`apps/response-api/src/index.ts:368-374`). There is no retention job, no documented retention period, and immutability makes GDPR erasure requests structurally awkward. Decide the retention period with the legal/records office (UZH exam records rules), document it in the PR, and implement retention as "delete whole daily table/blob after N years" rather than per-entity deletes (per-entity deletes contradict finding 6). Subjects are pseudonymous IDs (`participant:<id>`) — keep it that way and never log raw emails (currently respected via hashes).

### C. Coverage gaps (assessment-mode actions with no audit trail)

8. 🔴 **Point/grade corrections are not audited.** `correctAssessmentPointsInstance` (`packages/graphql/src/services/courses.ts:1016`) and `correctAssessmentPointsLiveQuiz` (`courses.ts:1386`) have zero audit emissions (`grep -c auditClient courses.ts` → 0), and `SYSTEM_RESPONSE_MODIFIED` / `SYSTEM_RESPONSE_DELETED` are declared but never emitted. Post-hoc grade changes are exactly what an exam audit log must capture. This is the single most important coverage gap.
9. 🟠 **Participant password-login success is not audited.** `accounts.ts` emits `PARTICIPANT_LOGIN_FAILED` (lines 120, 137) but there is no `PARTICIPANT_LOGIN_SUCCESS` emission for the username/password path — the path exam seat accounts use. Lecturer (`USER_LOGIN_*`) events are also still TODO.
10. 🟠 **`SYSTEM_RESPONSE_PROCESSED` never emitted.** The assessment processor logs `RECEIVED` on entry (`apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts:52-63`) and `DUPLICATE` (line 418), but the successful-persistence outcome is not logged — so the trail proves a response arrived, not that it was counted. Emit `PROCESSED` (with the same `correlationId`) after the Redis/DB write succeeds.
11. 🟡 Declared-but-unimplemented actions to either implement or delete from the enum so the catalog reflects reality: `USER_SESSION_EXPIRED`, `PARTICIPANT_COURSE_JOIN_*`, `PARTICIPANT_RESPONSE_SAVED/FAILED/VALIDATION_ERROR`, `MULTIPLE_TABS_DETECTED`, `BROWSER_FOCUS_LOST`, `IP_LOCATION_CHANGE` (all marked TODO in `packages/types/src/index.ts`). The practice-quiz emissions in `stacks.ts` are commented out deliberately (assessment-first) — fine, but say so in a code comment rather than dead code blocks (`packages/graphql/src/services/stacks.ts:2622-2954`).

### D. Reliability of delivery

12. 🟠 **Backend emissions in `liveQuizzes.ts` and `accounts.ts` are awaited inline and dropped on failure.** `ctx.auditClient.log(...)` is `await`ed inside lecturer mutations (e.g. `USER_START_QUIZ` at `liveQuizzes.ts:876`, `USER_END_QUIZ` at `:1998`) and participant auth flows. Two consequences: (a) if the audit service is down, each call adds up to ~10.5s latency (2 attempts × 5s timeout + 500ms; `packages/util/src/audit.ts:63-108`) to user-facing mutations; (b) after the retry the event is gone (`console.error` only). Meanwhile three call sites already use the durable Hatchet path (`liveQuizzes.ts:2675,2750,2822`). **Standardize: all backend emissions go through `ctx.hatchet.events.push('create-audit-log-entry', …)`** — durable, retried, non-blocking. Keep the direct `AuditClient` only for the Hatchet worker itself and for scripts.
13. 🟡 In-memory rate limiter (`apps/audit/src/utils/rate-limit.ts`) is per-replica; with 2–10 autoscaled pods the effective public limit is 100×N/min and resets on restart. Fine for abuse-prevention as intended, but don't treat it as a security control; note it in the code.
14. 🟡 `AuditClient` constructor throws when `AUDIT_SERVICE_URL`/`AUDIT_TOKEN` are unset even when `enabled: false` (`packages/util/src/audit.ts:29-43`), and the `!this.config.auditToken` warning at line 52 is dead code. Make disabled mode not require config; delete the dead branch.

### E. Branch/process state

15. 🔴 **138 commits behind `v3`, merge state CONFLICTING.** ~20 conflicting files, mostly `package.json`s, lockfile, `.env.example`s, `docker-compose.yml`, `turbo.json`, `deploy/env-*/values.yaml`, plus `packages/graphql/src/services/accounts.ts` and the two point-correction test files. The longer this waits, the worse it gets (the lockfile diff is already 13k lines).
16. 🔴 **CI red**: the `test` job "Test graphql package logic functionalities" fails (run 18130881704); `cypress-run-cloud`, SonarCloud quality gate, CodeQL, and GitGuardian checks also fail. GitGuardian likely trips on the example/test tokens in `apps/audit/.env.*` — verify in the dashboard and mark false positives or replace with obvious placeholders.
17. 🟡 Open code-scanning findings to resolve: externally-controlled format string in `apps/auth/src/lib/helpers.ts:114` and `apps/auth/src/pages/api/auth/[...nextauth].ts:173` (use structured logging args, never string interpolation of user input into the format string), k8s service-account automount (`deploy/charts/klicker-uzh-v2/templates/deployment-audit.yaml:40` — add `automountServiceAccountToken: false`), and the vitest/@vitest/ui major mismatch in `apps/audit/package.json:27`.

### F. Usefulness / UX of the log itself

18. 🟠 **There is no read path.** No query endpoint, no admin UI, no export script, no documented runbook. Today, answering "show me everything participant X did in exam Y" requires ad-hoc Table Storage queries someone has to invent during an incident. Production readiness requires at minimum a **documented, tested runbook** (see roadmap step 8) that reconstructs a per-participant timeline via `correlationId`/`subject` — a UI can come later.
19. 🟡 Tests are broad (~5,400 lines: API, integration, performance, scenario suites under `apps/audit/test/`) but use synthetic random events — the author's own comment on `apps/audit/test/api.test.ts:2` says a real end-to-end assessment scenario is missing. The Cypress assessment-mode run asserting audit entries (roadmap step 9) closes this.

---

## Production-readiness roadmap (ordered, junior-executable)

Work top to bottom; each step is a separate PR-able slice with its own verification. Steps 1–2 unblock everything else.

**1. Rebase onto `v3` and resolve conflicts.**
`git fetch origin && git merge origin/v3` on `audit-log`. Conflicts are listed in finding 15; for `pnpm-lock.yaml` take `v3` and re-run `pnpm install`; for `accounts.ts` keep both the new upstream logic and the audit emissions. Then `pnpm run check:all` and `pnpm run build`.
*Done when*: PR shows MERGEABLE, `pnpm run check:all` passes locally.

**2. Make CI green.**
`pnpm --filter @klicker-uzh/graphql test` locally (needs the test docker setup, see `packages/graphql/test/run-tests-local.sh`) and fix the failing tests. Check the GitGuardian dashboard for the flagged file — if it is a dummy token in `apps/audit/.env.example`/`.env.test`, replace with `changeme`-style placeholders. Fix the four code-scanning findings from finding 17.
*Done when*: all checks on the PR are green except (at most) known-flaky cypress-cloud.

**3. Fix public-endpoint auth for all participant login types (finding 1).**
In `apps/audit/src/routes/audit-public.ts`, look up the token as `next-auth.participant-session-token` ?? `participant_token` ?? `temporary_participant_token`, and extend `verifyParticipantToken` to accept the issuer/claim shape of each (compare how `packages/graphql` middleware validates `participant_token`). Add one integration test per cookie type in `apps/audit/test/public-endpoint.test.ts`.
*Done when*: tests prove all three cookie types produce stored events with the correct `subject`.

**4. Server-side timestamp + eventId on the public path (findings 2, 3).**
In `audit-public.ts`, add `timestamp` and `eventId` to the destructured/ignored fields (like `subject`), keep the client value as `attributes.clientTimestamp`. Update tests.
*Done when*: a posted event with `timestamp: 1234` is stored under a current-time partition with `attributes.clientTimestamp` preserved.

**5. Audit the correction paths (finding 8) and missing auth events (finding 9).**
In `courses.ts` `correctAssessmentPointsInstance`/`correctAssessmentPointsLiveQuiz`, push a `SYSTEM_RESPONSE_MODIFIED` event via `ctx.hatchet.events.push('create-audit-log-entry', …)` carrying: acting user (`user:<id>`), participant, instance/quiz resource, old value, new value, reason if available. Add `PARTICIPANT_LOGIN_SUCCESS` next to the existing FAILED emissions in `accounts.ts`. Emit `SYSTEM_RESPONSE_PROCESSED` in `assessmentProcessor.ts` after successful persistence (finding 10).
*Done when*: `packages/graphql/test/*PointCorrections.test.ts` assert the audit push was called with old/new values.

**6. Standardize backend delivery on Hatchet (finding 12).**
Replace every `await ctx.auditClient.log(…)` in `packages/graphql/src/services/*` with `ctx.hatchet.events.push('create-audit-log-entry', …)`. Grep to find them: `grep -rn "ctx.auditClient.log" packages/graphql/src`. The test helper already registers the task name (`packages/graphql/test/helpers.ts:138`).
*Done when*: no direct `auditClient.log` calls remain outside `packages/hatchet`, the worker, and scripts; mutation latency is independent of audit-service health (verify by stopping the audit container and timing `startSession`).

**7. Storage-level immutability (finding 6).**
Create a dedicated storage account for audit (per env). Generate a Table SAS with Add-only permission for the service; put the account key only in the ops vault. Update `AUDIT_TABLE_CONNECTION_STRING` secrets in `deploy/env-qa-v3` first, verify writes still work and that an `updateEntity`/`deleteEntity` attempt with the SAS fails, then roll to prod. Document the decision (and the export-to-WORM-blob follow-up) in `project/`.
*Done when*: the credential in the cluster cannot modify or delete existing rows (prove with a manual `az storage entity replace` attempt → 403).

**8. Retention + access runbook (findings 7, 18).**
Write `project/RUNBOOK-audit-queries.md`: how to authenticate (read-only SAS), how to list all events for `subject = participant:<id>` in a time range, how to follow a `correlationId` across public/internal/worker scopes, expected actions per exam phase. Agree retention with the records office; implement as a scheduled cleanup of expired daily partitions (or table-per-semester and drop whole tables).
*Done when*: a colleague who has never seen the system reconstructs a test participant's exam timeline from the runbook alone.

**9. End-to-end assessment scenario test (finding 19).**
Extend the Cypress assessment-mode suite: run a mini live quiz in assessment mode (lecturer starts quiz, student joins with a temporary account, answers, submits; lecturer corrects points), then assert against Azurite that the expected sequence exists (`USER_START_QUIZ` → `PARTICIPANT_JOIN_QUIZ` → … → `SYSTEM_RESPONSE_PROCESSED` → `SYSTEM_RESPONSE_MODIFIED`). The `azure-table-helper.ts` in `apps/audit/test/utils` already has the query plumbing to copy.
*Done when*: the scenario runs in CI and fails if any expected event goes missing.

**10. Ops: alerting + dashboards.**
Expose the metrics endpoint to Prometheus (the author sketched this in the PR comments on `audit-private.ts:26`), alert on `writeErrorsTotal` rate > 0 and on absence-of-events during an active assessment window (dead-man switch — silence during an exam is itself an incident). Add the audit service to the existing uptime monitoring.
*Done when*: killing the audit pod during a QA exam-drill fires an alert.

Defer (tracked in `project/plans_future/`): durable client-side queue (covered by PR #4946's fallback TODO), hash chaining / WORM export, per-service JWT auth, lecturer `USER_LOGIN_*` events via the auth app.
