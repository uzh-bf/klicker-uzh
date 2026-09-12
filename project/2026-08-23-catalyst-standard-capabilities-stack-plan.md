# Standard activity formats and in-app Catalyst requests

## Goal

Make Practice Quizzes, Microlearning, and Group Activities standard KlickerUZH
capabilities for every lecturer account with the existing required login scope
and object permissions. Reposition Catalyst around paid capabilities such as AI
and learning analytics, and let a signed-in account owner request Catalyst from
the Manage support modal through the existing support email channel.

## Non-goals

- Do not migrate the Catalyst entitlement to GrowthBook or add the first active
  Catalyst feature flag. The current `user.catalyst` seam stays intact for a
  separate migration package.
- Do not remove `catalystInstitutional`, `catalystIndividual`, `catalystTier`,
  the GraphQL `catalyst` field, or the Pothos Catalyst auth scope.
- Do not change activity lifecycle rules, sharing, permissions, student
  participation, grading, scheduling, analytics, or activity data models.
- Do not create a Catalyst request table, status workflow, audit entity,
  telemetry event, Redis throttle, or other request persistence.
- Do not add an email provider, dependency, secret, infrastructure resource, or
  production configuration.
- Do not edit the external Microsoft Form. Public documentation stops directing
  signed-in users to that form when the in-app path exists.
- Do not touch the sibling-owned dirty primary checkout, its untracked
  `CONTEXT.md`, its ADR registry, or its in-progress ADR 0006 amendment.
- Do not open the stack for review, merge, deploy, send a live production
  request, change mailbox policy, delete branches, or remove the worktree.

## Execution contract

- **Execution owner:** This task remains the execution orchestrator. It owns
  integration, delegated slices, verification, reviews, progress updates,
  commits, and the authorized draft-stack delivery.
- **Approval decision:** One approval of this plan authorizes the named local
  workflow and draft publication. The authorization-boundary validation after
  Layer 1 remains the one conditional human checkpoint required by the stacked
  workflow.
- **Authority:** Reuse the task worktree; initialize the declared two-layer
  GitHub stack; edit the named scope; use current documentation before library
  code; start and stop the task Devcontainer through devrouter; use synthetic
  local fixtures and MailHog; run repository checks and browser verification;
  create scoped local commits; push only `rs/public-activity-formats` and
  `rs/catalyst-request-form` to `origin`; create or update their draft stacked
  PRs; and write their draft titles and bodies from verified evidence.
- **Withheld:** Opening either draft for review, merging, deployment, live or
  staging requests, infrastructure or secret changes, GrowthBook changes,
  editing the external Microsoft Form, mailbox-policy changes, destructive Git
  operations, and worktree or branch cleanup.
- **Terminal:** Both layers are independently green and reviewed, browser and
  screenshot evidence exists, the two draft PRs are published with correct
  stack metadata, and the Gate 3 review package is ready for the user's decision
  to open, revise, or leave the drafts.
- **Boundary owner:** self.
- **Pause:** Pause after Layer 1 for the required authorization-boundary
  validation. Also pause if GraphQL-to-tRPC PR #5132 becomes authoritative for
  Manage before the new API lands; a concurrent GrowthBook package starts
  changing this Catalyst seam; any full-access or object-permission check would
  be removed; email delivery needs persistence, a new provider, infrastructure,
  or a new recipient; the top layer exceeds about 500 human-authored lines or
  25 human-authored files; local browser/runtime proof cannot run; or the local
  and remote stack topologies diverge.

Mailbox ownership, allowed readers, legal basis, and retention are controller
decisions. Their confirmation blocks release or opening for review, but it does
not block synthetic local implementation or draft PR creation.

## Plan identity

- **Plan:**
  `project/2026-08-23-catalyst-standard-capabilities-stack-plan.md`
- **Repository:** `uzh-bf/klicker-uzh`
- **Worktree:** `trees/public-activities-catalyst-request`
- **Provider:** GitHub native stacked PRs, `gh-stack` v0.0.8
- **Target:** `v3`
- **Fresh base:** `origin/v3` at
  `ee5712399fcda479422a61b78004a1cb3b0636e9`, fetched 2026-08-23
