# Chat history rail correction

- Status: implemented and committed (4 commits ahead of f8af0a899, through
  f547e1f5d); simplifier, named-risk slice review, and integrated final
  review complete. Publication (push/PR/readiness/merge) remains pending and
  separately authorized.
- Branch: `rs/chat-history-rail-correction`
- Worktree: `trees/chat-history-rail`
- Base: `origin/v3` at `f8af0a899305b182635d53069b4970330fb8338d`
- Related merged PR: [#5409](https://github.com/uzh-bf/klicker-uzh/pull/5409)
- Delivery: one ordinary follow-up PR; no stack is needed
- Publication: push, PR creation, readiness, and merge are separate authorities

## Goal

Correct the merged history-rail implementation so the rail represents one
landmark per adjacent user/assistant turn, keeps orphan messages navigable, and
shows complete text only on demand. Tool calls, reasoning, and client errors
remain transcript details rather than rail landmarks. Desktop and mobile use
the same message-root navigation contract without scroll-spy races or
touch-hostile precision targets.

The correction is a derived view over the existing active conversation path.
It does not add persistence, API or schema changes, parent links, sibling
branch visualization, model behavior, or new dependencies.

The superseded implementation plan in
`project/2026-08-14-chat-history-rail-plan.md` is immutable history from PR
#5409 and is intentionally restored unchanged. This plan owns the follow-up
correction package.

## Decisions and acceptance

- Adjacent user then assistant messages become one `turn` entry anchored to the
  user message root. User-only and assistant-only messages remain standalone
  entries, including consecutive same-role messages.
- Text parts are concatenated in order without truncation for the full-text
  popover. A short preview may be used only in compact labels and dialog rows.
- Reasoning, tool-call, and `chat-error` parts never become rail landmarks or
  part anchors. An assistant error part still promotes the turn status to
  `error`.
- Desktop (`md` and up) uses bounded vertical ticks. Hover and keyboard focus
  reveal the complete user/assistant text; the popover is hidden otherwise.
- Mobile uses one touch-safe history trigger and the shared full-history
  dialog. Navigation targets message roots, keeps tool groups collapsed, and
  preserves the trigger gutter so the selected message is not covered.
- Programmatic navigation uses a tokenized lock so the scroll spy cannot
  select a stale landmark during rapid second-target activation. Escape returns
  focus to the invoking trigger.
- Acceptance requires focused unit coverage, seeded browser proof at desktop
  and 390x844 mobile widths, current highlighting, focus return, rapid
  navigation, collapsed tools, EN/DE labels, reduced motion, and no unrelated
  source or data changes.

## Work packaging and delegation

This is a full-path package because the projection, transcript roots, rail
interaction, responsive layout, localization, documentation, and browser proof
share one critical UI seam. The main session owns topology, implementation,
integration, documentation, and final proof; no independent slice can safely
change the projection and navigation contracts in isolation.

| Slice | Owner | Acceptance check |
| --- | --- | --- |
| S0 topology and plan | main | Fresh branch from current `origin/v3`; old merged plan restored; this plan records scope and gates |
| S1 turn projection, roots, rail UI, and tests | main | Unit and seeded browser checks prove pairing/orphans, complete text, hidden-on-idle popovers, root navigation, mobile dialog, and collapsed tools |
| S2 localization and wiki alignment | main | EN/DE strings, chat guide, testing skill, and dated log describe the same turn contract |
| S3 finish gate | main plus required reviewers | Checks pass on committed range; simplifier, named-risk slice review, and final reviewer findings are resolved |

Execution-tier skip reason for S1/S2: critical-path coupling. A planner pass
was completed before replay and identified the stale merged branch, the need
for a new plan, missing orphan/full-text tests, and stale mobile documentation.

## Test portfolio

- `apps/chat/test/history-rail.test.ts`: adjacent pairing; assistant-only and
  user-only orphans; consecutive same-role messages; complete multi-part text
  beyond the preview limit; running/partial/error states; `chat-error`
  promotion; no part landmarks; and active-path order.
- Existing chat package suite and typecheck/build:
  `pnpm --filter @klicker-uzh/chat test:run`, `check`, and `build`; workspace
  `pnpm run check`.
- Seeded Playwright regression in `playwright/tests/Y-chat.spec.ts` if the
  existing fixtures expose stable rail selectors: desktop bounded ticks and
  hover/focus-only complete text, message-root navigation, mobile trigger/dialog
  navigation and focus return, rapid second target, and collapsed tool groups.
  Keep the test deterministic; it does not require a live upstream model.
- Scoped Biome and Prettier, `git diff --check`, and wiki validation. Record
  the known analytics `pandas` compiler limitation if `check:all` still fails
  only in that environment.
- Browser proof must be rerun after replay on this base, using the real
  authenticated browser path. A local assistant error is sufficient for the
  rail state contract, but it is not evidence of upstream model-backed
  reasoning or tool streaming.

## Commit and review boundaries

After explicit commit authorization, use these small conventional commits:

1. `docs(project): plan chat history rail correction`
2. `fix(chat): correct history rail turn navigation`
3. `docs(chat): document history rail correction`

Before any push or PR publication, run the required gates over the immutable
committed range: a simplifier pass; a named-risk slice review covering
accessibility, focus, responsive navigation, and collapsed tools; then one
integrated final reviewer. Save local reports under `project/_local/reviews/`
and keep them out of commits. The PR title should be
`fix(chat): correct history rail turn navigation`; default to draft unless the
user separately authorizes publication/readiness.

Because this is a post-merge correction to #5409, capture the packaging lesson
with `$rs-compound` before the final handoff rather than treating it as a new
feature stack.

## Progress

- [x] Refreshed `origin/v3` to `f8af0a899` and verified no follow-up branch
      existed.
- [x] Preserved the dirty correction in `stash@{0}` as a rollback backup.
- [x] Created `rs/chat-history-rail-correction` from the refreshed base and
      applied the preserved correction without dropping the backup stash.
- [x] Restored the merged PR's 2026-08-14 plan unchanged.
- [x] Add explicit orphan and complete-text projection tests.
- [x] Align current docs/log wording and date with the mobile trigger contract.
- [x] Re-run focused checks and real-browser verification on this fresh base.
- [x] Commit the exact slices (4 commits through `f547e1f5d`) and run review
      gates: simplifier, named-risk slice review, integrated final review.
- [ ] Obtain separate push/PR/readiness/merge authority.

## Product-primitive disposition

The change is a derived navigation composition over the existing canonical
conversation path. The canonical message/turn primitives, history persistence,
and ownership are reused unchanged: no schema, API, persistence, or state
ownership delta is introduced, and no second primitive claims turn identity,
history, or navigation state. The history rail is a read-only projection whose
consumer is the chat transcript (message roots). This satisfies the
product-primitive integrity check: no primitive-impact table is required for an
internal behavior-preserving view, and no primitive delta with user-outcome
consequences is introduced.

## Known blockers and boundaries

- `devrouter exec` and lifecycle listing currently fail with
  `could not determine process identity for workspace lifecycle lock`; checks
  use the exact validated container as a disclosed fallback, and raw Docker
  stop is not an allowed substitute.
- `pnpm run check:all` may fail in analytics because the container has no C
  compiler for pinned `pandas`; this is an environment blocker only when the
  remaining tasks pass.
- The targeted Playwright regression is typechecked but cannot launch locally
  because the container lacks the pinned Chromium headless shell
  (`chromium_headless_shell-1208`). The real authenticated in-app browser proof
  covers the same desktop/mobile interaction contract.
- The local agent-browser binary initially hit a root-owned npm cache and the
  host route returned bad gateway; authenticated proof therefore uses the
  existing in-app browser tab. No live upstream model key is available.
- A synthetic local verification thread with non-sensitive text remains in the
  browser/database unless the user explicitly asks for its deletion.
