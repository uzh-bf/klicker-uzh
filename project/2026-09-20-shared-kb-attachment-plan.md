# Durable shared knowledge-base attachments

## Approval summary

Course knowledge-base changes currently overwrite operator-added Doc Query scopes.
An additional shared corpus must remain available when a lecturer replaces,
detaches or deletes a course KB. Different chatbots may retain different private
course KBs. Graph-enabled requests must validate that same authorized scope and
fall back to document retrieval when no compatible graph exists.

Use explicit `shared_kb_ids` metadata in existing MCP configuration parameters.
The effective `kb_id` or `kb_ids` is the union of current course bindings and
operator-owned shared grants. Never infer a grant from arbitrary legacy scope
extras. Generic application code contains no FinanceWiki-specific identity.
Existing receipt-based rollback keeps its exact-state refusal; deliberate legacy
adoption and fresh shared removal use separately recorded operations.

Approval mode: executable batch, continuing the user's approved remaining-work
plan and explicit `v3-ai` target. Execution mode: solo; main owns implementation,
verification, simplification and final self-review. Source changes, focused checks,
commits, ordinary branch pushes and a draft PR are authorized. Merge, deployment,
live data changes and selection of a chatbot cohort remain separate.

Completion of this source package requires lifecycle, scope isolation and operator
receipt tests, applicable package checks and draft delivery. It does not establish
that a corpus was accepted, ingested or attached in a live environment.

## Execution details

Baseline: `origin/v3-ai` at `09bdd4f414058af3b3e462f8b1603e0ff55b1f9d`, fetched
2026-09-20. Task branch: `fix/financewiki-shared-attachment`. Task checkout:
`trees/financewiki-shared-attachment`. The primary checkout has unrelated files
and is preserved. Target selection follows the explicit user approval rather
than the repository's usual `v3` feature target.

1. Add a pure shared-scope contract in the existing util package, consumed by
   GraphQL lifecycle functions, chat scope validation and operator/seed writers.
   Bound canonical UUID sets, require grants to be included in effective scope,
   and reject inconsistent enabled mode grants. Keep legacy configurations
   without shared metadata readable. Empty unions disable the configuration.
2. Preserve grants in course attach/replace/detach/delete under the existing
   chatbot transaction locks. Recompute every affected mode from active course
   bindings and explicit grants. Provisioning/rollback and synthetic seeding
   preserve those grants or refuse an unsafe overwrite.
3. Validate graph requests against current active MCP configuration as well as
   participant/course authorization. Require the explicit course/shared union
   to equal the requested scope. Mixed or shared-only scopes use documents;
   graph hints remain restricted to the one compatible course graph.
4. Extend the existing FinanceWiki operator's all-mode CAS and receipt machinery
   for explicit grants, legacy adoption and current-state shared removal. Compare
   course scopes within each chatbot, not across different chatbots. Preserve
   version-one receipt readability and stale rollback refusal.
5. Run focused tests, inspect the complete diff for simplification and correctness,
   and deliver one draft PR. Record remaining live acceptance gates separately.

## Verification portfolio

| Risk | Obligation and primary seam |
| --- | --- |
| Course lifecycle drops shared access or retains detached private access | Extend GraphQL knowledge service tests for replace, detach, delete and shared-only state. |
| Shared grants broaden or drift between modes | Extend chat scope tests for malformed metadata, inconsistent modes and unauthorized IDs. |
| Graph validation rejects shared scope or leaks a stale graph | Extend graph scope tests for mixed/shared-only retrieval, replacement and revocation. |
| Operator overwrites another account's course KB or stale state | Extend attachment tests for distinct course scopes, adoption, removal after course changes and receipt recovery/CAS failures. |
| Secondary writers erase grants | Extend provisioning and seed behavior tests; stale restore must fail closed. |

Use repository-pinned tools in the task container. GraphQL tests require the
disposable task database. No financial corpus or real account identifiers belong
in fixtures or public Git history. These changes have no visual UI; any required
browser-only verification must identify the precise interaction it proves.

## Progress

