# Assessment Audit Logging PR Quarry Review

- **Date:** 2026-08-10
- **Binding design:**
  [assessment audit logging design, revision 7](./2026-08-04-assessment-audit-logging-design.md)
- **Reviewed PRs:**
  [#4872](https://github.com/uzh-bf/klicker-uzh/pull/4872) and
  [#4946](https://github.com/uzh-bf/klicker-uzh/pull/4946)
- **Purpose:** first work item of the Stack 1 implementation plan, as required
  by design decision 25

## Outcome

Treat both PRs as quarry, not as a base to merge, rebase, or cherry-pick.

The old work identifies useful integration points and test cases, but its
architecture conflicts with revision 7. Reusing isolated ideas while writing
against the current `v3` branch is lower risk than trying to remove the old
direct-HTTP, free-form-event, static-token, deployment, and unrelated branch
drift from either PR.

The closure decision for #4872 and #4946 should be made after the Stack 1 plan
gate. If they are closed, the closing comment should link this review, the
approved implementation plan, and the replacement stack.

## Reviewed revisions

| PR | Compared range | Size at review | Character |
| --- | --- | ---: | --- |
| #4872 | `f097b73c..acca7234` | 141 files, 70 commits | Standalone audit HTTP service, direct Azure Table writes, broad server/auth/UI integration, v2 deployment, and substantial unrelated drift |
| #4946 | `8dffe00e..dcf2ddec` | 9 files, 6 commits | PWA interaction capture and auth follow-up on an earlier #4872 base |

The ranges use the PR base and head SHAs reported by GitHub, rather than the
current head of the `audit-log` branch. This matters for #4946 because its base
is an older #4872 commit.

## Reuse decisions

| Quarry item | Decision | Destination | Reason or required change |
| --- | --- | --- | --- |
| Azure Table create calls and `409` replay handling | Translate | `packages/audit` Azure adapter | Keep create-only delivery and compare the stored hash on conflict. Replace the old free-form entity and direct service contract with the canonical revision 7 envelope, chunks, locator, and retention index. |
| Deterministic Table partition/row helpers | Translate | `packages/audit` Azure adapter tests | Keep determinism as a property. Replace the old minute bucket and single table mapping with assessment/day/shard evidence partitions, deterministic locator shards, and retention-index entries. |
| Azurite setup and Table integration helpers | Adapt | provider conformance tests and local development | Preserve the real protocol-level test path. Add binary chunk, partial-write recovery, locator/index, and conflict-integrity cases. RBAC must additionally be tested against real Azure because Azurite cannot prove Entra permissions. |
| API, scenario, retry, and performance test shapes | Adapt | `packages/audit` and worker integration tests | Rebuild fixtures from the revision 7 schemas and synthetic participant UUIDs. Do not carry the old event fixture vocabulary or raw request logging. |
| Health, metrics, rate-limit, and structured-logger skeletons | Pattern only | Stack 1 monitoring and later Stack 2 ingress | The operational concerns are valid. Stack 1 has no public audit HTTP service; the later independent ingress must use scoped asymmetric capture tokens, not the old shared token. |
| Response API assessment call sites | Reuse locations, rewrite behavior | `apps/response-api/src/index.ts` | Preserve the points where receipt, validation, Hatchet push, and response happen. Remove raw response/cookie logging, pre-Hatchet duplicate short-circuiting, swallowed Hatchet failure, and the separate audit command. Add stable `submissionId` and Hatchet receipt metadata to the existing assessment command. |
| Response-processor validation, duplicate, persistence, and scoring call sites | Reuse locations, rewrite transactions | `apps/hatchet-worker-response-processor` | These are the correct domain transitions. Materialize typed evidence into the shared outbox; persistence and scoring evidence must share the business transaction. |
| GraphQL LiveQuiz mutation call sites | Use as inventory, re-audit current code | `packages/graphql/src/services` | The old PR found useful lifecycle/configuration locations but has incomplete coverage and fire-and-forget events. Map every revision 7 event to a current mutation or worker and write critical evidence in the same Prisma transaction. |
| PWA `QuestionArea` interaction points | Split between stacks | `apps/frontend-pwa` | Selection/change capture belongs to Stack 2. The submit request structure is also quarry for Stack 1's stable `submissionId` and retry contract. Do not take the old direct uploader, object-effect dependency, route-key remount, preview truncation, or generic local persistence. |
| Transaction-aware collection in auth helpers | Do not use in v1 | none | Authentication audit is outside the assessment-only v1 coverage boundary. Assessment authorization context is recorded by the relevant assessment producer instead. |
| `AuditClient`, `useAuditClient`, static internal token, and direct HTTP event calls | Reject | none | They create a second delivery path, accept free-form strings, lack atomicity, and conflict with the provider-neutral outbox architecture. |
| Old Docker/Helm/release workflows | Reject as implementation | none | Revision 7 provisions Azure resources through `df-cloud` Pulumi and uses the current v3 chart. Stack 1 does not deploy `apps/audit`; Stack 2 later deploys `apps/audit-ingress`. |
| Old event enum and event catalogue | Reject as contract | none | It mixes assessment, auth, practice, generic security, and unfinished events. Revision 7 has an exhaustive stable assessment event registry with evidence class, criticality, and emission path. |
| Existing historical review and plan documents | Keep as historical evidence only | this review links them through PR history | They explain earlier decisions but are not implementation instructions. Revision 7 and the approved Stack 1 plan are binding. |

## Important current-`v3` finding

Current `v3` already contains a partial `create-audit-log-entry` Hatchet task and
free-form call sites in the response API, response processor, LiveQuiz service,
and point-correction paths. The task only logs its input; it does not deliver
evidence. Some callers emit raw request, response, cookie, or error content, and
some point-correction callers schedule it from inside a Prisma transaction.

The replacement stack must therefore migrate and remove this current stub; it
is not enough to ignore the old PRs. The unrelated existing Prisma
`AuditLogEntry` model records sharing/access history and must not be repurposed.
The new models use assessment-specific names.

## Complete #4872 diff coverage

The following mutually exclusive categories cover all 141 changed paths from
the PR base/head range. Counts sum to 141.

| Paths | Count | Disposition |
| --- | ---: | --- |
| `apps/audit/**` | 31 | Mine storage, API-test, metrics, rate-limit, and Azurite patterns; rewrite all production code for the shared outbox and typed contract. No Stack 1 HTTP audit service. |
| `apps/{response-api,hatchet-worker-response-processor,hatchet-worker-general}/**` | 8 | Reuse domain call-site inventory; replace all free-form/direct logging and preserve only the existing assessment Hatchet command. |
| `packages/graphql/src/services/{liveQuizzes,accounts,stacks}.ts` | 3 | Re-audit current LiveQuiz/assessment paths. Omit account/auth events. Replace asynchronous events with typed transactional outbox writes. |
| `packages/{hatchet,types,util,shared-components}/**` | 8 | Retain only useful type/test concepts. Replace the old client, hook, broad enum, and audit-specific Hatchet command. |
| `apps/frontend-pwa/**` | 7 | `QuestionArea` is Stack 2 quarry. Environment/plumbing changes are not carried forward automatically. |
| `apps/auth/**` | 5 | Omit from assessment v1. Raw authentication/cookie evidence is forbidden. |
| `apps/backend-docker/**` | 5 | Do not wire the old audit service. Add only configuration required by the approved stack in the appropriate future layer. |
| `.github/**` | 8 | Rebuild targeted tests in current workflows. Omit old service image/release jobs and unrelated Claude workflow drift. |
| `deploy/**` | 8 | Reject v2 audit deployment and direct Azure configuration. Use `df-cloud` plus the current v3 chart and workload identity. |
| `packages/graphql/**` excluding the three producer files and tests | 8 | Re-evaluate current context/package needs. Do not carry old scripts, invitation data, or environment plumbing wholesale. |
| `packages/graphql/test/**` | 24 | Do not port branch-drift edits. Add focused transaction, producer, and submission tests against current fixtures. |
| `project/**` | 12 | Historical quarry only. Do not make archived plans binding. |
| `packages/transactional/out/**` | 3 | Unrelated generated email output; omit. |
| Global/dev plumbing (`.gitignore`, `.versionrc.js`, root scripts, Olat test compose, `docker-compose.yml`, `pnpm-lock.yaml`, `turbo.json`, Traefik rules, wait script) | 11 | Recreate only dependencies and Azurite/dev routing actually required by a replacement layer. Omit release and unrelated branch drift. |

## Complete #4946 diff coverage

These categories cover all nine changed paths from the PR's actual base SHA.

| Paths | Count | Disposition |
| --- | ---: | --- |
| `apps/frontend-pwa/src/components/common/AssessmentErrorBoundary.tsx`, `QuestionArea.tsx`, `storageHelpers.ts`, and `pages/_app.tsx` | 4 | Keep answer-selection locations for Stack 2 and the submit request shape for Stack 1's stable submission identity/retry. Reject global error logging, route remounting, truncated answers, and generic local storage as evidence design. |
| `packages/shared-components/src/hooks/useAuditClient.ts` | 1 | Reject direct audit service hook. Stack 2 uses a dedicated browser outbox and batch protocol. |
| `apps/auth/src/lib/helpers.ts` | 1 | Omit; authentication audit is outside v1. |
| `.gitignore` and `pnpm-lock.yaml` | 2 | Recreate only when replacement dependencies/files require them. |
| `project/REVIEW-2026-07-07-audit-log-ui-pr4946.md` | 1 | Historical review input; its valid durability concerns are represented in revision 7. |

## Explicit omissions from the replacement Stack 1

- authentication, generic security, practice-quiz, and global frontend error
  audit events;
- direct browser-to-Table or browser-to-main-backend fallback paths;
- any static audit service token, storage connection string, or account key;
- a separate audit-specific Hatchet command for assessment submissions;
- free-form audit messages and raw request, response, cookie, token, PIN, stack
  trace, or unnormalized error storage;
- old v2 Helm charts, service release workflows, and archived plan structure;
- the old retention periods and direct-write cleanup assumptions;
- unrelated generated artifacts, invitation data, test-container churn, and
  branch drift.

These omissions are deliberate consequences of the approved scope and
architecture, not lost coverage.

## Replacement traceability requirement

Every revision 7 event name must have a row in the Layer 1 contract registry,
one delivery tier (`LAUNCH`, `FAST_FOLLOW`, or `STACK_2`), and exactly one
planned owner. Every `LAUNCH` event must have an implementation mapping before
the pilot. Deferred events cannot be emitted until their owner package lands.
The producer layers keep a checked-in coverage test that fails when a launch
event has no producer, has more than one emission path, or is still backed only
by the legacy `create-audit-log-entry` stub.