- **Bottom branch:** `rs/public-activity-formats`
- **Top branch:** `rs/catalyst-request-form`, created only after the Layer 1
  foundation validation
- **PR IDs:** not created
- **Related work:** The independent response-example and Catalyst AI plans do
  not govern this package and are not reused.

The primary checkout was one commit ahead and 24 commits behind `origin/v3` and
contained unrelated modified and untracked files. It is not authoritative for
this package and remains untouched.

## Resolved product decisions

- Practice Quiz, Microlearning, and Group Activity are standard activity
  formats. Their entire current lecturer lifecycle loses only the Catalyst
  entitlement requirement.
- `FULL_ACCESS` remains required for the 22 lifecycle mutations. Existing
  `withPermission` checks remain unchanged for operations on existing objects.
- Existing Catalyst users experience no activity regression. Non-Catalyst and
  self-hosted lecturers gain the same authoring and management paths.
- Catalyst remains an independent entitlement seam for paid capabilities,
  including AI and learning analytics. A future GrowthBook migration must
  preserve this package's standard-activity contract.
- The request path is for the account owner because it asks for account-level
  paid access. Delegated `FULL_ACCESS`, `READ_ONLY`, and `SESSION_EXEC` logins do
  not see or pass the request action.
- The form accepts only institution and intended AI/learning-analytics use
  case. It displays the current account email for context but does not submit
  an email argument. The server resolves the current database email from
  `ctx.user.sub`.
- The existing support inbox `klicker@df.uzh.ch` is the fixed recipient. The
  account email is included in the message and used as `Reply-To` if the
  existing Nodemailer seam supports it without a provider change.
- Institution is trimmed and bounded to 2–160 characters. Use case is trimmed
  and bounded to 20–2000 characters. Pothos validates the API boundary and Yup
  gives matching immediate UI feedback.
- Email output contains escaped HTML and independent plain text. Subject and
  errors are fixed. No submitted text, account email, or composed body is
  written to application logs.
- A failed send keeps both form fields and shows an inline generic error. A
  successful send resets and closes the inline request panel. Awaited Formik
  submission state allows only one request in flight.
- No exactly-once promise is made. Without persistence, an ambiguous SMTP
  failure can deliver an email even when the client sees a failure.
- The current external request form remains a temporary Layer 1 fallback. Layer
  2 replaces its Catalyst-page links with instructions to use Manage support.
  Microsoft Forms links for separate AI pilot studies remain unchanged.

## Primitive impact

| Product primitive | Disposition | Contract delta | Affected consumers and compositions | Evidence |
| --- | --- | --- | --- | --- |
| `PracticeQuiz` | Extend policy | Standard full-access activity; no Catalyst entitlement | Manage creation/actions, GraphQL lifecycle, public tutorial | `mutation.ts`, `SuspendedCreationButtons.tsx`, Practice Quiz tutorial |
| `MicroLearning` | Extend policy | Standard full-access activity; no Catalyst entitlement | Manage creation/actions, GraphQL lifecycle, public tutorial | `mutation.ts`, `SuspendedCreationButtons.tsx`, Microlearning tutorial |
| `GroupActivity` | Extend policy | Standard full-access activity; no Catalyst entitlement | Manage creation/actions/grading, GraphQL lifecycle, public tutorial | `mutation.ts`, `SuspendedCreationButtons.tsx`, Group Activity tutorial |
| Catalyst entitlement | Narrow protected promise | Protects paid capabilities such as AI and learning analytics, not the three standard formats | User profile, future paid-capability gates, public Catalyst page | `builder.ts`, `schema/user.ts`, `apps/docs/src/pages/catalyst.tsx` |
| Catalyst request | Compose, do not create storage primitive | Account-owner identity + bounded form + support email; no request lifecycle in Klicker | Manage support modal, GraphQL mutation, support inbox | `SupportModal.tsx`, `services/email.ts`, `userScope` query |
| GrowthBook Catalyst flag | Defer | No active flag or consumer is added | Future entitlement migration | `docs/feature-flags.md`, open user direction |

## ADR gate

The standard-activity boundary passes the ADR gate: making formats broadly
available creates a user expectation that is hard to reverse, it surprises a
maintainer who sees the current Catalyst auth scope, and it chooses openness
over keeping these established formats inside the paid tier.