- Implemented the shared-scope helper and its GraphQL, chat and operator callers.
  Course lifecycle operations recompute every enabled mode under transaction
  locks. Provisioning refuses shared grants; stale provisioning rollback also
  refuses newly added grants. Fixture seeding preserves operator-owned scope.
- Operator manifests retain version one and add explicit adoption/removal;
  version-two receipts carry the operation. Version-one receipt recovery and
  rollback retain their original semantics. Per-chatbot consistency permits
  different course scopes and mode sets across the selected cohort. Removal
  preserves disabled modes and disables empty scopes.
- Focused verification: 72 GraphQL lifecycle tests, 40 chat scope/graph tests,
  33 operator/CLI tests, 28 provisioning unit tests, 11 real-database provisioning
  tests and 7 seed tests passed. The integration suite required the guarded
  empty disposable test database rather than the runtime's preseeded KB server.
  No live corpus, accounts or cluster were used.
- Simplification and final self-review covered authorization, mode consistency,
  lifecycle locking, receipt compatibility, stale rollback and disabled scopes.
  Review corrected disabled-mode reactivation during removal. Type checking
  found and corrected a missing JSON-object annotation. Complete split host/container repository
  checks passed, followed by all 27 production build tasks. Exact-head forge
  checks are pending. The tested implementation is `b4e6cb458c`; subsequent
  progress edits change documentation only.
- The first all-in-container check stopped at host-only Playwright launcher
  tests. Verification now uses the repository's split host/container hook.
  Dependency definitions and lockfiles are unchanged. Opengrep's baseline scan
  ran 210 rules over 17 changed files and reported zero findings; four ignored
  files were outside its coverage.
- One cohesive source package is retained: the shared grant contract requires
  lifecycle writers, request validation and the existing operator to agree.
  A partial rollout would lose grants or reject legitimate shared scopes. The
  package changes 703 substantive lines (additions plus deletions, excluding
  tests and documentation), including the new shared helper. It has no migration
  or external dependency. Tests cover distinct risky
  behaviors in the seams identified above; they do not pin documentation or seed
  prose. Screenshots and browser automation do not apply: the changes are server
  scope calculations and transactional writes, with no changed browser contract.
- Exact runtime: `trees/financewiki-shared-attachment`, DevPod
  `fix-financewiki-shared-attachmen`, profile `manage`. After the full build,
  `devrouter stop` completed. Fresh Devsy workspace status reported `Stopped`,
  its source path matched this checkout, and devrouter listed zero exact routes.
  Worktree and runtime data were retained.
- Delivery refresh found `origin/v3-ai` at `a3d1181c58`, five commits ahead of
  the tested baseline. None overlap package files and `git merge-tree` succeeded
  without conflicts; no integration was needed. Source commits passed staged
  Gitleaks and personal-data inspection. The host hooks were replaced with their
  split host/container checks and full container build.
- Corpus acceptance, environment rollout and live cross-account retrieval remain
  separate pending steps. Source tests do not establish live availability.

### Integration after draft publication

The first 20-minute GitHub watch ended with replacement runs still queued or
running. Earlier jobs were cancelled during the description-triggered rerun;
their cancelled conclusions are not assertion failures. Dependency Review,
Gitleaks, CodeQL and the lecturer-MCP suite passed; broader hosted proof remains
unresolved. The watcher exited and no local monitor remains for that attempt.

The final PR check found a new upstream conflict after `v3-ai` advanced to
`a4960ba1bd`. Integration is needed to restore readiness. The only textual
conflict is the util build input list: preserve both the shared-scope module
and upstream's participant-data-use module. The KB service and tests merged
automatically with upstream's feature-flag admission changes and require renewed
verification. Both util entries are preserved. The integrated source passed all
191 focused tests and all 42 type-check/dependency-build tasks. Upstream introduced
a participant-data-use subpath import without its package export; the integration
adds that export. The schema generator also removes an upstream trailing newline;
its canonical output is retained without any schema semantic change.

The full staged-file formatting hook stopped on unchanged upstream
`docs/auth-model.md`. That file is identical to the target. All files in the
actual PR delta pass their configured formatters. Remaining repository checks
and all 27 production build tasks passed. This integration merges upstream into the
task branch; it does not merge or deploy the source package.

