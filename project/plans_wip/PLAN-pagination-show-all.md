# Show all option for paginated management lists

## Goal

Offer an explicit `All` page-size option beside the existing 10, 20, and 50
options on the management lists where returning every filtered record is
supported and honest. Preserve the current default, filters, sorting, selection
behavior, and finite-page navigation.

## Non-goals

- Do not change the default page size or remove the 10, 20, or 50 options.
- Do not introduce a new domain entity, persistence model, permission, or
  gamification behavior. `All` is a presentation/query choice, not domain
  state.
- Do not change the assessment student-results table, which already supports
  `All` through its existing client-side selector.
- Do not silently expose `All` on verification records while that endpoint
  keeps its server-side 100-record cap.
- Do not broaden the first slice to every `DataTable` consumer unless the
  product requirement explicitly means every client-side table as well.

## Current map

| Surface | Current pagination | Contract and risk | Recommendation |
| --- | --- | --- | --- |
| Manage library (`/`) | Shared `Pagination`; server-side Elements query; 10/20/50; page size stored as `elements-page-size` | `GetUserElements` currently requires `numEntries` and `offset`; the service already maps omitted values to an unbounded Prisma `take`/`skip` | Include in first slice after making those GraphQL arguments optional and testing the unpaginated path |
| Manage Activities (`/activities`) | Shared `Pagination`; server-side Activities query; 10/20/50; page size stored as `activity-page-size` | `GetUserActivities` already accepts optional `numEntries` and `offset`; omitted values fetch all matching activities | Include in first slice |
| Assessment course results → verification-record modal | Shared `Pagination`; server-side records query; default page size 20; same 10/20/50 selector | `getCourseAssessmentReportRecords` clamps each request to at most 100 records, so `All` would be false for more than 100 records | Keep disabled in the first slice; revisit only with an explicit bounded/all contract |
| Assessment live-quiz and course student results | Client-side `DataTable`; selector already offers 10/15/30/`All` | Existing behavior already satisfies the request | Reuse as the precedent; no change |
| Other paginated `DataTable` consumers | Admin preview, three analytics tables, suspended-course leaderboard, and element evaluation table; client-side 10-row default with Previous/Next buttons but no page-size selector | They do not use the 50-option control and are a separate shared-component API problem | Track as a follow-up if “every paginated table” is required |

Evidence for the shared surfaces is in
`apps/frontend-manage/src/components/common/Pagination.tsx`,
`apps/frontend-manage/src/pages/index.tsx`,
`apps/frontend-manage/src/pages/activities.tsx`, and
`apps/frontend-manage/src/components/courses/CourseVerifiableCredentialsModal.tsx`.
The server-side cap is in
`packages/graphql/src/services/verification.ts:getCourseAssessmentReportRecords`.

## Product and primitive impact

| Existing product primitive | Disposition | Contract delta | Consumers |
| --- | --- | --- | --- |
| Filtered Element collection | Extend presentation/query policy | A lecturer can request all currently matching Elements; ownership, permissions, filtering, sorting, and batch-operation semantics stay unchanged | Manage library |
| Filtered Activity collection | Extend presentation/query policy | A lecturer can request all currently matching Activities; lifecycle, permissions, filtering, sorting, and selection semantics stay unchanged | Activities overview |
| Assessment report credential collection | Reuse without changing contract | Keep the existing bounded 100-record fetch until the endpoint has an honest all-records policy | Verification-record modal |
| Page-size preference | Reuse UI-local state | Add the `all` value to the existing list-specific preference; no server persistence or cross-user state | Manage list pages |

No new product primitive is needed. The action means “show every record in
the current filtered result,” not “load every record in the system.”

## Recommended behavior

- Label the option `All`/`Alle`, reusing the existing localized catalog label
  for consistency with assessment results unless product copy requires a more
  explicit `All entries` label.
- Selecting `All` resets the current page to 1, retains the active filters,
  search, and sorting, hides Previous/Next and numbered page links, and shows
  the existing result summary as `1 to N of N`.
- Switching back to 10, 20, or 50 also resets to page 1.
- For Activities, omit `numEntries` and `offset` when `All` is selected.
- For Elements, make `numEntries` and `offset` optional in the GraphQL field
  and operation, then omit them for `All`. This aligns Elements with the
  existing Activities contract instead of using a fake large limit or a
  client-side count-as-limit workaround.
- Keep the existing list-specific local-storage behavior unless performance
  evidence shows that persisting `All` causes unacceptable revisit loads. The
  default remains finite, while a previously selected `All` value is a
  remembered explicit preference rather than a new implicit default. Accept
  only `10`, `20`, `50`, or `all` from storage; malformed values fall back to
  `10`.
- Add `data-cy="pagination-page-size-all"` and cover the option in both
  English and German browser checks.