- Add ADR 0037, `standard-activity-formats`, recording the standard-format
  contract, retained login and object permissions, Catalyst's paid-capability
  role, the unchanged entitlement seam, and the deferred GrowthBook migration.
- ADR 0037 explicitly supersedes only the obsolete activity-entitlement
  statement in ADR 0006. It does not replace ADR 0006's public/private engine
  capability-floor decision.
- ADR 0037 is the next free number after checking active local branches; ADRs
  through 0036 are already claimed.
- Do not edit the sibling-owned dirty ADR 0006 or ADR registry. If that registry
  branch lands before publication, rebase and add the 0037 index/pointer on its
  current content. Otherwise, keep the conflict visible in the Gate 3 package.
- Re-open the ADR decision if standard formats gain paid quotas, the entitlement
  moves to a new identity model, or Catalyst availability and entitlement are
  deliberately unified.

The email form does not pass the ADR gate by itself. It composes existing
identity, support UI, and email delivery and can later gain workflow state
without invalidating this first iteration.

## Data protection by design and by default

The request contains personal data because it combines the signed-in email with
free text. The design applies the nine-principle walk as follows.

| Principle | Measure and evidence | Remaining controller decision or gap |
| --- | --- | --- |
| Transparency | Contextual form copy says what is sent, who receives it, why support uses it, where the reply goes, and not to include student or participant data | Link the applicable privacy notice if the existing support notice does not already cover requests |
| Lawfulness | User initiates a specific account-access request; processing is limited to evaluating and replying | Confirm the controller's existing legal basis before release |
| Fairness | Standard activity access is unaffected by requesting or declining Catalyst; no persuasive default or prefilled use case | None in application design |
| Purpose limitation | Message is used only for Catalyst access evaluation and response; no analytics, AI processing, product telemetry, or unrelated enrichment | Support operations must not repurpose mailbox content |
| Data minimisation | Reuse server-side account email; collect only institution and bounded use case; no name, phone, course roster, participant data, or request table | None in application design |
| Accuracy | Email comes from the current account record; fields are visible and editable before send; invalid or blank bounded values are rejected on server and client | Mailbox correction handling follows the existing support process |
| Storage limitation | Klicker stores no request record, cache, or Redis key; only the existing sent/received email copies remain | Confirm mailbox retention and deletion policy before release |
| Integrity and confidentiality | Account-owner auth, server-side identity, fixed recipient, transport security from existing mail configuration, bounded inputs, HTML escaping, and values-free errors/logs | Confirm support mailbox membership and access review |
| Accountability | ADR, wiki, tests, data-flow contract, browser evidence, and release-condition readback document the choices | Record the mailbox-policy confirmation in the PR before review opens |

The four Article 25 default dimensions are fixed as follows:

1. **Amount:** account email already held by Klicker, institution, and use case;
   every other field is absent.
2. **Extent:** validate, compose, and send one support email for the user's
   request; no scoring, analytics, enrichment, or third-party form submission.
3. **Storage period:** zero application storage; the existing support mailbox
   policy governs email copies and must be confirmed before release.
4. **Accessibility:** only a signed-in account owner can submit; only the fixed
   support mailbox readers receive the content; the request is not visible to
   other lecturers or participants.

## Skill routing

- `rs-product-primitives` fixed the standard-format, Catalyst-entitlement, and
  composed-request boundaries before API or UI design.
- `rs-data-protection-by-design` fixed minimization, purpose, zero application
  retention, owner access, notice copy, and the mailbox release conditions.
- `domain-modeling` requires ADR 0037 for the tier boundary.
- `rs-stacked-change` and `gh-stack` govern the two-layer topology and Gates 1,
  2, and 3.
- `rs-sliced-development-workflow` governs slices, commits, reviews, progress,
  and finish evidence.
- `klicker-graphql-api`, `klicker-frontend-ui`,
  `klicker-testing-verification`, `klicker-playwright-e2e`, and
  `klicker-wiki-maintenance` govern implementation and verification.
- `rs-prose` uses the direct humanizer fallback for English and German
  user-facing copy because Spiral is unavailable.
- `rs-local-runtime-lifecycle`, `devrouter`, and `agent-browser` govern the
  local runtime and mandatory UI verification once execution begins.