The local pre-tool data-hygiene gate initially rejected the integration commit
because inherited target files matched credential heuristics. All ten flagged
files are byte-identical to `origin/v3-ai`; staged Gitleaks reported no leaks.
The user explicitly approved `AGENTS_SKIP_DATA_HYGIENE=1` for this integration
commit. The approved sequence is commit, ordinary task-branch push and exact-head
CI verification. A fresh fetch confirmed the integrated target remains
`a4960ba1bd`. Merge into the target and deployment remain separately gated.

After the final build and formatting check, the exact task runtime was stopped.
Fresh Devsy status reported `Stopped`, the provider source path matched this
checkout, and devrouter listed zero exact routes. Runtime data was retained.

### Automated review follow-up

Integration commit `53a58ff8dd` is pushed and GitHub confirmed the draft is
mergeable against `v3-ai`. Automated feedback identified duplicated scope
constants and nested scope construction. The two-file follow-up exports the
existing UUID pattern and 32-ID bound from the shared module, reuses them in
chat validation, and constructs singleton/multiple/empty scope explicitly.
Existing normalization and error behavior are unchanged. All 112 affected
lifecycle and chat tests passed; the other 79 package tests retain their
integrated-source evidence. No new tests are needed for this simplification.
All split host/container repository checks and all 27 production build tasks
passed. Final self-review found no further changes needed. The follow-up has no
new dependency, migration, or browser-only behavior. Hosted checks remain pending.

### Target consent-hold test compatibility

Hosted verification on `2aa065caa3` found four GraphQL assertions and two
Playwright cases that still expect analytics access or feature-flag rejection.
The integrated target deliberately returns unavailable analytics before either
feature evaluation or data access until consent-aware processing is released.
This is confirmed by `isLearningAnalyticsEnabled` and the participant-account
contract in `docs/auth-model.md`. No application behavior is changed.

The four service cases now require null with flags enabled and disabled and
assert no feature or preference lookup. The two browser cases require a
successful persisted GraphQL response with an explicitly null analytics field.
Their test count remains two; obsolete enabled/forbidden polling is removed.
All eight focused feature-access service tests passed. The complete local
browser file passed 20 cases; the two repaired cases cannot reach their assertions
because the local runtime omits the backend feature-flag controller that CI
provides. Their actual browser proof remains pending in CI. The host launcher
installed its pinned browser dependencies after its interactive package prompt.
Runtime identity remains this task checkout, with profile `manage,pwa`.

All split host/container repository checks passed after the test correction.
The 27-task production build from `2aa065caa3` remains valid because this
follow-up changes only tests and documentation. Final self-review verified the
null GraphQL field contract and the absence of a data-access or policy bypass.
The task runtime is stopped again, confirmed by exact-source Devsy status and
zero devrouter routes. The old-head local CI watcher was stopped before pushing
the correction; hosted jobs were left to GitHub's normal concurrency handling.

### Upstream export fix integration

After the test correction was pushed as `4266fc6d6e`, `v3-ai` advanced to
`4be34ed26d` with its canonical `participant-account-data-use` export and updated
PWA imports. This created a package-map conflict. The integration retains that
upstream public path and our `kb-scope` export, removing the superseded temporary
`dist/participantAccountDataUse` alias. No source caller still uses the removed
alias. The upstream import changes are unchanged against the new target and
add no UI behavior to this PR. All seven package-export tests, split repository checks and all 27 production
build tasks passed on the integrated source. Existing KB and consent-hold
evidence remains applicable; no KB or analytics service logic changed. The
current net production/config/generated delta is 716 added/deleted lines,
excluding tests and documentation; two lines are the generated SDL newline.
The original cohesive-package rationale still applies.

The runtime was stopped after this build. Fresh exact-source Devsy status was
`Stopped` and devrouter listed zero routes. The merge contains upstream import
changes and the shared export together; no schema migration or dependency was
introduced. Final self-review found no unresolved local source issue. Hosted
verification of the corrected analytics cases remains pending.