The main unresolved product guard is whether an unfiltered list may be
arbitrarily large. The implementation should measure a synthetic high-count
list before release. If that is not acceptable, choose one explicit policy:
hide/disable `All` above a defined threshold, require confirmation, or define
an honest bounded label such as `Up to 100`; do not silently truncate while
displaying `All`.

### Batch-processing interaction

`All` does not itself execute a batch operation. It only makes the complete
filtered result available for the existing explicit select-all action. With
200 matching records, the current UI can hold the selected objects and send
their IDs to the existing batch mutations. The GraphQL mutations and services
do not impose a 200-item limit.

The operation is not constant-cost: Element updates run sequentially and may
also update linked instances; Activity updates fetch each supported activity
type and update records sequentially in separate transactions. Permissions,
activity status, element state, and action-specific rules can reduce the
applicable count, and the UI already reports partial success.

Therefore, support 200 as an explicit acceptance target, not as an unverified
performance promise. Test 200 Elements and 200 eligible Activities with the
normal batch action, verify that the modal remains usable, the request
completes within the existing focused-test timeout, and the returned count is
reported accurately. If 200 records truncate, error, freeze the modal, or
exceed that timeout, stop without silently adding a cap or confirmation flow;
record the observed elapsed time and surface the product decision separately.
Include a heavier Element case with linked-instance updates when the fixture
is available.

## Layer footprint

- `apps/frontend-manage`: shared pagination control, Elements page, Activities
  page, page-size state/reset logic, and browser selectors.
- `packages/graphql`: optional `userElements` pagination arguments, service
  typing, GraphQL operation, generated schema/client artifacts, and focused
  service coverage.
- `packages/i18n`: likely no new keys if the existing `All`/`Alle` label is
  reused; otherwise add the English and German pair in `manage.general`.
- `playwright`: focused management-list coverage for selecting `All`, filtered
  result counts, switching back to 50, and preserving selection behavior.
- No Prisma schema, seed, Hatchet, async worker, auth, or gamification work.

## Implementation slices

1. **Contract and component seam** — define the finite-or-`all` page-size
   state, add the opt-in `All` item to the shared control, and make summary/
   navigation calculations safe for the `all` state. Keep verification records
   opted out.
2. **Elements API and UI** — make `userElements` pagination arguments
   optional, regenerate GraphQL artifacts, omit pagination for `All`, and
   verify filtering, sorting, page reset, and batch-selection behavior.
3. **Activities UI** — omit optional pagination arguments for `All`, verify the
   same state transitions and selection behavior, and preserve local-storage
   preferences.
4. **Verification and handoff** — run focused GraphQL tests, manage checks,
   browser proof in both locales and relevant viewports, the synthetic 200-item
   selection/batch proof, then run repository gates. Update the affected
   engineering-wiki pages, relevant skills, and dated log in the same
   implementation change.
5. **Follow-up, only if requested** — design a page-size API for the six
   client-side `DataTable` consumers rather than coupling their different
   rendering and data-loading semantics to the server-side control.

## Acceptance checks

- Elements and Activities show `All` beside 10/20/50.
- `All` returns exactly the current filtered result set; no hidden truncation
  or stale offset remains.
- The result summary, page navigation, selection, filter reset, sort changes,
  loading state, empty state, and error state remain coherent.
- With a synthetic 200-record result, explicit select-all selects 200 eligible
  records, the batch modal remains usable, and the server result is reported as
  full or eligibility-based partial success without silent truncation. Runtime
  failures after earlier per-record commits remain outside this slice's
  atomicity contract.
- Returning to 50 fetches one page and returns to page 1.
- Verification records do not claim to show all records while the 100-record
  backend cap remains.
- Existing assessment-results `All` behavior remains unchanged.
- The primary checkout remains untouched; the design plan and implementation
  remain isolated in the task worktree.

## Progress

- 2026-08-20: Refreshed `origin/v3`, inventoried shared and client-side
  pagination, confirmed the existing assessment-results `All` precedent, and
  recorded the server-side verification-record cap.
- 2026-08-20: Created the isolated design worktree from `origin/v3`; no
  application code changed.
- 2026-08-20: Planner review required a finite `10 | 20 | 50 | All` storage
  contract, explicit opt-in on the shared control, a bounded 200-record proof,
  and mandatory frontend, GraphQL, testing, and dated-log documentation.
- 2026-08-20: Implemented the shared opt-in `All` control for Elements and
  Activities, optional Elements GraphQL pagination arguments, regenerated
  artifacts, strict local-storage parsing, explicit batch-selection coverage,
  and the affected wiki and skill updates.
- 2026-08-20: GraphQL typecheck, frontend route type generation and typecheck,
  Playwright typecheck, and focused Elements pagination tests passed. Browser
  verification and the synthetic 200-record batch proof remain blocked because
  `devrouter ensure . --json` cannot determine the process identity for the
  workspace lifecycle lock in this environment.