- Current Pothos validation, Nodemailer `Reply-To`, and Formik/Yup behavior are
  checked through Context7 before implementation. Existing repository patterns
  remain primary.
- `rs-mr-description-writer` writes both whole-layer draft PR descriptions
  after verified publication.

## Research

- **Question:** Where is Catalyst currently enforced?
  - **Subagent:** `explore` agent
    `01a02ee1-654b-7693-a0db-5eea092fb7a9`.
  - **Evidence:** 22 activity lifecycle mutations use
    `asUserWithCatalyst`; all three creation buttons are disabled and crowned
    for non-Catalyst users. No student/query/runtime Catalyst gate was found.
  - **Limitations:** Source-only mapping; implementation tests remain required.
  - **Local applicability:** Directly defines Layer 1's mutation matrix and UI
    scope.
- **Question:** What request path exists today?
  - **Subagent:** main browser inspection with `agent-browser`.
  - **Evidence:** The public Microsoft Form asks for institutional email,
    institution, and an open use case that still names the three formats as
    Catalyst features. Manage support has only external links and a direct
    email entry for existing Catalyst users.
  - **Limitations:** The external form is not controlled by this repository.
  - **Local applicability:** Replace signed-in request routing with a native
    form; keep fields narrower and resolve identity server-side.
- **Question:** Is GraphQL still authoritative for Manage?
  - **Subagent:** main forge readback.
  - **Evidence:** PR #5132 is open and unmerged. Current `v3` still serves the
    Manage GraphQL path.
  - **Limitations:** This can change during execution.
  - **Local applicability:** Implement GraphQL now; pause if #5132 lands first.
- **Question:** Can this use a native GitHub stack?
  - **Subagent:** main CLI readback.
  - **Evidence:** The stacks API returned 25 and `gh-stack` v0.0.8 is installed.
  - **Limitations:** Stack metadata still must be verified after every command.
  - **Local applicability:** Use the declared two-layer native stack.
- **External research:** No external product research is needed. Library API
  docs are deferred to the implementation step so they match the exact code
  seam and installed versions.

## Planning-stage specialist

- **Role:** `planner`, GPT-5.6 Sol at xhigh effort.
- **Agent:** `01a02ef0-5919-7eb3-bb88-57c641bacdf3`.
- **Report:**
  `project/_local/reviews/2026-08-23-catalyst-standard-capabilities-planner.md`.
- **Status:** `DONE_WITH_CONCERNS`.
- **Accepted:** two-layer topology; exact 22-mutation matrix; table-driven auth
  test; owner-only and no-persistence email contract; inline support form;
  mailbox and exactly-once caveats; Layer 1 foundation pause; both slice reviews
  and integrated final review.
- **Verified corrections:** GraphQL operations stay in the flat existing
  directory; ADR 0037 replaces the proposed 0009 because active branches claim
  0009–0036; sibling-owned `CONTEXT.md` and ADR 0006 remain untouched; the wiki
  maintenance rule still requires per-layer log files.

## Stack plan

