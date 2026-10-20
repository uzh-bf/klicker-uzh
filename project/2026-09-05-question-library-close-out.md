# Question-library delivery close-out

Inventory verified on 2026-09-05 against `origin/v3` at
`fbc5f4fcc2ffa1c8d25695679823134985c5a8d8`. This records source delivery,
not deployment or production acceptance.

## Review and merge

1. **Done — verify the delivered library stack.**
   [Activity guidance](https://github.com/uzh-bf/klicker-uzh/pull/5714),
   [card clarity](https://github.com/uzh-bf/klicker-uzh/pull/5715),
   [wizard recovery](https://github.com/uzh-bf/klicker-uzh/pull/5716),
   [element onboarding](https://github.com/uzh-bf/klicker-uzh/pull/5717),
   [content scanning](https://github.com/uzh-bf/klicker-uzh/pull/5718),
   [status and empty states](https://github.com/uzh-bf/klicker-uzh/pull/5719),
   and [search/recovery](https://github.com/uzh-bf/klicker-uzh/pull/5720)
   are merged. The top merge `86fc70c77f756827d55ea9d0afc5cac3344630cf`
   is an ancestor of current `origin/v3`.
2. **Done — close the superseded wizard draft.**
   [The earlier wizard PR](https://github.com/uzh-bf/klicker-uzh/pull/5546)
   is closed, with live readback `2026-09-05T11:30:29Z`.
   Its successor is the merged activity-guidance layer above. Branches and
   worktrees were not deleted; no duplicate question-library PR remains open.
3. **Done — verify test follow-ups.**
   [Vitest discovery](https://github.com/uzh-bf/klicker-uzh/pull/5740),
   [format repair](https://github.com/uzh-bf/klicker-uzh/pull/5742), and
   [deterministic Playwright fixtures](https://github.com/uzh-bf/klicker-uzh/pull/5767)
   are merged. Fixture repair merge
   `3f798234044e7e9744ed5a6a996b7e04216c5a00` is an ancestor of `origin/v3`.

## Test evidence and deployment boundary

4. **Done — resolve the outstanding fixture-test signal.** All eight shards
   and the aggregate passed in the
   [Playwright run](https://github.com/uzh-bf/klicker-uzh/actions/runs/33869202350).
   This replaces the earlier three-passed/five-pending snapshot. The separate
   [final-review workflow](https://github.com/uzh-bf/klicker-uzh/actions/runs/33869215790)
   reports `Final review is unavailable for a closed pull request`; its actual
   review jobs were skipped. It is not a test regression or a completed AI
   review. No review pass is inferred from it.
5. **Out of scope — deployment and promotion.** Source merges and local
   browser evidence do not establish a deployed revision or production health.
   The separately owned release-verification runtime and its database remain
   untouched by this close-out.

## Decisions and retained artifacts

6. **Parked — German locale completion.** The remaining `Sharing` to `Freigabe`
   correction retains the historical roadmap's dependency condition.
   [Product spotlight](https://github.com/uzh-bf/klicker-uzh/pull/5630) and
   [Manage tours](https://github.com/uzh-bf/klicker-uzh/pull/5673) are open drafts
   owned by the separate tour workstream. Do not close or import them here.
   Resume the bounded locale check when their full chain merges, is parked,
   or its owner freezes a compatible key-level seam.
7. **Done — stop-state verification for the old task runtime.** Source path
   `/Users/rschlae/Git/klicker/klicker-uzh/trees/ux-review-question-library`
   resolves through Devsy to `rs-ux-review-question-library`, provider `docker`.
   `devsy workspace status` reports `Stopped`; host `devrouter ls --json`
   reports zero routes for that exact source path. No runtime was restarted.
8. **Retained — historical Git work.** The old task branch
   `rs/question-library-status-empty-state` has no upstream, with 130 commits
   ahead and 56 behind current `origin/v3`. Its tracked files are clean;
   the new UX review and this close-out record are local artifacts. The older
   `trees/question-library-feedback-recovery` branch has a staged roadmap
   change and three deleted generated transactional HTML files. Preserve
   these changes; ownership and disposal are not inferred. The primary `v3`
   checkout is eight commits behind and contains unrelated changes, also
   preserved. No old branch is suitable for silently replaying into the new
   stack.

Runtime deletion, if explicitly approved later:
`devrouter stop /Users/rschlae/Git/klicker/klicker-uzh/trees/ux-review-question-library --delete`.
This removes ownership-proven runtime data/caches and preserves the Git
checkout. Worktree removal is not proposed until local artifacts and staged
changes have an agreed destination. No broad Docker prune is appropriate.

## Critical path and next work

The previous roadmap is terminal under its **merged-or-parked** contract.
There is no remaining library implementation or failing fixture test to carry
into the new stack. The locale item and retained artifacts remain explicit,
not falsely marked completed or deleted.

Next: approve the separately reviewed Manage-overviews stack plan, then
implement course clarity, activity feedback/inspection and concise wizard
guidance on its clean baseline. Cleanup can be authorized independently;
it is not an implementation prerequisite.
