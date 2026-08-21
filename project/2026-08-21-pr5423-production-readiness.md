# Production readiness — PR #5423 (element batch sharing)

## Verdict

**ready-with-conditions for local handoff; not cleared for production promotion**

The refreshed local branch closes the confirmed authorization, permission-level,
recipient-validation, and Playwright-format defects from the earlier audit. The
feature still needs production-like database/browser evidence and operational
controls before deployment. No runtime, staging, production, or fresh remote CI
evidence was available because the approved plan withheld those actions.

## Reviewed artifact

| Item | Evidence |
| --- | --- |
| Branch | `rs/pr5423-element-batch-simplification` |
| Base | Fresh `origin/v3` at `df10f524ecf453fe2f43a3b08797a590f962c191` |
| Integrated head | `7f42dc5a6` |
| Source PR | [#5423](https://github.com/uzh-bf/klicker-uzh/pull/5423), unchanged remotely |
| Scope | `df10f524..7f42dc5a6`, 29 tracked paths |
| Runtime boundary | No local stack, browser, database, staging, cluster, or production access |

## Gate status

| Gate | Status | Evidence or boundary |
| --- | --- | --- |
| Planning review | complete | Approved project plan and corrections are committed |
| API/UI slice reviews | complete with fallbacks | Native specialist routes failed with provider errors; bounded read-only fallback reviews completed |
| Final package review | rerun pending | The review of `bddde399d` completed with findings; the current correction commits need the final pass |
| GraphQL typecheck/build/codegen | passed | Build has existing Rollup TypeScript and circular-dependency warnings |
| Manage typecheck/lint | passed | Lint has 26 pre-existing React-hook warnings and no errors |
| Playwright typecheck/listing | passed | 72 Chromium tests listed in the existing element-operations spec |
| Focused GraphQL Vitest | blocked | Collection stops because `HATCHET_CLIENT_TOKEN` is absent; no token was fabricated |
| Remote CI | not refreshed | Push is withheld; historical CodeQL failures were GitHub service/SARIF failures and Sonar remains tied to the old head |

## Resolved findings

| Area | Resolution | Verification |
| --- | --- | --- |
| Authorization | Raw IDs are capped at 50, only READ/WRITE/ADMIN are accepted, and every element transaction rechecks non-deleted state plus caller ADMIN/OWNER permission. Group owner/admin/member access is also rechecked in the transaction. | GraphQL typecheck/build; focused tests are collection-blocked |
| Enumeration boundary | Target lookup now occurs only after a supplied non-deleted element with current caller ADMIN/OWNER access is found. Without one, the service returns uniform unavailable outcomes and does not reveal target or element existence. | GraphQL typecheck; focused tests are collection-blocked |
| Concurrency | Serializable per-element transactions retain bounded `P2034` retries and budget transaction wait plus timeout within the operation deadline. | Static inspection and typecheck; real PostgreSQL interleaving remains unproved |
| Direct sharing compatibility | Direct sharing keeps its prior post-commit invalidation error behavior; batch sharing uses the guarded invalidation path. | Regression test added; runtime collection blocked |
| Manage form | Recipient fields are marked touched when enabled, user/group updates are atomic, and the 50-element server limit is surfaced before Apply. | Manage typecheck/lint |
| Manage feedback and accessibility | Apply changes to a visible localized in-progress label while the modal is locked, and the sharing result table now has semantic Element and Sharing result headers. | Manage typecheck/lint; browser proof remains pending |
| Documentation | Tutorial and API wiki distinguish activity access from derived READ access on linked answer collections. Feature plans moved to `project/plans_wip/`; only the feature-specific `docs/log` entry was removed. | Prettier and `rg` path audit |
| Playwright | The journey is folded into `MA-elements-operations.spec.ts`, uses existing fixtures/helpers/cleanup, and keeps repository `.js` imports and naming. | Playwright typecheck and 72-test listing |

## Remaining conditions

| Severity | Condition | Required evidence or action |
| --- | --- | --- |
| High | Group targets recompute object-wide derived permissions for every element, with no group-size or fan-out work ceiling. | Measure the largest supported group and 50-element batch against production-like PostgreSQL/pod limits; add a cost ceiling or queue/chunk path before enablement if it exceeds the budget. |
| High | Deadline exhaustion and post-commit invalidation failures have no structured counter, durable retry, or reconciliation path. | Add low-cardinality completion/failure telemetry and a bounded reconciliation procedure, then prove alerting and recovery. |
| Medium | Target resolution is an ordinary Prisma query outside the 60-second processing budget, and request disconnect is not propagated as cancellation. | Add supported query/request cancellation or document a lower-layer timeout; verify stalled lookup and disconnect behavior. |
| Medium | A failed or ambiguous response leaves only a read-only result with Close; there is no sharing-only retry or result focus handoff. | Decide whether the preview can ship with this recovery UX; otherwise preserve form state and add retry/focus behavior. |
| Medium | Enabling sharing still uses the existing full user-group roster query although the card only needs ID, name, and member count. | Add a slim group-options operation or accept the cost with representative account-size evidence. |
| Advisory | `privatePreview` remains a Manage-only gate; the persisted GraphQL mutation is callable for an authorized caller. | Confirm that the flag is advisory. If it is a kill switch, enforce it server-side before rollout. |
| Release | Backend-first rollout, exact persisted-operation hash smoke, reverse rollback order, and fresh CI are not proven. | Run the required remote pipeline and staging smoke on the exact published commit before merge/deploy. |

## Not checked

- No local runtime or browser session was started. The approved plan explicitly
  withheld runtime startup, so the changed modal, loading behavior, responsive
  layout, keyboard flow, and real GraphQL result state remain unobserved.
- No database-backed test, largest-batch load, concurrent-request test,
  proxy-timeout test, disconnect test, invalidation-consumer recovery, backup,
  staging, rollout, rollback, cluster, or production check was performed.
- The focused Vitest suite fails during module collection solely because the
  environment lacks `HATCHET_CLIENT_TOKEN`; the token was not inspected or
  supplied.

## Handoff

Treat this branch as a locally verified implementation handoff, not a production
approval. The next authorized owner should run the final package review, then
obtain the capacity, cancellation, telemetry/reconciliation, browser, staging,
and fresh-CI evidence listed above before requesting merge or deployment.