```yaml
feature: catalyst-standard-capabilities
provider: github
base: v3
mode: guided

layers:
  - id: 01
    name: standard-activity-formats
    work_package: Make Practice Quiz, Microlearning, and Group Activity standard end-to-end capabilities.
    responsibility: Remove only Catalyst entitlement gates and align creation UI, tests, public docs, ADR, wiki, and GraphQL skill guidance.
    depends_on: v3
    reviewer: GraphQL authorization and activity-product maintainers
    attention: judgment-heavy
    reviewer_focus:
      - All 22 fields lose only Catalyst and retain FULL_ACCESS.
      - Every existing object permission remains unchanged.
      - Non-Catalyst lecturers can discover and open all three creation paths.
      - Catalyst and standard documentation matches the new contract.
    validation:
      - Focused 22-field GraphQL authorization test.
      - Existing activity-permission tests.
      - Chromium feature-access Playwright test.
      - GraphQL and Manage checks, docs build, check:all, and root build.
      - Agent-browser before/after evidence for all three creation paths.
    activation: complete
    risk: high
    size_signal: 280-380 human-authored lines / 16-19 files; one coherent package because backend authorization, creation affordances, tests, and tier documentation must agree at landing.

  - id: 02
    name: catalyst-request-form
    work_package: Let a non-Catalyst account owner send a minimized Catalyst request from Manage support.
    responsibility: Add the owner API, email composition, inline form, i18n, generated operations, tests, and request-channel docs without application persistence.
    depends_on: 01
    reviewer: GraphQL, privacy, support-workflow, and Manage frontend maintainers
    attention: judgment-heavy
    reviewer_focus:
      - Server identity and account-owner enforcement cannot be bypassed.
      - Free text is bounded, escaped, omitted from logs, and retained only in email.
      - Failure preserves values; success resets; one browser request is in flight.
      - Generated API artifacts and public request instructions are current.
    validation:
      - Focused Catalyst request GraphQL/service tests.
      - GraphQL code generation and generated-diff inspection.
      - Focused Chromium request-form Playwright test.
      - GraphQL and Manage checks, docs build, check:all, and root build.
      - Agent-browser owner, delegated, failure, sending, success, English, and German evidence using synthetic content and local MailHog.
    activation: complete
    risk: medium
    size_signal: 320-460 human-authored lines / 11-14 files plus five generated GraphQL outputs; keep one vertical package because API, form, errors, privacy copy, and docs jointly define the usable request capability; re-slice above 500 authored lines or 25 authored files.

follow_up_stacks:
  - Migrate Catalyst entitlement evaluation to GrowthBook while preserving standard activity access and server authorization.
  - Add durable request workflow state only if support needs status, assignment, deduplication, or auditable lifecycle management.
```

Both layers are judgment-heavy for different reasons. Generated GraphQL output
is mechanical and reported separately; it does not turn Layer 2 into a
mechanical review package.

## Test portfolio

| Risk or behavior | Existing evidence | Test obligation | Primary stable seam | Distinct realistic failure | Owning slice |
| --- | --- | --- | --- | --- | --- |
| Every activity lifecycle loses Catalyst, not only creation | Current source has 22 Catalyst-gated fields; lifecycle specs use Catalyst users | add new | Runtime GraphQL schema with a table of exact mutation names | One publish, grading, or delete field remains paid-only | S1 |
| Full-access and object permissions remain | `activityPermissions.test.ts` and current `withPermission` wrappers | extend existing | GraphQL auth context plus representative inaccessible object | Removing Catalyst accidentally removes login scope or object authorization | S1 |
| Non-Catalyst creation UI exposes all formats | `B-feature-access.spec.ts` currently asserts the opposite | replace/consolidate | Existing feature-access Playwright spec | Backend is open but buttons stay disabled or crowned | S2 |
| Existing Catalyst identity seam remains | Current builder/user schema and login fixture coverage | none | Exact diff and package checks | GrowthBook or entitlement fields are coupled into this package | S1 |
| Public docs no longer sell established formats as Catalyst | Current Catalyst page and three tutorials claim Catalyst | none | Docusaurus build plus exact link/copy inspection | Users still see stale tier labels or external request instructions | S2 and S4 |
| Only account owners request Catalyst | Existing `asUserOwner` pattern and `userScope` query | add new | Request mutation and dedicated scope query | Delegated full-access or read-only account sends a paid-access request | S3 |
| Email identity and purpose are minimized | Existing email transport only | add new | Support service with mocked email sender and database user | Client supplies another email, body leaks extra profile data, or free text is logged | S3 |
| Validation, escaping, and failure are safe | Pothos validation and email boolean result patterns exist | add new | Service/GraphQL test with boundary and metacharacter cases | Header injection, invalid payload, or transport failure leaks content | S3 |
| Form state and one in-flight send are predictable | Existing Formik modal conventions | add new | Focused Playwright network count and failure/success states | Double click sends twice, failure clears values, or success leaves stale data | S4 |
| Persisted GraphQL operations are current | Existing codegen workflow | extend existing | `pnpm --filter @klicker-uzh/graphql generate` and clean generated diff | Production rejects the new operation hash | S3 |
| No application request record is created | No current request model | none | Prisma diff, repository diff, and service inspection | Scope expands into undocumented retention or workflow state | S3 |

## Delegation map

