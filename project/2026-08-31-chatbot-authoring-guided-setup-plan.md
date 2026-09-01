# Chatbot authoring guided setup plan

Date: 2026-08-31

Status: Final review passed; draft PR publication pending

Execution owner: This session is the package execution orchestrator.

Delivery layer: Proposed fourth stack layer `rs/chatbot-authoring-wizard`

Proposed PR: `enhance(manage): guide chatbot setup`, targeting
`rs/chatbot-publication-ui`

Historical context:
[2026-08-27 chatbot lecturer management MVP plan](./2026-08-27-chatbot-lecturer-management-mvp-plan.md)

## Goal

Replace the dense lecturer chatbot detail page with a guided setup and editor
workspace. Lecturers should see one task at a time while retaining every
existing creation, disclaimer, publication, model-policy, usage, and lifecycle
behavior.

The first release optimizes the path from a new draft to a publication request.
It does not expand the chatbot product contract.

## Current evidence and stack boundary

- Remote refs were refreshed on 2026-08-31.
- The primary roadmap checkout is `docs/chatbot-hitl-config-roadmap`, tracks
  `origin/v3`, and is 145 commits behind and 1 ahead. It contains unrelated
  user-owned changes and remains read-only for this package.
- The task worktree is `trees/chatbot-lecturer-management-mvp`. Its fourth-layer
  branch starts from `rs/chatbot-publication-ui` at
  `75c6e626c159fad0e55843fb6488e5d736764948`, has no configured upstream, and
  is 62 commits ahead and 6 behind current `origin/v3` because it is the top of
  an intentional stack.
- The locally modified historical plan remains user-owned, unstaged, and
  excluded from the fourth-layer PR.

The three existing PR heads are immutable inputs:

