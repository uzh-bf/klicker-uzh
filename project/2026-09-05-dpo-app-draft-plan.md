# DPO app draft 2026-09-05 — implementation plan

## Approval summary

Prepare an app-local draft of the nine DPO package surfaces using existing KlickerUZH presentation components, fonts, colors, and buttons. Restructure content to match the package without a visual redesign. Preserve authoritative German wording and provide equivalent English app UI.

**Proposed scope: draft-first.** Development-only review pages demonstrate validation and state transitions using memory-only synthetic fixtures. They do not create accounts, save preferences, activate access, export records, or upload files. Existing production behavior remains unchanged.

The student guide remains German and clearly marked as a draft. Preserve its anchors and three XLSX attachment links. Lecturer analytics, audit examples, and export specimens remain supporting review material.

Backend activation, OAuth changes, new analytics/private dashboards, chat clustering, final export formats, and integration into existing feature branches are excluded. Several notices describe future guarantees; DPO/copyright approval and matching backend behavior remain release blockers.

**One user approval authorizes:** this draft-only scope, local implementation in the preserved worktree, bounded native delegation, configured reviews, minimal local runtime and synthetic verification, and local commits. It excludes pushes, PR creation, upstream integration, merging, publishing, deployment, and real-data processing.

**Success:** all nine surfaces pass behavioral and bilingual visual verification; links work; production access fails closed; local commits and required reviews are complete.

## Plan persistence and execution contract

Following this planner approval, the main session persists the complete plan **before requesting user approval** at:

`trees/consent-disclaimers/project/2026-09-05-dpo-app-draft-plan.md`

Leave it uncommitted while approval is pending. After approval, commit the plan separately before implementation.

**Execution owner and boundary owner:** main. Main owns seams, shared files, translations, integration, reviews, and final proof. Routine slice boundaries require no further approval.

**Terminal:** a locally committed, verified, reviewed app draft. No PR is created.

**Pause conditions:** a requested functional integration, unavailable required review/runtime capability, necessary new dependency, unavoidable live data/network effect, or material departure from the approved content or scope. A user preference for full functionality requires revising this plan before implementation.

## Evidence and preservation

Use `/Users/rschlae/Git/klicker/klicker-uzh/trees/consent-disclaimers`, branch `rs/consent-disclaimers`, at `50fc439749282b0b390c422369890a2da41885f0`. Upstream is `origin/v3`; recorded refreshed state is zero ahead and 46 behind. No upstream integration is authorized.

Preserve the three pre-existing deletions under `packages/transactional/out/`. Leave unrelated primary-checkout changes untouched. The ignored package is a deliberately shared read-only input.

Authoritative sources are the [package entry point](</Users/rschlae/Git/klicker/klicker-uzh/project/_local/2026-09-03-dpo-package-v2/README.md>), [prototype including `CHOICES_HTML` and generated normal edu-ID view](</Users/rschlae/Git/klicker/klicker-uzh/project/_local/2026-09-03-dpo-package-v2/prototype.html>), [German guide](</Users/rschlae/Git/klicker/klicker-uzh/project/_local/2026-09-03-dpo-package-v2/learning-analytics-students.html>), and [implementation review](</Users/rschlae/Git/klicker/klicker-uzh/project/_local/2026-09-03-dpo-package-v2/learning-analytics-review.md>).

Preserve the archive with verified SHA-256:

`3b92abafc3cfaabd7e5149aa24ff21b52dc0c149ff618f14010acd4168f984a8`

Latest package decisions and the user’s retained-points ruling override historical proposals. No legal-policy research or approval is implied by implementing the supplied copy.

## Primitive impact and contracts