| Workstream | Slices | Execution owner | Starts after | Done when |
| --- | --- | --- | --- | --- |
| Activity authorization | S1 | main | Plan approval and plan commit | Exact 22-field matrix passes for non-Catalyst full access; read-only and object denials remain |
| Standard activity UI and documentation | S2 | `executor` | S1 contract is committed | Free account opens all three creation paths and tier docs/ADR/wiki/skill agree |
| Catalyst request backend | S3 | main | Layer 1 Gate 2 approval and top branch creation | Owner mutation, minimized email, failure contract, tests, and codegen pass |
| Catalyst request UI and documentation | S4 | `executor` | S3 API is committed | Owner-only inline form, i18n, state behavior, docs, and focused browser test pass |
| Integration and delivery | all slices | main | Each delegated result returns | Diffs are verified, per-layer reviews pass, full stack is green, and draft PR stack is read back correctly |

Delegated execution receives public source and synthetic fixtures only. The main
session retains authorization, personal-data, email, cross-layer, external
delivery, and final-readiness decisions.

## Plan slices

### S1 — Preserve authorization while standardizing all lifecycle mutations

- **Layer:** 01, `rs/public-activity-formats`.
- **Route:** main.
- **Execution-tier skip reason:** authorization and critical-path coupling.
- **Acceptance:** The runtime schema contains the exact 22 expected fields;
  each reaches a controlled downstream seam for a non-Catalyst `FULL_ACCESS`
  context; each rejects `READ_ONLY`; representative permission-wrapped fields
  still deny an unrelated object without executing the activity service.
- **Do:** Replace `asUserWithCatalyst + asUserFullAccess` with the existing
  full-access user gate on the five Practice Quiz, seven Microlearning, and ten
  Group Activity lifecycle mutations. Remove the now-unused mutation shorthand.
  Do not alter resolvers or `withPermission`. Add the focused table-driven test.
- **Files:** `packages/graphql/src/schema/mutation.ts`,
  `packages/graphql/test/activityFormatAuthorization.test.ts`, and only a
  verified existing helper when the test cannot use the current schema harness.
- **End-to-end path:** JWT role/scope and Catalyst claims → Pothos auth →
  unchanged object permission → unchanged lifecycle service.
- **Test portfolio rows:** exact lifecycle matrix; login scope/object
  permissions; unchanged Catalyst seam.
- **Check:** Focused new GraphQL test, existing activity permission tests,
  GraphQL check, and exact diff inspection proving every Catalyst removal and
  every retained permission.
- **Commit:** `feat(activities): make lifecycle authorization standard`.

### S2 — Expose standard creation paths and align the public contract

- **Layer:** 01, `rs/public-activity-formats`.
- **Route:** executor.
- **Acceptance:** A free account sees enabled, uncrowned buttons for Practice
  Quiz, Microlearning, and Group Activity and opens each creation wizard. The
  public Catalyst page, welcome page, and three tutorials describe them as
  standard. ADR 0037, GraphQL wiki guidance, the GraphQL skill, and the Layer 1
  wiki log record the new boundary.
- **Do:** Remove the creation-level Catalyst query, disabled props, crown
  treatment, tooltip, and obsolete translations where no remaining consumer
  exists. Rewrite the focused Playwright test. Move all three formats to the
  Standard list, position Catalyst around AI and learning analytics, remove
  `CatalystTitle` from their tutorials, and retain it for the chatbot. Keep the
  existing request form as the temporary public fallback until Layer 2. Add ADR
  0037 without touching sibling-owned ADR files.
- **Files:** activity creation components; English and German messages;
  `playwright/tests/B-feature-access.spec.ts`; Catalyst/welcome/tutorial docs;
  `docs/adr/0037-standard-activity-formats.md`;
  `docs/graphql-api-layer.md`; `.agents/skills/klicker-graphql-api/SKILL.md`;
  `docs/log/2026-08-23-standard-activity-formats.md`; synthetic screenshot
  evidence and its README.
- **End-to-end path:** free lecturer opens Manage → selects any of three
  standard formats → existing creation wizard opens; public docs describe the
  same tier contract.
- **Test portfolio rows:** standard creation UI; public docs; unchanged
  Catalyst seam.