| Layer | Purpose | Exact head | Target |
| --- | --- | --- | --- |
| [#5593](https://github.com/uzh-bf/klicker-uzh/pull/5593) | Authoring contract | `1d6ec82e9cd717d252b6016cf200a4f40c2fa2d4` | `v3` |
| [#5614](https://github.com/uzh-bf/klicker-uzh/pull/5614) | Draft authoring UI | `1779f813cf36341b8348837d0764707996a5405b` | `rs/chatbot-authoring-contract` |
| [#5619](https://github.com/uzh-bf/klicker-uzh/pull/5619) | Publication UI | `75c6e626c159fad0e55843fb6488e5d736764948` | `rs/chatbot-draft-authoring-ui` |

This package adds one layer above #5619. It does not integrate `v3`, mutate a
lower branch, or repair inherited lower-layer CI failures.

## Design decision

The supplied design proposals are inspiration only and are not repository
assets. The implementation borrows:

- a persistent desktop chatbot rail and a compact mobile selector;
- a chatbot identity and lifecycle-status header;
- focused workspace navigation instead of stacked forms;
- explicit unsaved, saving, saved, and error feedback;
- separate advanced and operational information surfaces.

The workspace uses these URL states after the router and chatbot query are
ready:

- `view=overview|setup|advanced|usage`
- `step=basics|disclaimer|review` when `view=setup`

Invalid or lifecycle-incompatible values shallow-replace to a deterministic
fallback. The URL contains navigation state only, never unsaved form content.

### Guided setup

The existing create modal becomes the first setup step. It keeps the current
name, description, and owned-course inputs. `Create draft and continue` invokes
the existing create mutation exactly once, selects the returned chatbot, and
opens Disclaimer. Cancelling before creation has no side effect.

Persisted chatbots then use three focused steps:

1. **Basics** edits the existing name and optional description. Course remains
   read-only after creation.
2. **Disclaimer** edits the existing title and basic Slate introduction and
   shows the existing participant disclaimer preview.
3. **Review and submit** shows a compact Basics and Disclaimer summary, the
   existing publication inputs, capability notice, rejection feedback, edit
   links, and the existing submit or resubmit action.

Publication inputs are not described as saved before submission. The existing
mutation persists them only when it also requests publication.

### Deterministic entry and lifecycle

- Draft and Rejected open the first incomplete persisted prerequisite. Once
  trimmed name, linked course, disclaimer title, and disclaimer introduction
  are complete, both open Review.
- Rejected Review pre-fills persisted request values when present and displays
  the review comment. It does not infer a step from free-text feedback.
- Pending Approval, Published, and Paused default to Overview.
- Published metadata editing remains reachable through Setup > Basics, and
  published model settings remain editable in Advanced.
- Published disclaimer and publication fields remain read-only. Pending and
  Paused mutation controls remain locked exactly as today.
- Usage, credit, disclaimer-acceptance, and MCP information remain read-only.

Auto Mode remains the default and model selection is not a required setup
step. Advanced rehouses the current model selection and reasoning controls
without changing their mutations or lifecycle rules.

### Navigation and unsaved work

One shell-level coordinator receives dirty and mutation-pending state from the
mounted Basics Formik form, Disclaimer Slate/Formik surface, Review Formik
form, and Advanced model-setting state.

- `Save and continue` uses the existing mutation before advancing.
- Navigation is blocked while the relevant mutation is pending.
- Dirty chatbot selection, view or step changes, browser history, reload, and
  page exit require an explicit discard confirmation.
- Editing after a successful save clears the saved state.
- The final step states that publication inputs persist only on submission.

Desktop keeps the chatbot rail visible. At 390 x 844, a compact selector above
the header exposes selection, create, and lifecycle status without horizontal
overflow. Both variants use the same navigation guard.

## Product primitive and contract impact

| Primitive or contract | Treatment |
| --- | --- |
| Chatbot draft | Reused; no fields or lifecycle changes |
| ChatbotDisclaimer | Reused; existing copy-on-write save and preview remain authoritative |
| Publishing capability | Reused; authorization continues to fail closed |
| Publication request lifecycle | Reused; no new draft-save state or transition |
| Model policy | Reused in Advanced; Auto Mode and current mutations remain unchanged |
| Usage, credits, MCP | Reused as read-only operational information |

There is no GraphQL operation, schema, database migration, authorization, or
dependency change. If implementation needs one, execution pauses for a new
contract and topology ruling.

## Out of scope

- BYOK or API-key entry, USD budgets, pause controls, answer-style controls, or
  a lecturer test chat.
- Chat modes, knowledge-base attachment or authoring, access management, and
  tool toggles.
- Editing a published disclaimer or changing publication approval semantics.
- Response examples, ground-truth work, Microsoft Forms data, or AI-entitlement
  administration.
- Any lower-stack repair, upstream integration, deployment, or live account
  change.

## Architecture and seams

The package composes the existing components rather than replacing their
business logic. Expected primary paths are:

- `apps/frontend-manage/src/components/resources/Chatbots.tsx`
- `apps/frontend-manage/src/components/resources/chatbots/ChatbotList.tsx`
- `apps/frontend-manage/src/components/resources/chatbots/ChatbotCreateModal.tsx`
- `apps/frontend-manage/src/components/resources/chatbots/ChatbotDetails.tsx`
- `apps/frontend-manage/src/components/resources/chatbots/ChatbotAuthoring.tsx`
- `apps/frontend-manage/src/components/resources/chatbots/ChatbotPublicationRequest.tsx`
- focused new workspace, setup-navigation, and navigation-guard components in
  the same chatbot directory
- `packages/i18n/messages/en.ts` and `packages/i18n/messages/de.ts`
- `playwright/tests/T-chatbot-authoring.spec.ts`
- `docs/chat-platform.md`

Do not introduce a generic application-wide wizard or navigation framework.
Reuse design-system controls and the current Pages Router shallow-query pattern.

## Implementation slices and Delegation Map

### Slice 1: Guided workspace shell

Owner: Main execution orchestrator. The router, form-state, and data-loss seam
is critical-path coupled to the existing dirty worktree and requires direct
integration judgment.

Scope:

- Add the desktop rail, mobile selector, chatbot header, and
  Overview/Setup/Advanced/Usage navigation.
- Implement router-readiness, URL validation, deterministic lifecycle fallback,
  and the shell dirty/pending coordinator.
- Move existing detail sections into their focused surfaces without changing
  model, usage, credit, disclaimer, MCP, or lifecycle logic.
- Preserve published metadata/model editing and pending/paused locks.
- Add English/German copy and focused Playwright coverage in the same slice.

Acceptance:

- Existing selection, create action, status, participant link, metadata/model
  editing, and read-only operational information remain reachable.
- Invalid URL state falls back deterministically.
- Formik, Slate, and Advanced dirty/pending states protect navigation.
- Desktop and 390 x 844 layouts work without horizontal overflow.

Review gates: one simplifier and one slice reviewer over the committed slice.
The slice-review risk is silent data loss or router-state divergence.

### Slice 2: Focused setup flow

Owner: One configured native executor, integrated and verified by the main
session. The executor owns the setup components, focused spec changes, i18n,
and wiki update. It is told that it is not alone and must not revert Slice 1 or
the locally modified historical plan.

Dependency: Slice 1 committed and accepted.

Scope:

- Adapt the create modal as the setup entry and route successful creation to
  Disclaimer.
- Present Basics, Disclaimer, and Review and submit as one focused task at a
  time.
- Preserve existing metadata/disclaimer save semantics, Slate preview,
  publication capability, submission, rejection, and read-only states.
- Refactor and extend the existing Playwright coverage in this slice.
- Update `docs/chat-platform.md` with the lecturer-facing workflow.

Acceptance:

- One create action produces exactly one chatbot and enters setup.
- Save, continue, back, edit links, reload, and deep links do not silently lose
  work.
- Disclaimer formatting, pending-save locks, and participant preview persist.
- Authorized submission, unauthorized preparation warning, pending read-only,
  rejected resubmission, published editing, and paused locks preserve current
  semantics.

Review gates: one simplifier and one slice reviewer over the committed slice.
The slice-review risk is publication lifecycle or authorization regression.

### Integrated finish gate

The main session integrates and verifies both slices, runs the final reviewer,
dispositions findings, and updates this plan's Progress section. No test-only
slice is created.

## Feature-wide test portfolio

The existing six Playwright intents are retained and refactored rather than
duplicated. Deterministic intercepted-request gates remain the timing seam.

| Observable behavior | Required evidence |
| --- | --- |
| Create and enter setup | Exactly one create operation; returned chatbot selected; Disclaimer route opened; pending inputs locked |
| Persisted setup | Basics and Slate disclaimer save through existing mutations; basic toolbar and participant preview remain correct after reload |
| URL and navigation safety | Valid deep links, invalid fallback, chatbot/view/step switch protection, browser history and reload/page-exit warning |
| Advanced model policy | Auto Mode/default behavior preserved; dirty and pending model controls protected; published editing and pending/paused locks |
| Publication lifecycle | Authorized submit, unauthorized fail-closed warning, pending read-only, rejected prefill/comment/resubmit, published and paused states |
| Operational information | Credits, usage, disclaimer acceptance, MCP, linked course, and participant-link visibility preserved |
| Accessibility and responsive UX | Keyboard navigation, visible focus, first-error focus, labeled controls, `aria-live` async feedback, EN/DE desktop and 390 x 844 mobile, no horizontal overflow |

Run application checks inside the exact managed devcontainer and browser checks
from the host:

- focused Manage TypeScript, formatting, and lint checks;
- Playwright TypeScript and focused spec formatting/list checks;
- repository `pnpm run check:all`;
- root build before publication;
- focused host Playwright against the exact devrouter worktree route;
- mandatory host agent-browser verification with before/after screenshots in
  English and German at desktop and 390 x 844.

Screenshots stay under ignored `project/_local/screenshots/`. Use seeded or
synthetic local data only. GraphQL generation runs only if an operation changes;
the intended package changes none.

The current exact runtime is intentionally available at
`https://manage.klicker.rs-chatbot-authoring-contract.localhost/resources/chatbots`
for user validation. Preserve it through the requested validation session and
account for it at the final runtime boundary.

## Documentation and ADR disposition

Update `docs/chat-platform.md` in Slice 2. No ADR is required because this is a
reversible presentation and composition change over existing primitives.

Re-open the ADR gate before implementing persisted wizard state, a publication
draft-save mutation, changed publication or authorization semantics, or any
out-of-scope product feature.

## Size and stack ruling

Expected size is 700-1,100 human-authored lines across about 10-18 files, plus
ignored local screenshots. This exceeds an ordinary small review layer but
remains one fourth layer because it is one independently functional UI
composition over immutable lower contracts. Splitting the shell and guided flow
into separate PR layers would expose a transitional dense interface without an
independent product outcome.

Pause for a fifth-layer or topology ruling if realized work exceeds 1,300
human-authored lines or 20 files, requires a GraphQL/schema/migration/public
contract change, or cannot remain coherent in the two committed slices.

## Branch, delivery, and authority

After this plan receives explicit approval:

1. Run `gh stack view --json`, then non-interactively add only the new local top
   branch with `gh stack add rs/chatbot-authoring-wizard` from exact
   `rs/chatbot-publication-ui@75c6e626c...`.
2. Verify the new branch parent, working-tree contents, stack JSON, and exact
   local and remote heads for #5593, #5614, and #5619. `gh stack add` does not
   push, submit, sync, rebase, or rewrite lower branches.
3. Perform the two in-scope slices, checks, configured reviews, Progress
   updates, and scoped local commits.
4. Push only `rs/chatbot-authoring-wizard` to `origin`, then open or update one
   draft stacked PR targeting `rs/chatbot-publication-ui` with title
   `enhance(manage): guide chatbot setup`.
5. After exact-head proof, update that PR's full-branch description and report
   inherited lower-layer failures separately.

Execution note: the preflight found stale worktree-local `gh stack` metadata
that stopped at Layer 2 even though the remote PR bases are correct through
Layer 3. The existing metadata was left untouched. The approved fourth branch
was created directly from the exact Layer 3 head; publication will use the
additive remote `gh stack link` path so no lower branch is rewritten.

Approval does not authorize `gh stack sync`, rebase, upstream integration,
lower-layer mutation, stack reordering, ready-for-review conversion, merge,
queueing, deployment, account or production-data changes, cleanup, or runtime
teardown.

## Material pause conditions

Return to the user if:

- any new server, GraphQL, persistence, authorization, or lifecycle contract is
  required;
- the size or file-count threshold is crossed;
- a lower stack layer must change;
- the three immutable lower PR heads move before the new branch is added;
- browser proof exposes a product decision rather than an implementation defect.

## Progress

- [x] Remote refs and exact stack heads refreshed.
- [x] Existing dense authoring, publication, model, usage, and test seams mapped.
- [x] External proposals dispositioned as inspiration, not scope.
- [x] Product primitives and ADR gate reviewed.
- [x] Three-round native planner hardening completed with final approval.
- [x] Execution plan approved by the user on 2026-08-31.
- [x] Fourth branch created at exact Layer 3 head without mutating lower heads;
      stale local `gh stack` metadata required the safe direct-branch fallback.
- [x] Slice 1 implemented, committed, and reviewed. Focused Biome, Manage and
      Playwright TypeScript checks, all six authoring Playwright scenarios, and
      English desktop/mobile browser proof pass. Review corrections prevent a
      one-shot route allowance from leaking and restore the current URL when a
      dirty browser-history navigation is cancelled; the corrected history
      scenario passes on the host.
- [x] The root `check:all` environment gap is resolved locally by installing the
      Analytics package's declared Python 3.12 target and recreating only its
      ignored virtual environment; all 7 lint tasks and all 25 check tasks pass.
- [x] Slice 2 implemented, committed, and reviewed. Focused Biome, Prettier,
      Manage and Playwright TypeScript, and all six authoring Playwright
      scenarios pass. The browser suite exposed and now covers a save/refetch
      navigation race. Review corrections add programmatic step state and
      announcements, clear a stale deferred advance, and cover published
      metadata saves.
- [x] Exact-head integrated verification completed. Root `check:all` passes,
      the root production build completes with 23 of 23 tasks successful, and
      the focused host Playwright suite passes all 6 authoring scenarios.
      Agent-browser verifies the guided draft, review summary, mobile chatbot
      selector, English and German routes, desktop and 390 x 844 layouts, and
      the dirty browser-history guard using synthetic local data. Four ignored
      screenshots record the EN/DE desktop/mobile states. Final package review
      identified five actionable interaction and accessibility findings.
- [x] The user approved keeping the realized package as one cohesive fourth
      layer after it crossed the plan's expected line-count threshold. Final
      review corrections now preserve the dirty guard when Create is cancelled,
      expose complete read-only disclaimer and publication details for pending,
      published, and paused chatbots, clear saved metadata feedback after a new
      edit, restore semantic heading order, and focus the first invalid required
      field after submission. Focused formatting and TypeScript checks pass, the
      host Playwright suite passes all 7 scenarios, and agent-browser confirms
      the paused read-only overview plus first-error focus with synthetic data.
      The corrected tree also passes root `check:all` and the root production
      build with 23 of 23 tasks successful.
- [x] The corrected final review found one remaining dead destination: Pending
      Approval and Paused exposed Setup even though lifecycle normalization
      always retained Overview. Setup is now omitted for those locked states
      while Draft, Rejected, and Published retain their existing setup access.
      Node 24 Manage and Playwright TypeScript checks pass, the focused host
      Chromium suite passes all 7 scenarios, and agent-browser confirms the
      Paused navigation contains Overview, Advanced, and Usage only. The
      ignored screenshot
      `project/_local/screenshots/chatbot-guided-setup-paused-no-setup-2026-09-01.png`
      records the exact local state.
- [x] The integrated final reviewer approved exact implementation head
      `7dd3d4dd6191ad6c1b0b4fda864c0e9ed4efda29` with no actionable findings.
      The configured reviewer transport failed terminally with
      `unreadable_encrypted_agent_task`, so the configured continuity path used
      a trusted native Sol xhigh fallback. All verified findings are corrected
      and dispositioned; the full report is retained under ignored
      `project/_local/reviews/`.
- [ ] Fourth branch pushed and draft stacked PR opened or updated.
