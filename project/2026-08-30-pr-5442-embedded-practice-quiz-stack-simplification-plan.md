# Embedded practice quiz stack simplification

## Plan identity

- Plan path: `project/2026-08-30-pr-5442-embedded-practice-quiz-stack-simplification-plan.md`
- Delivery topology: one shared plan carried by the first phase of the existing stacked PRs; later layers carry their own `Progress` updates.
- PRs: [#5442](https://github.com/uzh-bf/klicker-uzh/pull/5442), [#5456](https://github.com/uzh-bf/klicker-uzh/pull/5456), and [#5536](https://github.com/uzh-bf/klicker-uzh/pull/5536)
- Branches, bottom to top: `codex/focused-practice-quiz-embed`, `claude/open-pr-search-v0p12i`, and `rs/feat-focused-embed-completed-screen`
- Target branch: `v3`
- Execution checkout: isolated local clone at `/private/tmp/klicker-focused-embed-simplification`; the repo-local task worktree and dirty primary checkout remain unchanged until the reconciled commits are ready to transfer.
- Related history: `project/plans_wip/PLAN-embedded-practice-quiz-host-integration.md` is the earlier cumulative plan and remains history; it is not overwritten.

## Execution contract

- Execution owner: main session. The shared quiz files and stacked topology make separate implementation ownership unsafe.
- Autonomy model: the user's “proceed” accepts this planner-reviewed plan through local implementation, local commits, repository-native checks, read-only specialist reviews, and local browser/runtime verification.
- Boundary owner: the user owns publication and integration decisions after local acceptance.
- Granted actions: create an isolated clone, save recovery refs, rewrite only local copies of the three named branches, edit in-scope Klicker files and this plan, create conventional local commits, run focused checks, use the local devrouter runtime, and collect browser evidence.
- Withheld actions: do not push, force-push, merge, rebase onto a moving target, update PR metadata, change the eLearning repository, deploy, or alter shared infrastructure.
- Terminal condition: the plan is the first commit of the bottom layer, all three local layers are contiguous and independently reviewable, focused checks and paired browser evidence pass, required specialist reports are recorded, and the stack is ready for a separately authorized publication pass.
- Pause conditions: stop for an unprotected recovery point, an existing user change that overlaps an in-scope hunk, a new auth/data/security/infrastructure/public-contract decision, a target-head conflict requiring upstream integration, or an unavailable runtime after the documented focused fallback.

## Resolved design findings

- The planner review returned `DONE_WITH_CONCERNS`; the accepted correction is to keep monotonic capability negotiation in #5442 so repeated initialization cannot revoke an already negotiated capability.
- URL-only focused mode is presentation state. Host navigation is enabled only after capability negotiation, and the child remains the source of truth for disabled, submitting, and completed states.
- Completion is an in-session transition from unfinished to finished. A child that loads already finished does not create a new eLearning completion event.
- No unanswered product ruling blocks this implementation. Reopen the design only if the eLearning host needs a new message version, a new capability, or a different completion/persistence semantic.

## Primitive impact

| Primitive or composition | Disposition | Contract delta and evidence |
|---|---|---|
| Embedded practice-quiz session | Extend | Preserve the existing v1 handshake and status messages; add only the minimum resize, focused-navigation, and lifecycle state needed by the existing eLearning host. |
| Practice-quiz navigation | Reuse and simplify | Keep child navigation for legacy embeds; transfer the single advance action only after negotiated host navigation is active. |
| Practice-quiz progress and completion | Extend | Keep contiguous progress, resume, retry, and completion summary behavior while removing test-only state. |
| eLearning host composition | Preserve | Keep the existing embedded URL and host status/advance contract byte-compatible; no eLearning code changes are in scope. |

## ADR gate

- Result: no new ADR. This is a reversible re-layering of an existing cross-system contract, not a new domain primitive, persistence model, authentication boundary, or deployment ownership decision.
- Re-arm the ADR gate if implementation introduces a new protocol version, a new externally reusable package/context, changed origin or authentication rules, new persisted completion semantics, or a new long-lived ownership boundary.

## Skill routing

- `$rs-product-primitives`: freeze the existing embedded quiz/session and host-navigation contract.
- `$rs-stacked-change` and `$gh-stack`: preserve the three-PR dependency order and review each layer against its parent.
- `$rs-sliced-development-workflow`: full-path plan, one slice per meaningful commit, simplifier after each substantive slice, risk review at the cross-system seam, and one integrated final review.
- `$rs-model-routing` and `$rs-agent-capacity`: select and checkpoint specialist routes before dispatch.
- `klicker-frontend-ui`, `agent-browser`, `klicker-testing-verification`, and `klicker-playwright-e2e`: implement and verify the UI and browser-only contract.
- `$rs-local-runtime-lifecycle`: govern devrouter startup, final runtime verification, and shutdown.

## Research

- Question: which exact heads and base relationships are live? Finding: a direct fetch on 2026-08-31 resolved `v3` to `8de87d731af4d0ffa341b6d3591d55db7b0f4b81`, #5442 to `39e163c5e9072e82e9b895a996ef7439008314be`, #5456 to `f59de4cfeb73693ed0ec4c486d7206ddf92e72e3`, and #5536 to `269ef3d209fa6af8e479ff8cb7f6b835eb1df1ce`.
- Question: can existing host behavior remain unchanged? Finding: the previously verified eLearning host requests the embedded URL and resize/host-navigation capabilities, then consumes child status; no eLearning change is required.
- Limitation: GitHub CLI authentication is currently invalid, so forge metadata and publication are not used as evidence. Direct Git fetch remains sufficient for the local rewrite; live PR status must be refreshed after authentication is restored.

## Test portfolio

| Consequential behavior | Existing protection | Obligation | Primary seam | Owning slice | Distinct failure caught |
|---|---|---|---|---|---|
| Resize handshake and one scroll owner | Existing protocol harness and prior browser evidence | Extend existing | Protocol unit + browser frame | #5442 | Resize-only and long-content embeds do not create nested scrolling. |
| Capability negotiation and disabled/submitting state | Existing host-navigation tests | Extend existing | Protocol/component contract | #5442 | A stale init cannot revoke capability, and host advance cannot bypass a disabled action. |
| Focused presentation and linear host navigation | Existing focused embed browser path | Extend existing | Paired browser E2E | #5456 | The host and child do not expose competing continue actions or skip unanswered content. |
| Progress, resume, completion, and retry | Existing progress/resume/completion tests | Extend existing | PracticeQuiz state tests + browser E2E | #5536 | Completion is emitted once, resume is contiguous, and retry resets only this quiz. |
| Legacy/non-embedded behavior | Existing PWA suite | None beyond regression run | Existing PWA checks | All layers | Simplification does not change the ordinary practice-quiz flow. |

## Plan-hardening record

- Specialist: planner `01a05418-215a-7261-b86c-1a50b4cddff0` (James), read-only.
- Outcome: `DONE_WITH_CONCERNS`; the only accepted correction is the #5442 placement of monotonic capability negotiation recorded above.
- Arbitration: no unresolved concern changes scope, topology, or authority. No second planning round is required.

## Problem

The three-PR focused practice-quiz embedding stack works, but the cumulative
diff bundled resize, focused UI, host navigation, test routes, platform-only
plumbing, and completion behavior in one layer. Some correctness fixes only
exist in later layers, so an intermediate layer is not independently safe.

## Evidence

- The cumulative stack touches 16 files, 1511 additions, and 191 deletions.
- The base PR mixes a small protocol foundation with a focused quiz rewrite and
  two test harnesses.
- The middle PR contains correctness fixes for the base's host navigation and
  focused behavior.
- The existing eLearning contract requests the embedded URL and resize/
  host-navigation capabilities, then responds to child status.
- The known pairing tests covered resize, one scroll surface, contiguous
  progress and resume, completion/retry, and linear host navigation.

## Decision

Keep the same three PR URLs, branch names, and dependency order. Re-layer the
work as small, independently safe slices. Preserve the existing eLearning
interface and every current user-visible outcome, while deleting all test-only
production state and dead UI plumbing.

### Layer ownership

| PR | Re-layered responsibility |
|---|---|
| #5442 | Resize, handshake parsing, monotonic capability negotiation, scroll ownership |
| #5456 | Focused presentation and complete negotiated host navigation |
| #5536 | Progress, resume, completion summary, retry, and narrow storage reset |

### Reasoning

1. The smallest protocol seam is the child-advertised capability plus the host
   action contract. It does not require a new context, provider, package,
   ADR, or alternate route.
2. URL-only focused mode remains a presentation request. Only negotiated host
   navigation can hide child actions or transfer the Start/Submit/Continue
   action to the host.
3. Monotonic negotiation is part of the foundation because a stale repeat
   message must never revoke a capability. Deferring it would make focused mode
   unsafe below the lifecycle PR.
4. A small navigation controller is simpler and less error-prone than the
   current mixed booleans and hidden-button DOM query.
5. The host's continue action must depend on the child's visible disabled state,
   not incidental Button loading semantics.
6. Emitting `canAdvance: false` after completion is semantically correct.
   eLearning still proceeds from `status: completed` and does not send another
   child advance command.
7. The eLearning host marks itself complete only through an in-session
   unfinished-to-finished transition. A child that starts finished must not
   create a new completion event.

## Non-goals

- Do not merge, deploy, publish, or rebase to a protected target.
- Do not change the eLearning PR surface or its branch base.
- Do not change auth, gamification, Hatchet, Prisma, small-group reassignment,
  or non-embedded PracticeQuiz behavior.
- Do not add a test-only production route, query state, context, dependency,
  or protocol version.

## Delegation map

All slices are main-session owned because the layers continuously touch the
same quiz files and one topology owner must preserve each PR boundary. The
simplifier, slice reviewer, and final reviewer are read-only checks, not
implementers.

| Slice | Owner | Acceptance |
|---|---|---|
| S1 resize foundation | main | #5442 independently renders legacy and resize-only embeds safely |
| S2 focused host navigation | main | #5456 independently safe and complete for URL and negotiated modes |
| S3 lifecycle polish | main | #5536 completes the UI without changing #5442/#5456 invariants |
| Integrated review | main | final reviewer accepts the cumulative stack and paired E2E evidence |

## File disposition

### Delete

- `apps/frontend-pwa/src/pages/.../practiceQuizzes/[id]/embed-test.tsx`
- `apps/frontend-pwa/src/components/practiceQuiz/embed-advance.test.ts`
- all `embedTestStep`, `initialEmbeddedStep`, related query parsing, and
  test-step i18n keys
- dead `PracticeQuizOverview.hideStartButton`

### Restore

- `PracticeQuizOverview.tsx` to `v3` wherever no other change remains.
- unrelated import, ordering, comment, and type-only churn.

### Keep

- `Layout.tsx`, `PracticeQuiz.tsx`, `ElementStack.tsx`,
  `StepProgressWithScoring.tsx`, and one embed protocol module per layer.
- one static `util/embed-harness` host for deterministic protocol checks.
- focused completion/retry strings and durable frontend guidance, without the
  duplicate skill protocol copy.

## Implementation slices

1. Base #5442 on the reconciled live `v3` head, centralize the resize/handshake protocol,
   add monotonic capability negotiation and layout overflow control, and keep
   the current v1 state shape.
2. Base #5456 on the revised #5442, add `embedMode=focused`, auto-start,
   negotiated navigation, named action handlers, controller-based reporting,
   corrected feedback, and a minimal completion frame for pre-#5536 safety.
3. Base #5536 on the revised #5456, add progress derivation, contiguous prefix
   gating, resume, score/result summary, completion panel, retry, and the
   narrowed quiz-scoped storage reset.

## Verification

- Focused PWA checks, tests, lint, and production build per layer.
- Protocol unit coverage for source, origin, version, malformed input,
  monotonic capability, submitting/disabled state, and completed state.
- Static harness checks for bare-init and resize-only compatibility and for
  focused host navigation.
- Paired Klicker/eLearning browser E2E for resize, one scroll surface,
  progress/resume, completion/retry, and linear host navigation.
- For each PR: exact delta, no secrets or user data, and no infra impact.

## Progress

- 2026-08-30: Full plan written after a planner review.
- 2026-08-30: Planned the bottom-up re-layering and final paired E2E.
- 2026-08-31: Direct fetch reconciled the live stack as `v3` `8de87d731af4d0ffa341b6d3591d55db7b0f4b81`, #5442 `39e163c5e9072e82e9b895a996ef7439008314be`, #5456 `f59de4cfeb73693ed0ec4c486d7206ddf92e72e3`, and #5536 `269ef3d209fa6af8e479ff8cb7f6b835eb1df1ce`; the three live PR heads are contiguous.
- 2026-08-31: Saved old visible and hidden local stack heads plus the reconciled live heads under `refs/stack-backup/2026-08-31/` in the isolated clone. The dirty primary checkout remains untouched.
- 2026-08-31: The plan is the first commit on the rewritten bottom layer (`361e77446`). S1 is now active: retain only resize/handshake foundation behavior and remove focused-navigation, test-route, platform, and unrelated documentation churn from #5442.
- 2026-08-31: S1 is committed as `b88c07aae` (`feat(embed): add resize-aware quiz foundation`). Its dedicated slice review found no blocking issues; the simplifier's low-severity import-churn concern was restored before S2.
- 2026-08-31: S2 is implemented locally: focused presentation is negotiated through the shared protocol, the child reports whether the current action is valid, and the host advance request is accepted only for the matching origin and state. Host requests invoke named child action callbacks, while the legacy embed fallback keeps its visible action button.
- 2026-08-31: S2 received a clean risk review. Its simplifier recommended two low-severity reductions, so the capability validator remains strict and the route no longer wraps ordinary index changes in a redundant handler.
- 2026-08-31: S3 is implemented locally: progress state is shared with the route, focused embeds keep a visible but host-owned progress bar, fallback navigation stops at the first unanswered stack, reloads resume there, completion shows the existing localized result summary, and retry clears only the quiz's own keys. No new translation strings are required.
- 2026-08-31: Incorporated the S3 simplifier concerns: practice-quiz progress helpers now live outside the embed protocol module and the completion summary exposes only score and answered count. Current Biome-required type-only imports and ordering remain.
- 2026-08-31: Addressed the final review's code findings locally: named action callbacks replace hidden button lookup, invalid resize measurements retain child scrolling, and manually graded stacks count as answered in the completion summary.
- 2026-08-31: Re-layered those final-review corrections into their owners: resize fallback is in S1, callback-based host actions are in S2, and S3 remains limited to progress, resume, completion, and retry.
- 2026-08-31: Extended the static harness after final review identified a plan-compliance gap: it now negotiates host navigation, validates and displays phase/advance state, and sends a versioned advance request only when the child reports an allowed state; the README documents the focused-navigation procedure.