- **Check:** Focused Chromium Playwright spec, Manage check, docs build, wiki
  validation, English/German copy inspection, agent-browser before/after
  screenshots, root `check:all`, and root build inside the task runtime.
- **Commit:** `feat(activities): expose standard creation formats`.
- **Layer review:** Commit the complete Layer 1 range, run one `simplifier` and
  one authorization/permission `slice-reviewer` in parallel, integrate accepted
  corrections, rerun checks, update Progress, then present the required Gate 2
  foundation validation. Do not create Layer 2 before that decision.

### S3 — Add the owner-only minimized Catalyst request API

- **Layer:** 02, `rs/catalyst-request-form`.
- **Route:** main.
- **Execution-tier skip reason:** personal-data, email, authorization, and API
  seam ownership.
- **Acceptance:** Account owner succeeds with bounded synthetic inputs; full,
  read-only, and session delegated logins are rejected; email always comes from
  the current database user; text is trimmed and safely encoded; failure returns
  a stable values-free error; no request state or submitted text is persisted or
  logged; generated operations are current.
- **Do:** Add the owner mutation and support service; extend the existing email
  function only with optional `replyTo` and values-free error metadata if
  needed; add a dedicated `userScope` query operation instead of changing the
  widely reused user-profile operation; add the request mutation operation;
  generate all tracked artifacts; add focused service/schema tests.
- **Files:** `packages/graphql/src/schema/mutation.ts`,
  `packages/graphql/src/services/support.ts`,
  `packages/graphql/src/services/email.ts`, flat
  `packages/graphql/src/graphql/ops/MRequestCatalystAccess.graphql`, flat
  `packages/graphql/src/graphql/ops/QGetCatalystRequestAccess.graphql`,
  `packages/graphql/test/catalystRequest.test.ts`, generated GraphQL outputs,
  and the GraphQL wiki/skill increments owned by this API.
- **End-to-end path:** account-owner session → Pothos owner auth → server user
  lookup → bounded message composition → existing SMTP transport → fixed support
  inbox → boolean success or stable GraphQL error.
- **Test portfolio rows:** owner auth; minimal identity; validation/escaping;
  values-free failure; codegen; no app persistence.
- **Check:** Context7 docs readback, focused Catalyst request tests, GraphQL
  generate, generated-diff inspection, GraphQL check/test/build, values-free log
  assertion, and no Prisma or environment-definition diff.
- **Commit:** `feat(catalyst): add access request mutation`.

### S4 — Add the in-app request form and retire the stale request route

- **Layer:** 02, `rs/catalyst-request-form`.
- **Route:** executor.
- **Acceptance:** Only a non-Catalyst account owner sees the request entry. The
  inline form explains the recipient, purpose, reply email, and personal-data
  warning. Validation is available in English and German. Failure preserves
  inputs; awaited submission permits one in-flight mutation; success resets and
  closes the request panel. Public Catalyst docs direct signed-in users to
  Manage support and contain no old Catalyst request-form link.
- **Do:** Add an inline `CatalystRequestForm` to the existing support modal,
  driven by the dedicated scope query and existing user Catalyst state. Preserve
  the direct mail link for existing Catalyst users. Add translations, focused
  Playwright coverage, public docs changes, the Layer 2 wiki log, and synthetic
  screenshot evidence. Do not nest a modal or add request state outside the
  component.
- **Files:** Manage common support components; English and German messages;
  `playwright/tests/B-catalyst-request.spec.ts`; Catalyst public page;
  `apps/docs/docs/getting_started/welcome.mdx` only where the final request
  instructions require it; narrow architecture/GraphQL/frontend wiki updates
  only for facts introduced by this flow;
  `docs/log/2026-08-23-catalyst-request.md`; synthetic screenshot evidence and
  README.
- **End-to-end path:** account owner opens support → request panel → client and
  server validation → owner mutation → local MailHog → success or recoverable
  error.
- **Test portfolio rows:** owner-only form; state and duplicate prevention;
  public request docs.
- **Check:** Focused Chromium Playwright test with one-mutation count; Manage
  check; docs build; wiki validation; agent-browser owner, delegated, sending,
  failure, success, English, German, desktop, and narrow viewport states using
  synthetic content; root `check:all`; root build.
