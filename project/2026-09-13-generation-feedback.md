# Clear generation status and quality feedback

## Approval summary

Generation currently announces success when it pauses for design or plan review. Generated questions can also need attention without explaining why. This package makes those existing states understandable: review notifications identify the action needed, completion notifications distinguish complete and incomplete results, and draft rows explain quality flags or a pending library save.

The user approved proceeding with this goal. This is an executable batch through implementation, focused verification, independent review, ordinary task-branch push, and draft PR delivery. Merge and deployment are separate gates. Normal element editing, keep/discard policy, generation logic, schema, and quality decisions remain unchanged. Unknown upstream flags receive a generic explanation rather than exposing raw values.

Completion requires browser proof of notification routing and quality explanations, preserved editor/save behavior, EN/DE desktop and compact captures, applicable repository checks, and a reviewed draft PR. Local runtime failures block browser proof but do not block independent source work.

## Execution details

Branch: `rs/generation-feedback`. Target: `v3-ai`, verified from merged PR #5932. Baseline: `f00e272adf40dd3cbe2c648935cde1d99727af59`. Worktree: `trees/rs/generation-feedback`. Artifact root: `project/`. Full-path package; no PR yet.

### Evidence and primitive impact

- GenerationStatusProvider treats both review gates and incomplete publication as terminal success. ElementGenerationBuild re-registers background tracking after approving or retrying.
- GeneratedElementReview already receives qualityFlags. Its attention filter also includes accepted drafts without a saved library element.
- questionGenerationArtifacts derives difficulty_review_required, difficulty_validation_failed, and manual_review_required; additional upstream flags are arbitrary bounded strings.

| Primitive | Disposition | Contract impact |
| --- | --- | --- |
| Generation build | Reuse | Display existing review, incomplete, complete, and failed states accurately; preserve transitions. |
| Generated draft review | Reuse | Explain existing flags and pending save; preserve decisions and authorization. |

No ADR or schema change is warranted: this corrects presentation of existing contracts. New state, permission, or persistence semantics reopen scope. No external research is required; installed source defines the contract.

### Ownership and slices

1. **Accurate background notifications.** Executor owns GenerationStatusProvider.tsx, EN/DE generationStatus translations, and existing Y-question-generation-review.spec.ts/fixture. Replace the boolean notification outcome with explicit complete, incomplete, review-required, and failed outcomes. Design and plan review as well as incomplete-publication approval use review messages and actionable links, not a completed success message. Preserve deduplication, removal of settled trackers, re-registration after review/retry, and graph behavior. Commit after focused checks.
2. **Explain attention.** Same executor owns GeneratedElementReview.tsx, ElementGenerationBuild.tsx, EN/DE elementGeneration translations, and existing Y-question-generation-review fixture/spec. Map the three known flags to readable localized reasons, deduplicate generic unknown fallback, show accepted-unsaved reason independently, and clarify workflow-warning label/help without changing counts. Keep reasons in the generation review surface. Commit after focused checks.
3. **Integrated proof and delivery.** Main owns runtime, browser interaction, captures, tests, integration, commit hygiene, independent review disposition, and draft PR. Sequential slices avoid shared translation/test writers.

Route: executor for settled source edits; main for cross-slice and external effects. Acceptance is the portfolio below. Planner construction by Kierkegaard confirmed the known-flag mapping, unknown fallback, accepted-unsaved distinction, and reuse of existing Y coverage. Frozen-plan round 1 requested explicit test ownership, count-separation coverage, and risk review; all accepted. Round 2 APPROVED.

### Test portfolio

| Risk | Obligation | Evidence seam |
| --- | --- | --- |
| Review gate falsely claims completion; duplicate polling notifications | Extend existing Y spec/fixture with synthetic query-response interception and browser-start event | Real provider with synthetic query responses; review states vs complete/incomplete/failure; deduplicate polling; re-register same job after successful approval and never after failed approval |
| Known/unknown flags are opaque or unsafe | Extend existing Y fixture/spec | Semantic reason nodes, known categories, one unknown fallback; no prose assertions |
| Accepted-unsaved reason missing; policy accidentally changed | Extend existing accepted-unsaved Y case | Existing recovery and keep behavior, canonical editor |
| Warning count confused with quality flags | Extend existing Y fixture/spec | Differing workflow-warning and draft-flag values; independently rendered counts and unchanged attention filtering |
| Copy/layout unusable | No new automated content test | Real EN/DE desktop and compact screenshots plus interaction checks |

Use only synthetic local data. Container-dependent checks run in the exact task runtime; Playwright runs from host. Preserve existing coverage, replace only in-scope prose-pinning assertions. No production code solely for tests. Screenshots remain ignored artifacts and are published to the existing project with reviewed audience-safe content.

### Gates and terminal condition

Run simplification after substantive committed slices, combined applicable final review after verification, and exact diff/secret checks before commits. Run one slice reviewer alongside the simplifier for each committed slice, covering notification lifecycle and review-state correctness risks. No cross-system contract changes are planned. Stop the exact local runtime and verify release at terminal or genuine pause. Full completion requires draft PR plus proof; missing browser evidence remains explicit.

## Progress

- Implemented S1 (`ecd208c73`) and S2 (`da0d937bd`). Both slices independently simplified and correctness-reviewed. No implementation defects found. The S1 missing real approval test is now covered. S2 suggested exact prose assertions were rejected under the repository content-testing rule; mapping inspected directly and in localized UI.
- Four Chromium regressions passed (1.1m): canonical editor/save recovery, quality reasons and independent warning counts, all notification outcomes, and approval success/failure rearming. Full container build passed all 26 tasks (2m12s). Manage typecheck/lint, Biome, Playwright TypeScript/Prettier passed. Staged source/test scans found no secrets.
- Real EN/DE desktop and compact captures produced. Existing horizontal-scroll table remains in use; reason column verified reachable. Pointer toast dismissal passed all four variants. Settled notification recapture underway after correcting the harness offset assumption from 16px to the observed 12px.
- Next: finish screenshot gallery, stop exact runtime, integrated final review, task branch push and draft PR. No PR yet; no deployment or merge performed.