| Product primitive | Draft disposition | Binding behavior |
|---|---|---|
| Research choice | Compose | Initially allowed for an unsaved form; independent of LA. A displayed default does not establish backend eligibility. |
| Global LA choice | Compose | Initially unset; explicit yes/no required. Saved values survive renewed terms and cancelled edits. |
| Acknowledgement and account usability | Compose | Acknowledgement required separately from optional choices. Normal edu-ID does not imply assessment status. |
| Leaderboard participation | Extend in local representation | Retained points count immediately on first join/rejoin; no retroactive rank awards. Leaving preserves private points. |
| Export/material attestations | Compose | Separate assessment, research, rights, and personal-data confirmations; no actual transfer or persistence. |

No new production data model or ADR is required for this reversible draft. Changes to persistence, authentication, eligibility, release policy, or data flow reopen architecture review.

Parent-verified discrepancies in ADRs 0023 (global LA/course gate), 0024 (research release boundary), and 0025 (assessment usability) remain separately owned future reconciliation. Inspect them through `git show origin/v3-ai:docs/adr/<file>`; do not import or rewrite them here.

## Source-to-app map

All implementation paths below are relative to the worktree. Proposed directories contain presentation and local review composition, not backend substitutes.

| Core surfaces | Proposed destination and existing reference |
|---|---|
| Credentials; normal edu-ID; assessment; existing-account gate | PWA `src/components/dpo-draft/`, composed in `src/pages/dpo-draft.tsx`; reference `components/forms/CreateAccountForm.tsx` and `pages/createAccount.tsx`. |
| Settings; leaderboard join | Same PWA entry; reference `pages/editProfile.tsx`, `pages/course/[courseId]/index.tsx`, and `components/participant/LeaveLeaderboardModal.tsx`. The course `join.tsx` page handles joining by PIN, not the leaderboard decision. |
| Assessment export; research export | Manage `src/components/dpo-draft/` and `src/pages/dpo-draft.tsx`; reuse design-system dialogs and `src/pages/courses/[id]/assessment/results.tsx`. The participant's own credential/report export is a separate surface. |
| KB upload | Same Manage entry; reference `origin/v3-ai:packages/kb-management/src/components/KnowledgeBaseAddResourceModal.tsx` and `KnowledgeBaseReplaceFileModal.tsx` without importing their branch. |

Shared choice presentation belongs in `packages/shared-components/src/`; app translations belong in `packages/i18n/messages/de.ts` and `en.ts`.

The existing PWA `pages/activation.tsx` performs token activation and is not the assessment draft integration point.

## Development isolation

Review pages enforce `NODE_ENV === 'development'` on the server and return 404 otherwise. Review assets use the same check through a development-only API, such as PWA `src/pages/api/dpo-draft-assets/[asset].ts`.

Use a fixed asset-name-to-file allowlist for the German guide and three XLSX files. Accept no arbitrary filesystem paths. Resolve the established shared package explicitly; missing files fail closed. Keep original ignored specimens uncommitted.

Use memory-only fixtures and local result indicators. Reuse presentation components without live query hooks, mutation callbacks, or telemetry. If app providers initiate such effects, add a narrowly scoped development review-page bypass in the affected `src/pages/_app.tsx`. All other pages retain their existing provider composition.

Keep fixture identities and review controls outside reusable content. Do not publish specimen assets through unrestricted `public/` paths. A review banner identifies local simulated behavior without asserting that anything was saved or delivered.

## Existing ownership and delivery topology

