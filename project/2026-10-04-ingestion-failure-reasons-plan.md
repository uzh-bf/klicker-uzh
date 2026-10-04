# Show safe ingestion failure reasons

## Approval summary

The user approved this source package on October4 after production diagnosis established that a safe parse-failure reason reaches the resource and attempt records but is absent from the lecturer views. Expose the existing field through both GraphQL queries and show localized reasons from the producer's fixed vocabulary. Unknown details retain the existing generic fallback. The accepted resource version remains visible and unchanged.

Approval covers implementation, configured reviews, local tests and browser verification with synthetic fixtures, ordinary commits and task-branch push, and a draft PR. Merge, release, deployment and production admission remain separate gates. This package ends at verified draft delivery or an explicit verification capability blocker; it does not close production readiness.

## Execution details

Repository: klicker-uzh. Target: v3-ai at `74e38ac1ca0034db20833b46970ebc5c5acd1569`. Branch: `fix/ingestion-failure-reasons`. Worktree: `trees/ingestion-failure-reasons`. Existing artifact root: `project/`. Full path because this package protects a cross-system failure-detail presentation contract. The existing deployment production-ingestion completion plan remains the roadmap index; this is its bounded consumer implementation package.

### Primitive impact

| Product primitive | Disposition | Contract and consumers |
| --- | --- | --- |
| KB resource | Reuse | Same ownership and active-version semantics; lecturer row still distinguishes failed desired content from accepted serving content. |
| Ingestion attempt | Reuse | Same status/history; failed attempts show a localized recognized reason, unknown detail stays generic. Both row and history use the same presentation. |

No new domain object, lifecycle, authorization, database or server schema change. Rendering arbitrary stored messages would expose internal content and is excluded. Fixed known producer sentences are matching keys, never displayed directly.

Verified producer contract: data-ingestion source `51b3f55b`, `modules/ingestion/src/ingestion/workflows/resource_upsert.py`, `_FAILURE_DETAILS`. The five distinct matching values are: `The fetched source did not match the version recorded when the source was added, so the import was rejected.`, `The source could not be fetched.`, `The source content could not be processed.`, `The source is larger than the supported size limit.`, and `The imported content could not be activated.`

### Owned files and sequence

Delegation map: one trusted executor owns the single end-to-end implementation slice; main owns runtime, integration, final proof and delivery. Separate question-quality and catalog owners remain unchanged.

1. Route executor. Create `packages/graphql/src/graphql/ops/QGetKbResourcesWithFailureDetail.graphql` and `QGetKbResourceIngestionRunsWithFailureDetail.graphql` from the existing query shapes, adding statusMessage to latestIngestionRun/history and assigning the corresponding new operation names. Retain both original operations byte-for-byte so their persisted hashes remain available during rolling deployment, as required by klicker-graphql-api. Wire the new documents/types in `packages/kb-management/src/components/KnowledgeBaseResourceList.tsx`, using import aliases where that avoids unrelated rewrites. Match the producer's five distinct curated reasons and translate them only for FAILED attempts, preserving existing error-code precedence and unknown/superseded fallback. Add paired keys in `packages/i18n/messages/en.ts` and `de.ts`. Extend `playwright/tests/Y-kb-management-ux.spec.ts` with synthetic reason/history coverage and update its operation-name mocks. These four existing and two named new source/test files are the complete write set. No new helper module or dependency. Acceptance: generated query types and checks agree; both old persisted queries remain registered; consequential browser cases pass. Commit one coherent source slice after checks.
2. Main verifies every hunk and runs the source slice's simplifier/risk review, then complete integrated final review. Run codegen and required repository checks/build in the exact container; run the focused KB Playwright spec from the host using `pnpm playwright:host -- <args>` against the routed container. Capture real before/after EN/DE desktop and compact states, inspect them and preserve ignored provenance. Use a synthetic local account; no production KB writes or upstream model requests.
3. Main pushes without force and opens one draft PR to v3-ai. Report exact source/CI/review/browser evidence and any explicit gaps. Attach the PR to this task. No readiness, merge or release action.

### Test portfolio

| Consequential risk | Obligation and primary seam |
| --- | --- |
| Saved reason disappears before reaching lecturer | Extend existing Playwright KB spec with known-reason coverage for both row and history using generated query documents; codegen/typecheck protects selected fields. |
| Unknown internal detail appears or status precedence changes | Extend same bounded browser scenario with synthetic unknown detail, specialized error-code precedence and non-failed/superseded cases; verify localized fallback and absence of unknown detail. |
| Failed replacement hides accepted content | Extend existing KB spec with a FAILED desired version and earlier active version; assert accepted serving presentation remains visible alongside the failure reason. Existing fixtures contain version values but no assertion protects this presentation. |
| Translation or compact display differs | No new automated test solely for localization/layout: real EN/DE desktop/compact captures and history interaction. Compare UI with translation entries, not fixed prose assertions. |

Use minimal test-owned synthetic fixtures. Match only exact known detail values; no substring classification. Preserve existing specialized dispatch/storage messages, status precedence and non-failed behavior. Tests check observable structured behavior and safe display, never pin incidental prose or production identities.

## Progress

Approved executable source package. Native planner round1 REVISE corrected the Playwright execution location and added explicit serving-version/status-precedence coverage; round2 APPROVED. Implementation next; exact-path manage runtime startup is running. No PR yet. Native production goal remains recorded blocked until the user's supported resume control changes it; this explicit source approval nevertheless authorizes the work above.
