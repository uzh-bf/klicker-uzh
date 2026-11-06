# Test hygiene: initial review and improvement plan

Status: proposal for review. This PR establishes a repeatable practice; it does
not remove, quarantine, or rewrite application tests, install a test framework,
or change existing CI selection/retry/coverage gates.

## Scope and evidence boundary

Reviewed on 2026-10-14 against `v3-ai` at
`be6ae67368b3249dc01c2284bd6a8d66812a062d`. The inventory and file/config review
are verified; application suites were not executed for this review. No service,
browser, database, or paid model was started. Expected savings and untested
coverage gaps below are hypotheses until the proposed proof is collected.

Read `AGENTS.md`, existing testing/e2e skills, runner configs, package scripts,
CI workflows and representative tests. Canonical skills already live under
`.agents/skills`; `.claude/skills` and `.github/skills` link there and `CLAUDE.md`
links to `AGENTS.md`. Add one tailored skill; do not duplicate tool-specific copies.

The connector associated [Playwright run 38541205923](https://github.com/uzh-bf/klicker-uzh/actions/runs/38541205923)
with the baseline revision. All eight hosted shard jobs completed successfully.
Two sampled logs showed shard 1: 96 passed; shard 7: 124 passed, 5 skipped.
This is a narrow execution sample, not a first-attempt success rate: the other
six logs, report JSON and retry traces were not audited. Other associated runs
were cancelled; cancellation is not test flakiness. No current top-flake ranking
or suite-wide rate is claimed.

## Inventory (file counts, not executed cases)

`node util/test-hygiene-inventory.mjs --json` on baseline tracked paths found
462 conventionally named test files: 394 other JS/TS, 49 active Playwright specs,
one retained/reference Playwright spec, 13 Python and five shell files.
The added inventory's own tests increase this count after staging; they contain
intentional indicator strings. Ad-hoc smoke/acceptance scripts and parameterized
case counts require runner/script inspection and are not counted here.

Largest named groups include Chat (128), GraphQL (95), active Playwright (49),
`.github/scripts` (42), util package (15), frontend Manage (12) and Prisma data
(12). This describes distribution, not relative quality or complete coverage.

Active Playwright text indicators:

| Indicator                       | Occurrences | Files | Interpretation                                           |
| ------------------------------- | ----------: | ----: | -------------------------------------------------------- |
| `waitForTimeout(...)`           |         583 |    27 | Synchronization review leads, not 583 proven flakes      |
| `.first()`, `.last()`, `.nth()` |         463 |    19 | Some legitimately express ordering; inspect scope        |
| `force: true`                   |          29 |    10 | Confirm browser actionability is not being bypassed      |
| Serial groups                   |          11 |    11 | Existing shared state; do not parallelize blindly        |
| `@ts-nocheck`                   |           9 |     9 | Focused typing candidates during touched-slice refactors |
| skip/fixme/todo syntax          |           7 |     3 | Includes justified locale/environment conditions         |
| class/CSS assertions            |           3 |     2 | A few direct candidates, not the dominant suite issue    |

The fixed waits concentrate in `O1-live-quiz-core.spec.ts` (112),
`X-review.spec.ts` (107), `P-microlearning.spec.ts` (72),
`Q-practice-quiz.spec.ts` (53) and `V-template.spec.ts` (47). These are
selection hints only. `playwright/timings.json` records historical ARM64 shard
weights (for example microlearning 724.074 s and practice quiz 646.394 s), not
fresh measurements, percentiles or the time this proposal will save.

### Runner and CI reality

- Playwright: Chromium normally; explicit Firefox/WebKit release matrix.
  One worker by default, one CI retry, retained failure traces/screenshots,
  JSON/JUnit/HTML reports. Whole-file sharding, guarded reset/seed and explicit
  profiles are important constraints. See `playwright/playwright.config.ts`,
  `playwright/profiles.json` and `playwright/runtime-contract.yml`.
- Vitest is predominantly Node pure-logic and server integration testing. GraphQL
  shares database state and uses a single fork. Chat also uses a single fork and
  restores stubbed globals. There is no React Testing Library/component-browser
  layer; static rendering exists and has a narrower proof boundary.
- `test-unit.yml` explicitly executes Chat, PWA, Auth (including built HTTP
  policy tests), grading, Markdown, util and the Prisma disposable guard.
  `test-graphql.yml` additionally invokes backend `test`, then the GraphQL suite;
  lecturer MCP and OLAT have dedicated workflows. `check.yml` explicitly runs
  many CI/runtime contract tests. Root `test:run` is not an all-tests inventory:
  packages expose different scripts, and some have only `test`.
- Candidate execution holes worth mapping: frontend Manage, feature-flags,
  knowledge-graph, export, word-cloud, student MCP and worker/package tests are
  not invoked by the named unit workflow. No dedicated student-MCP workflow
  exists. This is **not** a claim they all lack every indirect/manual check;
  map each package script to an actual CI step and run before expanding CI.
- Backend `test` targets `test/*.test.ts`, while `test:run` targets
  `src/**/*.test.ts`. The GraphQL workflow invokes only the former. Verify both
  scopes before calling that package fully tested.
- Existing `.github/scripts/playwright-flaky-summary.cjs` already reports
  passed-on-retry tests. Reuse it and its JSON input; do not build a second flake
  collector before checking its artifacts.

## Representative review and risk map

This is a sampled map, not an assertion that every flow is comprehensively covered.

| Outcome/risk                                                             | Existing evidence and judgment                                                                                                                                       | Proposed next proof                                                                                                                                                            |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lecturer creates/publishes; participant answers; grading/results persist | `playwright/tests/O1-live-quiz-core.spec.ts`, `O2-live-quiz-collaboration.spec.ts`; `packages/grading/test/index.test.ts` tests input/output scoring variants        | Keep cross-app journey. Review one wizard transition's fixed waits, then prove the intended next state and persisted result before expanding                                   |
| Review/batch action permission and state                                 | `playwright/tests/X-review.spec.ts` retains permission/action assertions within a long serial translated workflow                                                    | Distinguish necessary role matrix from repeated browser setup; preserve service authorization plus representative browser affordances                                          |
| Scoring correctness, deletion state and resize logic                     | `packages/grading/test/index.test.ts`, `apps/chat/test/thread-list-delete-confirm.test.ts`, `apps/frontend-manage/test/manageAssistantPanelSize.test.ts`             | Keep these pure-logic tests. Table-drive independently named boundary cases if diagnosis improves; do not discard UI-adjacent logic                                            |
| Knowledge source access and row isolation                                | `packages/graphql/test/knowledgeSourceGateway.test.ts` explicitly replaced a mocked `findFirst`-argument check with real-Postgres authz cases                        | Use as a model: negative owner/version/status cases plus allowed positive control. Retain external stream/request contracts                                                    |
| Token purpose, role, issuer and transport                                | `apps/mcp-student/test/auth.test.ts`; `apps/chat/test/chat-scoped-token-transport.test.ts`; `apps/auth/vitest.config.ts` unit/integration/built projects             | Preserve public refusal and no-side-effect assertions. Confirm student-MCP unit and smoke execution ownership; negative-only green is insufficient                             |
| Browser streaming, stop, focus, persistence                              | `playwright/tests/Y-chat.spec.ts` uses `pauseAfterTextChunk`, keyboard cancel, focus return, reload and stable row identity                                          | Keep deterministic pause and identity evidence where it protects visible flicker/remounts. Do not classify all DOM checks as fragile                                           |
| Course navigation and accessible action menus                            | `playwright/tests/N-course.spec.ts`: keyboard entry, Escape/focus return and accessible menu names mixed with `/bg-primary-100/` assertions                          | Keep navigation/focus. Ask whether exact primary-color class is a design contract; replace only after equivalent emphasis/visual evidence is agreed                            |
| Valid/safe Markdown embeds                                               | `packages/markdown/test/VideoEmbed.test.ts`: hostile URLs, supported embeds, surrounding text and valid parent/child markup; also exact `my-4 block` class fragments | Keep security and valid-markup assertions. Separate wrapper/class coupling from semantic output; pair with `playwright/tests/0-video-embed.spec.ts` for real layout/navigation |
| Server page authorization/wiring                                         | `apps/chat/test/chatbot-layout-access.test.tsx`: auth-before-fetch ordering plus `layout.props.children[0].props`                                                    | Keep access/order contract; investigate replacing child-index assertions with stable server output or the existing browser journey. Rendering is not interaction proof         |
| CI selection and database safety                                         | `.github/scripts/*test.cjs`, `packages/prisma/test/disposableDatabase.test.ts`, `playwright/global-setup.ts`                                                         | Keep structural/config checks where configuration is the real contract; do not delete them as source-text assertions without executable equivalent proof                       |

## Prioritized slices

No production defect is established by this static audit. Priorities reflect risk
and leverage, not a claim that the most numerous pattern is the most broken.

### P1. Establish evidence and reconcile execution coverage

Owner proposal: maintainer plus the affected feature owner. Confidence: high in
script/workflow mismatch, medium in actual missing execution until history is read.

- Map package `test`/`test:run` scripts to selectors and explicit CI steps, starting
  with student-MCP auth, feature flags and frontend-Manage logic. Record intentional
  manual-only checks separately. Check selectors for dependent package changes.
- For an agreed recent revision window, collect canonical plan, selected specs,
  JSON results, first-attempt outcomes, retries, duration and infrastructure failures.
  Link ClickUp tasks for confirmed defects; report the denominator and missing runs.
- Acceptance: every high-risk row has a known execution path or explicit owner-
  accepted gap; the top repair candidates have current failure evidence. Add CI
  only in a separate reviewed slice with its own selector/negative-path tests.

### P1. Pilot state-based Playwright synchronization

Owner proposal: activity-flow owner. Confidence: high in waits, medium in remedy
until a trace distinguishes missing readiness from a product race.

- Start with `O1-live-quiz-core.spec.ts`, test “Test adding and deleting blocks to
  a live quiz”. It sleeps after `next-or-submit` before display-name and block steps.
- Replace only confirmed readiness sleeps with the next field's visible/editable
  state or block-count/persisted outcome. Do not replace a sleep with a larger
  timeout or a broad network-idle wait. Preserve cancel/reopen behavior.
- Validate clean setup, relevant downstream journey, and a deliberate delayed
  transition/negative control; repeat without retries using the existing host
  launcher. Record actual costs and failures before selecting X/P/Q/V next.
- Split serial files only when each new file has complete isolated reset/seed and
  browser state; update `profiles.json` and relevance mapping together. No line cap.

### P2. Replace proven presentation coupling, preserving user behavior

Owner proposal: UI/Markdown owner and reviewer. Confidence: high in the named
assertions, medium that any is unnecessary without its original design/bug context.

- Review the three direct class assertions in N-course/Y-manage-assistant and
  Markdown's exact wrapper/class fragments against history and intended appearance.
- Separate safe-link/valid-DOM/accessibility contracts from incidental structure.
  Keep focus, loading, keyboard cancel, navigation, layout bounds and stream identity.
- Acceptance: each retired assertion has an agreed obsolete-contract rationale or
  a named replacement that fails under the relevant defect and passes restored.
  Use the existing browser layer; a new component framework needs a separate case.

### P2. Clarify mock and source-inspection boundaries

Owner proposal: service/Chat owner. Confidence: high that both good and narrow
contracts coexist; individual rewrites require inspection.

- Use `knowledgeSourceGateway.test.ts` as the positive example for query semantics.
  Check whether mocked calls protect exact provider requests, authorization order,
  non-execution or just mirror implementation. Do not ban mock assertions wholesale.
- Review `chatbot-layout-access.test.tsx` child-index coupling separately from its
  auth-before-fetch contract. Keep adapter/SSE tests such as
  `apps/chat/test/openai-chat-streaming.test.ts` as protocol compatibility evidence.
- Acceptance: wrong-owner/forbidden side effects and a valid positive path are
  distinguishable; service tests exercise real semantics when that is the risk.

### P2. Review conditional skips, typing and historical plans

Owner proposal: maintainer. Confidence: high in declarations, unknown runtime gaps.

- `A-login.spec.ts` skips MailHog-dependent delivery when unavailable; W4 skips
  duplicate locale combinations; Y-chat-knowledge-graph has an environment gate.
  Separate intended matrix reduction from coverage never executed on any route.
- Restore types in the nine `@ts-nocheck` specs only as their bounded slices are
  touched; do not mass-rename or undertake a generic typing rewrite first.
- `playwright/REFACTOR_PLAN.md` still describes `test_draft` promotion and 26
  Cypress counterparts. Treat it as historical; reconcile rather than following
  its “remove all duplication” goal blindly. The corrected hypotheses in
  `project/plans/PLAN-playwright-flakiness.md` are useful history, not today's queue.
- Acceptance: every intentional skip has scope and an actual proving route; any
  quarantine has approval, ClickUp owner, review date and continuing execution.

## Research: skills and best practices considered first

No external skill was installed or executed. Existing repo conventions win over
upstream recipes, and API examples must match pinned Playwright 1.58.x/Vitest 3.x.

| Candidate/source inspected                                                                                                                                                                                      | Decision                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Microsoft [playwright-cli test generation](https://github.com/microsoft/playwright-cli/blob/83368cb3bfc0b2bd8ff8af4ade8e0107461ed421/skills/playwright-cli/references/test-generation.md) (2026-09-28 revision) | Useful exploration and semantic locator companion, already present. Do not infer intended behavior from the current screen, enforce one test/file, bootstrap a new framework or upgrade to its newer version |
| Currents [playwright-best-practices](https://github.com/currents-dev/playwright-best-practices-skill/tree/283d5cbc5d11aac1abda058b16ad22c317d54dc0/playwright-best-practices) (v1.2, 2026-07-21 revision)       | Keep as selective reference already present. Broad mocking, skip and coverage recipes need repo-specific judgment; they are not cleanup authorization                                                        |
| Anthony Fu [Vitest skill](https://github.com/antfu/skills/blob/d02c48452d782231e4c32d7069cde731a4c7db42/skills/vitest/SKILL.md) (2026-09-28 revision; generated 2026-09-25 for Vitest 5.0.1)                    | Versioned API reference, not a hygiene procedure; inspected version targets newer Vitest. No additional install                                                                                              |
| Anthropic [webapp-testing](https://github.com/anthropics/skills/blob/ef740771ac901e03fbca3ce4e1c453a96010f30a/skills/webapp-testing/SKILL.md) (2025-12-01 file revision)                                        | Do not adopt for this task: Python/server helper, sleep/network-idle recipes and execution advice conflict with the repo's guarded launcher and reliability approach                                         |

The tailored procedure draws on primary documentation:

- [Playwright best practices](https://playwright.dev/docs/best-practices): test
  user-visible behavior, use resilient locators, isolation, web-first assertions
  and traces. “Use roles” is not a mass-rewrite order for deliberate `data-cy` IDs.
- [Vitest testing in practice](https://vitest.dev/guide/learn/testing-in-practice)
  and [writing tests with AI](https://vitest.dev/guide/learn/writing-tests-with-ai):
  explicit contracts, meaningful assertions, project context and sensible mocks.
- [Testing Library principles](https://testing-library.com/docs/guiding-principles/):
  user/DOM behavior over component instances. This is guidance, not a dependency
  recommendation for a repo with no component-test layer.
- [Playwright accessibility](https://playwright.dev/docs/accessibility-testing)
  and [WAI modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/):
  focus/keyboard are behavior; automated scans alone do not establish accessibility.
- [Stryker mutation states](https://stryker-mutator.io/docs/mutation-testing-elements/mutant-states-and-metrics/):
  executed/covered code is distinct from detected wrong behavior. A bounded negative
  control can supply useful evidence without adopting a mutation platform now.

Review provenance, license, version compatibility and executable scripts before
any future skill import/update. Do not adopt an automatic healer that changes
expectations or disables a failure to turn the suite green.

## This PR and verification

Included: one canonical skill with Codex metadata (shared via existing Claude and
GitHub links), durable behavior-first guide, this review/plan, a dependency-free
read-only inventory with Node tests, PR review prompts, CI execution of the new
inventory tests, and corrections to obsolete testing guidance. No recurring
workflow/automation is created. Existing test execution gates are retained.

Local validation and exact-head CI outcomes belong in the PR description so this
dated baseline does not pretend future results already exist. Full builds,
application tests and browser proof remain separate from these document/tooling
checks. Recommended ownership/cadence are in [test hygiene](../docs/test-hygiene.md).
