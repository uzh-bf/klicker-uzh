# Chat answer sources and edit-control investigation — PR 5842

Draft PR: [Chat answer source grouping](https://github.com/uzh-bf/klicker-uzh/pull/5842).

## Approval summary

Show the sources cited in an answer immediately and keep other retrieved material behind a collapsed disclosure. Preserve source numbering, previews, navigation, and historical messages. Investigate the reported near-invisible edit submit control using synthetic local messages, and repair styling only if the cause is reproduced. The language policy already applies unconditionally to all standard and custom modes; this work does not claim model compliance or change that policy.

The user approved this scope and normal implementation delivery with “proceed”, then created the task worktree. No further product decision is pending. No new dependency, provider request, production access, data model, or authorization change is included. Production browser access remains denied. Merge and deployment are separately gated.

Acceptance requires correct source grouping across actual Markdown rendering, accessible disclosure and citation navigation, reload and branch changes, plus desktop/mobile browser evidence. Button findings distinguish enabled, disabled, hover, and focus states. Complete repository checks and required reviews before publication; report capability gaps honestly.

Authority: in-scope edits, checks, local commits, ordinary task-branch push, and draft PR. Terminal: verified draft PR and explicit edit-control findings. Boundary owner: self. Pause: missing capabilities or a material scope, risk, or data-boundary change.

## Execution details

### Working context and primitive impact

Worktree: `trees/codex/chat-answer-presentation`; branch: `codex/chat-answer-presentation`; base: `v3`, verified at `e3fb9873c98a664987cc48f0ec9bbf51c9337e8a` against live GitHub metadata. The separate retrieved-chunk PR changes expanded search results; this package changes the answer's source-card grouping.

Reuse the existing message-owned source identity and rendered citation link. Only presentation changes: cited sources are visible, other retrieved sources are collapsed. Keep normalization, deduplication, the twelve-card eligibility cap, and message-local numbering unchanged. A citation is an actual rendered link resolving to a source, not a claim about everything the model used internally.

### Ownership and sequence

| Workstream | Owner | Acceptance |
| --- | --- | --- |
| Citation registration and source grouping | executor | Existing citation semantics, stable indices, correct disclosure, matching English/German labels |
| Browser regression coverage and edit-control diagnosis | main | Synthetic rendered state, navigation, reload, branch changes, enabled/disabled/hover/focus evidence |
| Language-policy verification | main | Unconditional compiler composition for every mode; no model-compliance claim |
| Integration, reviews, and delivery | main | Focused checks, repository checks/build, committed-slice reviews and final review, draft PR |

### Source grouping contract

Use the existing `CitationChip` resolution and rendering pipeline. Register only valid resolved sources, through unconditional hooks with matching cleanup and stable callbacks. Reference links use the same rendered component; raw text, code, math, ordinary link labels, and invalid indices do not register citations. Add no parser dependency or regex approximation.

Keep a message-local count for each registered index so removing one duplicate preserves remaining citations. Make registration safe under Strict Mode setup/cleanup, reset on message identity changes, and clean up replaced text parts. Avoid flashing all sources as uncited or disturbing scrolling before registration settles.

Partition only source presentation. Preserve all sources for inline preview resolution. Mixed answers show cited cards plus a collapsed nonempty “Other retrieved material” disclosure. With no citations show only the collapsed disclosure; with all sources cited omit it. Keep terminal-only mounting and bottom-follow behavior. Citation scroll/focus targets must be visible.

### Verification and review

Update existing source browser tests for the new disclosure contract. Cover duplicate citations, removal, ranges, reference links, invalid markers, code/math, multiple text parts, no citations, all citations, mixed citations, reload, branching, keyboard disclosure, and citation focus. Use synthetic fixtures only. Keep source titles/locators visible and excerpts in existing tooltips.

Run container-native chat checks and focused tests, host Playwright and agent-browser verification, then applicable repository checks and build. Do not substitute host application-toolchain execution when the managed runtime is blocked. Review staged content for secrets and personal data before committing.

After the substantive commit, run the simplifier and citation-contract slice review; then run the final reviewer on the integrated verified package. Reuse unchanged evidence. Ordinary push and draft PR follow passing gates; no ready/merge/deploy action is included.

## Progress

- The user approved the exact worktree's guarded disposable database reset, schema push, and standard reseed on 2026-09-08. All three completed successfully. No production access, merge, or deployment is authorized.
- Integrated `origin/v3` at `3f6917ecc52d606d212db5b156be502cd5c99973` because its retrieved-chunk changes overlap source presentation and its focused host launcher removes the observed fixture-restart blocker. The task branch fast-forwarded; the draft reapplied without conflicts. Recovery stash `chat-answer-presentation-pre-target-integration` is retained. No force push occurred.
- Browser acceptance passed: 18 focused source/edit tests, then the edit test with settled-opacity sampling and the grouped-source test for retained manual inspection. This covers all/no/mixed citations, duplicates, ranges, reference links, code/math exclusions, multiple text parts, reload, branch changes, disclosure keyboard interaction, citation focus/navigation, and mobile layout. Independent agent-browser desktop/mobile screenshots confirm three visible cited cards, two collapsed other sources, keyboard expansion, and no horizontal overflow. Evidence is under gitignored `project/_local/chat-answer-presentation/`.
- Edit-control diagnosis: computed text color is `lab(98.26 0 0)` on UZH-blue fill; disabled opacity is `0.5`, settled enabled/hover/focus opacity is `1`. The original immediate enabled sample caught the CSS opacity transition; the diagnostic test now waits for it to settle. All screenshots have readable Send text. No button styling change is justified by the local reproduction. No production-browser conclusion is claimed.
- Language policy is unconditionally appended by `compileSystemPrompt` for standard and custom modes, verified by a bounded explorer and main inspection. This does not prove model compliance.
- Earlier checks passed: 66 focused tests, chat typecheck, all container type/lint checks, 88 host tooling tests, formatting, diff whitespace, and bounded Opengrep (zero findings). The aggregate quality command was split because its host Devrouter check cannot run in the container. Fresh integrated verification passed: 606 Chat tests with 21 integration tests skipped; all 35 typecheck tasks and seven lint tasks; 92 host tooling tests; formatting checks. Full production build passed all 23 tasks in 1m38s. Broader Biome lint reported six pre-existing errors and one warning in unchanged thread.tsx lines; repository-native lint and formatting pass.
- Runtime recovery preserved malformed generated Next.js output in container `/tmp/chat-next-presentation-diagnostic`; regenerating it fixed typechecking. The prior build stalled after Rollup emitted three outputs and was stopped with the task runtime. The restored runtime now uses the route-free email profile for static verification after successful chat-profile browser proof. The exact runtime was subsequently stopped and verified as recorded below.
- The approved plan is committed at `9acf93071`; implementation is committed at `313bb7fe35`. Gitleaks and staged diff checks pass. The user explicitly approved a one-commit `AGENTS_SKIP_DATA_HYGIENE=1` override for translation-file false positives; the source commit used that override. Host hooks were split: application checks and build ran in the container, while identity, secret scanning, host tooling and staged checks ran on the host. Citation-contract slice review completed with no blocking findings. Simplifier completed with one suggestion to remove message-identity guards; retained to preserve the approved provider-local stale-cleanup/reset contract independently of the keyed caller. Reports are in gitignored `project/_local/reviews/`. Integrated final review completed with one low test-maintenance finding: remove one-time edit-button diagnostic instrumentation. Accepted; the existing edit-branch test was restored byte-for-byte from the target baseline, retaining its behavior assertions. Local diagnostic evidence remains. Main verified this assertion-only cleanup; unchanged source checks and reviews are reused. Ordinary task-branch push succeeded and the draft PR is published. GitHub read-back confirms the correct branch, base `v3`, open draft state and matching published head. CI is running; no merge-readiness claim is made. The approved publication terminal is reached. The final metadata commit adds the PR identifier to this plan filename; application source and verification remain unchanged.

- Final verification runtime stop succeeded. Exact-source workspace metadata remains present, route listing contains no record for this checkout, and the previously proven app container is `exited`. Database and recovery stash are retained. No deployment occurred.