- **Commit:** `feat(catalyst): add in-app access request form`.
- **Layer review:** Commit the complete Layer 2 range, run one `simplifier` and
  one privacy/security/error `slice-reviewer` in parallel, integrate accepted
  corrections, rerun checks, and update Progress.

## Integrated verification and delivery

1. Run the task runtime through `rs-local-runtime-lifecycle` and `devrouter`.
   All pnpm, Prisma, build, test, and Playwright commands run inside the exact
   task Devcontainer. Stop it after the final runtime-dependent check and verify
   it stopped.
2. At each layer tip run its focused tests, package checks, docs build,
   `pnpm run check:all`, and `pnpm run build`. Inspect generated and formatted
   diffs so unrelated rewrites do not enter either layer.
3. Run `agent-browser` with delegated local credentials and synthetic content.
   Capture before/after evidence for the three standard creation paths and the
   request flow across owner/delegated, failure/success, English/German, desktop,
   and narrow layouts. Never use Edu-ID or a live support inbox.
4. Validate the wiki with the repository command and one log file per layer.
   Re-read user-facing copy through the humanizer fallback. Inspect every
   screenshot and staged file for secrets and real personal data.
5. Run one integrated `final-reviewer` on the immutable complete stack after
   verification. Applicable lenses are correctness, plan compliance,
   authorization, privacy/security, architecture, and maintainability. Apply
   accepted corrections, rerun affected verification, and perform at most the
   configured correction rerun.
6. Initialize and verify the native stack non-interactively. Submit both layers
   as drafts with `gh stack submit --auto`. Use `rs-mr-description-writer` and
   `gh pr edit` for conventional titles and whole-layer descriptions. Read back
   `gh stack view --json`, each base/head SHA, draft state, diff statistics, and
   per-layer checks. Never use raw force push.
7. Present Gate 3 bottom-up with human-authored and generated deltas separated,
   CI and review state per layer, screenshot links, mailbox-policy status, plan
   deviations, and the decision: open for review, revise, or leave as drafts.

## Expected PR evidence

- Layer 1 before/after screenshots show the free account's three creation
  buttons changing from disabled Catalyst affordances to enabled standard
  affordances, plus each wizard open state.
- Layer 2 screenshots show the non-Catalyst account-owner request form in
  English and German, validation, sending, failure, success, and narrow layout;
  a delegated login proves the entry is absent.
- Focused GraphQL and Playwright output names the exact behavior and test count.
- Generated GraphQL line counts are separated from human-authored deltas.
- Data-hygiene readback states that only synthetic fixture content appears in
  tests and screenshots.
- The mailbox owner/access/legal-basis/retention confirmation is either recorded
  before opening for review or named as the explicit release blocker.

## Progress

- **Status:** planning complete; awaiting Gate 1 stack-plan approval.
- **Active slice:** none.
- **Completed:** fresh origin/v3 readback; primary/worktree audit; Catalyst gate
  and request-flow mapping; user decision for email delivery; product primitive
  and data-protection design; stack capability check; independent planner pass;
  clean task worktree creation; uncommitted plan.
- **Remaining:** approve and commit plan; initialize stack; S1; S2; Layer 1
  reviews and Gate 2; create top branch; S3; S4; Layer 2 reviews; integrated
  verification/final review; draft stack publication; Gate 3 package.
- **Verified:** Worktree `rs/public-activity-formats` equals
  `origin/v3` at `ee5712399fcda479422a61b78004a1cb3b0636e9`; GitHub stacks API
  works; `gh-stack` is v0.0.8; planner status is `DONE_WITH_CONCERNS`.
- **Planning review:**
  `project/_local/reviews/2026-08-23-catalyst-standard-capabilities-planner.md`.
- **Slice reviews:** pending approved implementation.
- **Integrated final:** pending.
- **Active children:** none.
- **Delivery:** required `draft_stack`; achieved `uncommitted_plan`.
- **Blockers:** Gate 1 approval. Mailbox-policy confirmation blocks opening for
  review/release, not draft implementation.
- **Next:** On approval, commit this plan alone as
  `docs(project): add Catalyst standard capabilities stack plan`, initialize the
  bottom stack branch, capture baseline UI evidence, and implement S1.