The parent verified current PR ownership through host `gh`. Preserve the schema [PR #5569](https://github.com/uzh-bf/klicker-uzh/pull/5569), API [PR #5590](https://github.com/uzh-bf/klicker-uzh/pull/5590), and settings [PR #5595](https://github.com/uzh-bf/klicker-uzh/pull/5595) dependency chain.

Preserve the engine [PR #5413](https://github.com/uzh-bf/klicker-uzh/pull/5413), coordinator [PR #5611](https://github.com/uzh-bf/klicker-uzh/pull/5611), and lecturer groups [PR #5629](https://github.com/uzh-bf/klicker-uzh/pull/5629).

This cohesive local draft does not depend on merging those branches. Functional activation does. No new stack or external delivery action is proposed.

## Delegation Map

Assignments describe future execution after approval.

| Slice | Owner / Route | Dependency | Acceptance |
|---|---|---|---|
| Isolated signup tracer | `main` | User approval | Production 404, real styling, valid local signup, no network effects |
| Participant journeys | native `executor` | Shared tracer contract | Remaining participant surfaces preserve choices and cancellation |
| Lecturer dialogs | native `executor` | Review isolation and shared contract | Both exports and KB upload validate locally |
| Integrated verification | `main` | Both UI slices | Nine surfaces, bilingual proof, links, checks, committed reviews |

Main retains shared files and translations because both apps depend on them. Executors own disjoint app directories and supply translation requirements. Resolve models through `rs-model-routing` before dispatch.

The optional rival route is unavailable: AGY initialization attempted unrelated eager MCP setup. Do not repair configuration or escalate; required native review routes remain the plan’s review mechanism.

## Implementation slices

**Isolated signup tracer.** Build the isolation boundary and credentials form first. Preserve existing email, username, and password constraints, except remove password repetition as explicitly required. Show only email, username, and password; omit avatar/profile visibility controls. Simulate username availability without GraphQL. Enforce validation in form submission, including Enter. Research starts allowed; LA and acknowledgement remain incomplete. Verify production denial before expanding. Commit the working tracer.

**Participant journeys.** Add normal edu-ID, assessment, gate, settings, and leaderboard surfaces. Saved research/LA values remain unchanged when acknowledgement renews. Cancelled preference edits restore saved state. Model retained points on join/rejoin without awarding historical rank rewards. No OAuth, account activation, or global routing enforcement is added. Commit the complete participant slice.

**Lecturer dialogs.** Assessment requires acknowledgement. Research requires nonblank title, responsible person, purpose, valid email, deletion date no earlier than the local calendar date, at least one initially unchecked data class, and acknowledgement. KB rights/privacy confirmations start unchecked and reset on cancel/reopen. Exercise initial/additional/replacement/import scenarios within one upload surface. Transfer no files. Commit the lecturer slice.

**Integrated verification.** Complete English UI, authoritative German guide access, attachment links, screenshots, and review corrections. Stop the exact runtime after checks and verify shutdown. Commit the final integrated state.

## Verification and reviews

| Risk | Evidence |
|---|---|
| Invalid or unintended submission | Focused synthetic browser tests for Enter, required choices, account constraints, export fields, date boundaries, and acknowledgements |
| Lost choices or stale confirmations | Behavioral tests for renewal, cancellation, reopening, and upload reset |
| Production exposure or network effects | Non-development 404 checks for pages/assets; network inspection that detects attempted queries, mutations, telemetry, exports, or uploads |
| Visual/content integration | All nine surfaces in DE/EN; desktop, mobile, and LMS-sized iframe screenshots; keyboard/focus checks; guide anchors and three downloads |

Use existing test infrastructure. Do not pin prose, translations, or specimen contents. Preserve unrelated production coverage.

Build affected packages before `check`, then run package `lint`, focused formatting, and required repository commit checks. Use container toolchains and host Playwright; follow runtime-lifecycle and repository browser skills.

Run `simplifier` for substantive committed slices. Arm `slice-reviewer` for isolation/provider changes and consequential validation/state contracts; pure presentation alone does not require a risk review. Run one integrated `final-reviewer` after verification, covering applicable correctness, compliance, maintainability, security, and architecture lenses. Persist exact-range reports under `project/_local/reviews/`.

## Progress and release boundary

Planner construction and challenge: **approved** in the second round. The user approved execution with a goal on 2026-09-06. The active goal covers this draft-only scope through verification, reviews, and local commits. Implementation is starting on the preserved baseline; refreshed refs still show 0 ahead and 46 behind origin/v3. No upstream integration is authorized.

Live release remains blocked on DPO/copyright approval, reconciled policy, and demonstrated backend guarantees for eligibility, points retention, group-only reports, withdrawal/deletion, and attestations. These do not prevent completing the approved local draft. An incomplete or unreviewed implementation must remain explicitly incomplete.
