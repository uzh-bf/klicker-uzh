# Question-generation UX audit and roadmap

- **Scope** — desktop lecturer flow for (1) generation configuration, (2) design review, (3) plan review, (4) processing and progress, (5) completed generated-question review, (6) failure recovery, and (7) the canonical Question Pool element editor used as the comparison surface. Mobile and responsive redesign are explicitly excluded. English was inspected live; German copy is included as an implementation check but was not audited live.
- **Method** — single-evaluator heuristic and visual review of the authenticated staging Manage app at `823 × 863` CSS pixels with device-pixel ratio `2`, using Codex in-app Browser `26.825.32147`. The source pass used clean worktree `trees/rs/question-generation-ux-review` at `origin/v3-ai@bedc6a8556b07e2603d7c34178cb1dbe06e7891c`. The browser/source equivalence relies on the deployment receipt that identified this revision before the audit; this pass did not repeat a cluster revision readback. The core journey was first exercised without recording, then configuration, completed review, failure, and the canonical Element modal were captured on the second pass. Design review, plan review, processing, and finalizing were exercised but could not be recaptured from the terminal build. Severities are therefore single-rater provisional; a single evaluator typically finds only part of the total usability problem set.
- **Frameworks** — `ux-heuristics`: Nielsen/Krug quick diagnostic, severity `0–4`, score from failed diagnostic rows. `refactoring-ui`: hierarchy, spacing, typography, color, depth, and layout; score from eight binary diagnostic rows. Accessibility conformance was not in scope and was not scored.
- **Evidence** — local screenshots under `/private/tmp/klicker-question-generation-ux-audit-2026-08-29/`, never committed. Findings reference shots `01–04`; the prose, state, viewport, and source anchor remain the reproducible record.
- **Prior work integrated** — [source-filename contract plan](./2026-08-29-qg-source-filename-contract-plan.md), [KB management UX plan](./2026-08-24-pr-5540-kb-management-ux-plan.md), and in-flight [PR #5635](https://github.com/uzh-bf/klicker-uzh/pull/5635). Ruled decisions D1–D4 below are not reopened.
- **Authority** — on 2026-08-29, the user approved R0 execution as a goal through local implementation, repository-native verification, local commits, a normal push, a draft PR stacked on [PR #5635](https://github.com/uzh-bf/klicker-uzh/pull/5635), exact-head CI/review readback, and the Gate 3 review package. The same approval includes basing the implementation branch once on #5635's refreshed exact head, or on `v3-ai` if #5635 lands first. It does not authorize changes to #5635, force-pushes, marking the new PR ready, merging, deployment, staging or production mutations, provider-backed generation, cleanup, or deletion.

## Execution contract

- **Goal:** deliver R0 as one coherent desktop lecturer workflow: scan generated results, review one item in the canonical Element editor, keep exactly that edited item atomically, discard or restore unsaved items, and inspect original source metadata.
- **Execution owner:** this task is the execution orchestrator. It owns implementation, integration, verification, specialist reviews, progress, commits, draft publication, and stack readback through the terminal condition.
- **Boundary owner:** self.
- **Terminal:** one fully implemented and verified draft PR is stacked above #5635, its whole-branch description and browser evidence are current, exact-head CI has started, and the Gate 3 package is ready for the user's open/revise/leave-draft decision.
- **Pause:** stop only if Flashcard requires more than one additional engineering day, the contract needs a migration or new primitive, #5635 changes the same behavior materially, local and remote stack topology diverge, or verification requires a new live-data, provider, secret, deployment, or cluster authority.

### Plan identity and stack topology

- **Plan:** `project/2026-08-29-question-generation-ux-audit-and-roadmap.md`.
- **Implementation branch:** `rs/question-generation-review-inbox` in `trees/rs/question-generation-ux-review`.
- **Ultimate target:** `v3-ai`; refreshed at `bedc6a8556b07e2603d7c34178cb1dbe06e7891c` before execution.
- **Dependency layer:** [PR #5635](https://github.com/uzh-bf/klicker-uzh/pull/5635), branch `feat/kb-element-generation-followups`, refreshed at `8971f63b9e5df9fba096a9b6bac34fa881feb3cd` before execution.
- **New layer:** one GitHub stack layer above #5635. Work package: the complete R0 generated-question review-and-keep workflow. Reviewer audience: GraphQL/data-integrity and Manage UX maintainers. Attention: judgment-heavy. Activation: complete and backward-compatible; the legacy build-wide save mutation remains available.
- **Size signal:** approximately 700–1,100 human-authored lines across 15–22 files, plus GraphQL generated output. This exceeds the review-size diagnostic but remains one work package because the atomic mutation, source projection, inbox, canonical editor adapter, and deterministic journey jointly deliver one independently functional lecturer decision path; splitting by tier would spend another review layer on an inert API that has no user outcome by itself.
- **Follow-up stacks:** R1 generation-stage clarity and R2 high-volume evidence/bulk actions remain outside this stack.

### Delegation map

| Workstream | Slices | Owner | Dependency and handoff | Acceptance boundary |
| --- | --- | --- | --- | --- |
| Contract and topology | S0, S1 | main | Freeze the approved plan, adopt #5635 once, then implement the data-integrity seam before UI consumption. | Plan commit; GraphQL service tests and code generation pass. |
| Lecturer review UI | S2, S3 | executor, integrated by main | Starts from committed S1; executor receives only settled UI paths and cannot publish or change product contracts. | Manage check passes; all four types render through the canonical form contract. |
| Proof and delivery | S4 | main | Starts from the integrated UI; owns deterministic fixture, docs, browser evidence, final review, and draft stack publication. | Focused E2E/browser matrix, repository checks, final review, draft PR and stack readback. |

### Feature-wide test portfolio

| Consequential behavior or risk | Existing evidence | Obligation | Primary seam and distinct failure | Owning slice |
| --- | --- | --- | --- | --- |
| Keep persists exactly the visible edited draft once | Build-wide save and decision service tests | Add new | GraphQL service integration: exact payload, one-draft scope, exact retry idempotency, and no duplicate Element | S1 |
| Ownership, stale revision, type mismatch, and saved-state immutability remain enforced | Existing generation-build authorization/revision tests | Extend existing | GraphQL service integration: unauthorized or stale requests cannot persist or alter a saved decision | S1 |
| Original source identity stays strict while labels use the pinned snapshot | Source-filename contract tests | Extend existing | GraphQL build read model: citation resource ID resolves title/kind/pages without changing `${resourceId}.md` validation | S2 |
| Twenty results stay scannable and state actions remain reachable | No deterministic completed-build UI fixture | Add new | Playwright fixture/journey: list density, filters, open, discard, restore, keep, reload, and linked Element | S2–S4 |
| SC, MC, KPRIM, and Flashcard use canonical labels, validation, preview, and Review default | Existing Question Pool form behavior | Extend existing | Manage browser proof and focused type cases through the generated-value adapter | S3–S4 |
| English and German desktop copy stays paired | Repository i18n checks | Extend existing | i18n pair check plus browser matrix at `823 × 863` and `1440 × 900` | S4 |

### Progress

- **Previous receipt — 2026-08-29:** draft PR [#5667](https://github.com/uzh-bf/klicker-uzh/pull/5667) was published through `911677bdb`; its checks were green except Playwright shard 8 and the status mirror. Trace inspection identified a stale discard-selector expectation. The earlier 12/12 service-test and runtime-startup notes are superseded below.
- **Status — 2026-08-30:** the same-reviewer correction input was local head `00400b1b8`. The resulting persisted-payload assertions and this superseding receipt are present in the current branch tip. Publication remains blocked because the host cannot resolve `github.com` for a normal push; the GitHub API is reachable. The remote draft remains at `911677bdb` until a normal push succeeds.
- **Completed:** all four generated types use the canonical editor; one edited draft is kept atomically; a changed retry payload is rejected while an exact retry returns the linked Element; original source metadata, learning-design metadata, quality attention, and update time are visible in the inbox; Discard and Restore stay reversible for unsaved drafts; and deterministic coverage now opens the saved Element and persists SC, MC, KPRIM, and Flashcard through the canonical adapter. Pinned Node 24 evidence is 13/13 focused service tests, GraphQL code generation/types pass, Manage type generation/types pass, Playwright TypeScript pass, and the full pre-commit suite passes with 29/29 type tasks, 7/7 lint tasks, 9/9 host-policy tests, formatting, syncpack, schema-sync, repository guards, and gitleaks.
- **Review evidence:** the correction slice review found no issues. The simplifier supplied two accepted reductions. The integrated final reviewer found seven items; `915fc3dc2` addresses the retry-integrity issue, learning-design/quality/updated metadata, saved-Element continuation, stable source-link hook, and duplicate assertion. The same-reviewer correction pass then found that MC, KPRIM, and Flashcard persistence assertions did not yet verify their visible edited payloads and that the Progress receipt was stale. The current tip edits each type-specific payload through the browser form, verifies its persisted content and representative option semantics, and supersedes the receipt. No further reviewer pass is scheduled under the correction budget.
- **Stack evidence:** #5635 remains the immutable dependency at `8971f63b9e5df9fba096a9b6bac34fa881feb3cd`. Native stack metadata places #5667 above it, while the forge base still needs exact readback and any required correction after GitHub connectivity recovers. No merge, rebase, force-push, ready transition, or dependency edit is authorized.
- **Runtime evidence:** `devrouter ensure` reached the task-owned workspace but failed because Azurite could not bind `127.0.0.1:10003`; the port is published by unrelated container `default-rs-f3e74-azurite-1`. The managed transition has ended, but the exact task workspace still reports owned provider and routes with unknown runtime state, and its managed stop is blocked because devrouter cannot determine the lifecycle-lock process identity. No process, route, or unrelated container was interrupted. Browser verification in English and German at `823 × 863` and `1440 × 900` remains blocked until devrouter can stop and restart the exact task runtime safely.
- **Remaining:** publish the current branch tip by normal push, refresh the whole-branch PR body and stack base/readback, disposition review threads, collect exact-head CI, and run the desktop browser matrix when GitHub DNS and the task runtime lifecycle recover.

### Slice list

- **S0 — freeze the approved execution package.** Route: main. Acceptance: branch descends from #5635's exact head, the plan is the first local commit, and stack ownership/exclusions are recorded. Commit: `docs(project): add question review workflow plan`.
- **S1 — make one edited Keep atomic.** Route: main. Execution-tier skip reason: data-integrity and cross-system seam. Add the per-draft Keep service/schema/operation, preserve authorization, revision fencing, type validation, Review status, and exact-retry idempotency, and extend focused GraphQL tests. Acceptance: GraphQL generation/tests/check pass and generated artifacts are current. Commit: `feat(kb): keep generated elements atomically`.
- **S2 — show a source-aware result inbox.** Route: executor. Extend the build read model with pinned original source title/kind, then replace stacked forms with the compact list, counts, filters, state chips, and row actions while preserving legacy accepted-unsaved recovery. Acceptance: GraphQL/Manage checks pass and deterministic 20-row data renders without internal `.md` labels. Commit: `enhance(manage): add generated question review inbox`.
- **S3 — review all four types in the canonical editor.** Route: executor. Adapt generated SC, MC, KPRIM, and Flashcard values into `ElementEditForm`; add only generated-review sources and footer actions; keep normal validation, preview, tags, scoring, and Status. Acceptance: all four types use canonical labels and Keep/Discard/Close produce the ruled lifecycle. Commit: `enhance(manage): reuse element editor for generated questions`.
- **S4 — protect and publish the workflow.** Route: main. Add the deterministic Playwright fixture/journey, update `docs/domain-model.md`, `docs/graphql-api-layer.md`, `docs/frontend-conventions.md`, affected skills, and one new wiki log; run codegen, focused tests, checks/build, and the EN/DE desktop browser matrix; complete simplifier/slice/final reviews; publish one draft stacked PR and refresh its whole-branch description. Acceptance: exact committed package and browser evidence satisfy the finish gate. Commit: `test(manage): cover generated question review workflow`, with review corrections committed separately when material.

## How to work on this

- Package R0 as one cohesive PR stacked on [PR #5635](https://github.com/uzh-bf/klicker-uzh/pull/5635)'s refreshed exact head. Do not expand #5635 without its owner's agreement. If #5635 lands first, branch from the resulting `v3-ai`. Put before/after screenshots and the terminal state matrix in the PR body.
- Use a repo-local worktree and the repository's `devrouter ensure .` recipe. Run Node and pnpm checks inside the container. Use the mandatory `agent-browser` workflow for the UI proof.
- The list, modal, decision, and persistence path should be verifiable with deterministic synthetic build data. A real generation run needs a published graph and configured model/provider access; ask the maintainer for the approved staging path and never commit keys or copy them into prompts.
- Repeat browser checks at `823 × 863` and a standard desktop width such as `1440 × 900`. Mobile is not a release gate for this package.
- Switch language under **Settings → Language** (`data-cy="language-select"`) and verify English and German. The audit itself captured English only.
- Reproduce each state from its finding rather than depending on the local screenshots. A terminal generation build cannot return to either review gate; use deterministic test data or a separately approved synthetic run instead of spending model budget merely to capture a screenshot.
- Keep the provider's `${resourceId}.md` source identity in backend evidence validation. The UX fix changes lecturer-facing labels, not graph-artifact identity.

## Evidence matrix

| Surface | State | Viewport and locale | Evidence status |
| --- | --- | --- | --- |
| Configuration | Knowledge base, source scope, Element type, Bloom levels, and settings populated | `823 × 863`, English | Captured as shot 03 and code-matched. |
| Design review | Waiting for design review | `823 × 863`, English | Exercised in the first pass; terminal build prevented second-pass capture. Code anchor retained. |
| Plan review | Waiting for plan review | `823 × 863`, English | Exercised in the first pass; terminal build prevented second-pass capture. Code anchor retained. |
| Processing | Preparing, generating, and finalizing | `823 × 863`, English | Exercised in the first pass; not conclusively recaptured or timed. |
| Generated results | Completed, one undecided Single Choice result | `823 × 863`, English | Captured as shot 01 and code-matched. |
| Failure recovery | Failed, zero of three generated | `823 × 863`, English | Captured as shot 04 and code-matched. |
| Canonical Element editor | Existing Single Choice Element | `823 × 863`, English | Captured as shot 02 and code-matched. |

German and a wider desktop rendering were not audited live. They are explicit R0 verification obligations rather than implied coverage.

## Delta vs. prior work

### Fixed since the last audit and confirmed live

No earlier dedicated question-generation UX audit was found, so there is no prior findings register to close here.

### Still open or in flight

- [PR #5635](https://github.com/uzh-bf/klicker-uzh/pull/5635) is open and non-draft at `8971f63b9e5df9fba096a9b6bac34fa881feb3cd`. GitHub reports raw mergeability `MERGEABLE`, meaning conflict-free only; the PR is not ready because its exact-head rollup still contains a failed hosted Playwright shard and status mirror. It adds background/global generation status and improves configuration. It does not replace `GeneratedElementReview.tsx`, add per-item persistence, show saved-element links, or resolve the source-display contract, so this audit does not treat it as landed.
- The general KB management redesign is covered by the earlier KB UX plan. This audit does not re-report its table, navigation, or resource-addition findings.

### Ruled decisions not reopened

- **D1 — strict source identity:** provider evidence continues to use the canonical `${resourceId}.md` graph artifact. Human-facing labels must resolve the original source metadata instead of weakening or changing that contract.
- **D2 — human decision before persistence:** generated content remains a review draft until the lecturer explicitly keeps it. Generation never creates ordinary Elements automatically.
- **D3 — graph and provider lifecycle:** this redesign does not change graph generation, question-generation providers, review-gate dispatch, quota, or model configuration.
- **D4 — desktop first:** mobile and responsive redesign are outside this roadmap.

## Primitive impact

| Product primitive | Disposition | Contract delta | Affected compositions and consumers | Evidence or ruling |
| --- | --- | --- | --- | --- |
| Generated Element draft | Extend | Add one atomic, per-draft **Keep** operation. `OPEN`, `ACCEPTED`, `REJECTED`, revision fencing, and `savedElementId` remain the lifecycle record. | Generation result review and persistence | `GeneratedElementDraft` already owns editable content, decision, citations, revision, and saved link. No new table or durable state is needed. |
| Element | Reuse | A kept result becomes one ordinary owned Element and opens in the existing editor. No generated-only Element subtype is introduced. | Question Pool, activities, sharing, later edits | Current save helpers already create ordinary Elements. Preserve the existing default `REVIEW` status unless product explicitly changes it; the canonical modal may expose the normal Status control. |
| Source citation | Compose | Resolve a citation's `resourceId` to the graph build's original title and source kind for display. Keep `sourceFile` and chunk IDs internal. | Generated-question review and provenance | `KBGraphBuildSource` already stores title, type, URL/blob identity. The current draft query exposes only resource ID, `.md` filename, pages, and chunk IDs. |
| Element-generation build | Reuse | Render its existing states as lecturer-facing phases and decision counts. Do not invent a second job lifecycle. | Configuration, gates, progress, results | Build status, reviews, counts, errors, and timestamps already exist. |

No new product primitive is required. The canonical Element editor is a delivery surface to reuse, not another product primitive.

## Findings

Severity: `0` none · `1` cosmetic · `2` minor · `3` major · `4` catastrophic.

### Severity 4 — catastrophic

None. The flow remains technically completable.

### Severity 3 — major

| ID | Finding | Evidence |
| --- | --- | --- |
| F2 | **The decision model can silently discard visible edits.** On the completed desktop review, a lecturer can change local form values and then click **Accept**. That action changes only the decision; its refetch then reinitializes the form from the last server-saved draft. The later build-wide **Save to library** persists that older server value. Three unrelated actions—Save changes, Accept, and Save to library—therefore split one expected decision across multiple failure points. This violates error prevention, visibility of system status, and consistency. Root cause: local editable state and separate mutations in `apps/frontend-manage/src/components/elements/generation/GeneratedElementReview.tsx:24`, decision actions at `:291`, draft save at `:348`, and build-wide save at `:382`. | Shot 01; action sequence exercised and code-confirmed |
| F1 | **Stacked full forms make batch review unscannable.** The configured default is several generated items and the allowed range reaches 20, yet every result renders its full title, prompt, context, choices, explanation, flags, citations, and four actions before the next item. A lecturer cannot compare the batch or see how much work remains without scrolling through every field. This violates flexibility and efficiency, recognition over recall, and minimalist design. Root cause: the full card at `GeneratedElementReview.tsx:110` and `.space-y-5` card stack at `:449`. | Shot 01 |
| F3 | **Generation introduces a second, weaker Element editor.** The generated card uses “Internal name,” “Prompt,” plain textareas, and bespoke choice inputs, while the established modal uses “Element title,” “Question,” rich text, scoring, tags, Status, answer options, Preview, and Comments. A lecturer must learn different labels and cannot evaluate the generated question in the same representation used after persistence. This violates consistency and standards and match with the rest of the app. Root cause: `GeneratedElementReview.tsx:139` versus the reusable form surface in `apps/frontend-manage/src/components/elements/manipulation/ElementEditForm.tsx:115` and `:176`. | Shots 01, 02 |
| F8 | **The evidence is not inspectable enough for the mandatory human review.** Results collapse provenance to “1 source citation,” while configuration exposes the internal UUID `.md` transport filename. The draft query has pages and chunk IDs but no original source title or type, even though the graph-build source snapshot stores both. A reviewer cannot answer “which original source supports this question?” without leaving the flow. This violates recognition over recall, match to the real world, and the trust purpose of citations. Root cause: count-only rendering at `GeneratedElementReview.tsx:280`, internal filename rendering at `ElementGenerationConfigure.tsx:367`, and the citation read model in `packages/graphql/src/graphql/ops/FElementGenerationBuild.graphql`. | Shots 01, 03 |
| F7 | **Failure recovery does not provide a viable next action.** A failed `0 of 3` build renders `4%`, a raw evidence-mismatch sentence, and `ARTIFACT_INVALID`. **New generation** is available, but it can repeat the same technical failure because the screen neither explains the cause nor distinguishes a retryable setting from a system fault. This blocks recovery from that build and violates error recovery and status visibility. Root cause: the hard `4` percent floor at `ElementGenerationBuild.tsx:88` and raw error rendering at `:251`. | Shot 04 |

### Severity 2 — minor

| ID | Finding | Evidence |
| --- | --- | --- |
| F4 | **A kept item has no useful terminal continuation.** The backend exposes `savedElementId` and `savedAt`, but the results UI only shows a page-level success count. It neither marks the row as kept nor offers **Open Element**, so the lecturer must search the Question Pool and visually match content. This violates system-status visibility and recognition over recall. Root cause: `GeneratedElementReview.tsx:430` and the unused field exposed at `packages/graphql/src/schema/elementGeneration.ts:593`. | Code; completed page captured as shot 01 |
| F5 | **Machine vocabulary competes with lecturer language.** Raw stages, internal `.md` filenames, raw quality flag keys, technical error codes, and abbreviations appear as primary content. These values are useful for diagnostics but not as the default decision surface. This violates match between system and real world and aesthetic minimalism. Root cause: `packages/i18n/messages/en.ts:2392`, `:2432`, and direct flag rendering at `GeneratedElementReview.tsx:274`. | Shots 01, 03, 04 |
| F6 | **Both review gates offer approval or terminal rejection, but no settings-revision path.** If a lecturer spots a bad source scope, count, Bloom level, or difficulty, “Reject generation” does not explain that the current build ends or help recreate the configuration. A literal Back action would also be unsafe because the external lifecycle cannot rewind. This violates user control and freedom. Root cause: `apps/frontend-manage/src/components/elements/generation/ElementGenerationReviewGate.tsx:173`. | Code; states exercised, not recaptured |

### Severity 1 — cosmetic

None. The visible inconsistencies are workflow or comprehension issues rather than isolated polish defects.

### Strengths — hold the line on these

The generation has a stable build URL and can be left and resumed. The build shows generated, unresolved, warning, and retry counts, and polling stops at decision states. Human review happens before ordinary Element persistence. The data model already keeps the original and current draft, optimistic revision, explicit decision, citations, provenance, and saved Element link. Saved decisions are immutable, which protects provenance. The existing Element editor already supplies the mature naming, validation, scoring, rich-text, and preview surface this redesign needs. The backend also owns the original graph-source snapshot, so lecturer-friendly citation labels do not require a migration or relaxed evidence validation.

## Scores

### UX heuristics — 2/10

Diagnostic arithmetic:

- Site/page identity: pass.
- Main action obvious: fail, major (`F2`), `−2`.
- Navigation clear: pass.
- Search visible: not applicable to this focused workflow; no deduction.
- System shows what is happening: fail, minor (`F4`, `F7`), `−1`.
- Error messages are helpful: fail, major (`F7`), `−2`.
- Users can undo or go back: fail, minor (`F6`), `−1`.
- Works without hover: pass.
- Interactive controls are labeled: pass.
- Nothing causes a “huh?” pause: fail, major (`F1`, `F3`, `F5`, `F8`), `−2`.

`10 − 2 − 1 − 2 − 1 − 2 = 2`.

The `≤2` band is consistent because failure recovery is blocked for a failed build and five diagnostic rows fail. Successful builds remain technically completable, so no severity-4 finding applies to the whole workflow.

**Gap to 10:** `F2`, `F1`, `F3`, `F8`, `F7`, `F4`, `F5`, `F6`.

### Refactoring UI — 6/10

Five of eight diagnostic rows pass: grayscale, white space, spacing scale, text-width constraint, and contrast. Three fail: hierarchy (`F1`, `F2`, `F3`), label de-emphasis (`F3`, `F5`), and appropriate elevation (`F1`, where every large card competes as a raised surface).

`round(5 / 8 × 10) = 6`.

The `6–8` band is consistent: the visual system is not broken, but the result screen's information architecture and competing surfaces keep it from reading like the rest of the app.

**Gap to 10:** `F1`, `F3`, `F2`, `F5`, `F8`.

## Target workflow

The proposed direction is correct: generation results should behave like an inbox of candidate Elements, and the normal Element editor should be the only detailed editing surface.

```text
Configure → Review coverage → Review question plan → Generate → Review results
                                                               │
                              Needs review ── Review and edit ──┤
                                                               ├─ Keep → Kept → Open Element
                                                               └─ Discard → Discarded → Restore
```

### Results list

Use a desktop data table or dense list with these columns:

| Column | Contents |
| --- | --- |
| Decision | **Needs review**, **Needs attention**, **Kept**, or **Discarded**. A transient save error does not create another durable state. |
| Type | Single choice, Multiple choice, KPRIM, or Flashcard; do not rely on SC/MC abbreviations alone. |
| Element | Element title plus a one-line question/front preview. |
| Learning design | Bloom level, target difficulty, and a friendly “Needs attention” flag when quality review is required. |
| Sources | Original source title and kind, plus page range when available. Never show `${resourceId}.md` or chunk IDs by default. |
| Updated | Last draft decision/edit time. |
| Actions | **Review and edit** for open rows, **Open Element** for kept rows, and **Restore** for discarded rows. Duplicate can remain in an overflow menu. |

The list header shows counts and filters for Needs review, Needs attention, Kept, and Discarded. Do not retain a page-level “Save accepted to library” action in the normal path.

Map the existing lifecycle explicitly:

- `OPEN` → **Needs review**.
- `REJECTED` with no saved Element → **Discarded**. It remains a recorded decision but is reversible through **Restore** while unsaved.
- legacy `ACCEPTED` with no `savedElementId` → **Needs attention: accepted but not saved**. The action is **Review and keep**; the new UI must not treat it as Kept.
- `ACCEPTED` with `savedElementId` → **Kept**. This is terminal in the generated-draft workflow; later lifecycle changes happen on the ordinary Element.

### Canonical review modal

Open the existing full-screen Element form with generated values adapted to its normal fields. Use **Element title**, **Status**, **Tags**, **Question**, **Explanation**, **Sample Solution and Scoring**, **Answer options**, and **Preview**. Add a read-only **Sources** section that maps citations to original source metadata.

The footer has three actions:

- **Close** — leave the generated draft undecided; warn before losing local edits.
- **Discard** — set the existing decision to `REJECTED`, close the modal, and leave the recorded row visible with **Restore**. Restoring returns it to `OPEN` while it remains unsaved.
- **Keep Element** — in one transaction, validate the visible canonical form, persist exactly one normal Element, set the draft to `ACCEPTED`, record `savedElementId`/`savedAt`, and close. The row becomes **Kept** and exposes **Open Element**.

The canonical Status control should remain available. To avoid silently changing deployed behavior, default a generated Element to **Review**, matching the current save helpers at `packages/graphql/src/services/elements.ts:47` and `:115`. Changing that default to **Draft** is a product decision, not a styling fix.

### Minimum backend contract

Add one targeted atomic keep mutation rather than orchestrating update, accept, and batch save from the browser. Its input identifies the generated draft, carries the expected revision, and carries the canonical Element form payload. Within one transaction it must:

1. authorize and lock the completed build and unsaved draft;
2. reject a stale revision or incompatible type;
3. validate and create exactly one ordinary Element through existing manipulation logic;
4. set `ACCEPTED`, `savedElementId`, and `savedAt`; and
5. return the existing saved Element on an exact retry instead of creating a duplicate.

The existing build-wide save mutation can remain for compatibility, but the new UI should not depend on it. Discard and Restore can reuse the current decision mutation. Add original display metadata to the build read model from `KBGraphBuildSource`; no migration is needed.

Source snippets are not available in the current draft or graph-source read model. Title, source kind, and page range are the MVP. A snippet feature is a later provider/evidence-read contract with separate access, size, and missing-evidence rules.

### Resolved implementation decisions

- **Type coverage — approved 2026-08-29:** apply R0 to SC, MC, KPRIM, and Flashcard together because the current page explicitly presents one shared workflow and `GeneratedElementReview` owns all four. If a focused implementation spike shows Flashcard adds more than one engineering day, pause before splitting it and preserve the current Flashcard path meanwhile.
- **Default Element status — approved 2026-08-29:** preserve the current **Review** default and allow the normal Status field. Switching generated Elements to Draft would be a later explicit product change.
- **Citation excerpts — roadmap disposition:** title, source kind, and page range remain the R0 contract. Excerpts are not release-blocking without a bounded evidence-read contract.

## Roadmap

### R0 — one coherent review-and-keep path

Estimate: **3–5 engineering days** if `ElementEditForm` accepts generated initial values through a small adapter; **5–7 days** if its form body must first be extracted from its current modal/mutation wiring.

1. **Make Keep atomic (`F2`, `F4`).** Add the per-draft keep mutation in the GraphQL schema/service, return the linked Element ID, and preserve current authorization, revision fencing, type validation, and Element status behavior. Keep the existing database schema. **Check:** edit one answer and title, keep that row, reload, and open the linked Element; it contains the visible edits. A second identical Keep returns the same Element. Another accepted/open draft is not persisted.
2. **Replace stacked forms with the result inbox (`F1`, `F4`).** Rework `GeneratedElementReview.tsx` into the compact table/list, counts, filters, status chips, and row actions described above. Keep discarded rows visible and let Restore return an unsaved row to Needs review. **Check:** with 20 synthetic results at `823 × 863` and `1440 × 900`, the lecturer can identify every state and reach any row without scrolling through another row's form.
3. **Use the canonical Element editor (`F2`, `F3`).** Open `ElementEditForm` with an adapter for SC, MC, KPRIM, and Flashcard. Add only the generated-review footer and source section; reuse canonical validation, scoring, labels, rich text, and preview. **Check:** all four types render with the same labels and preview as Question Pool, and Keep/Discard/Close have the documented effects.
4. **Expose original source metadata (`F5`, `F8`).** Extend the build GraphQL view with source title and kind resolved from the pinned graph-build snapshot; map citation resource IDs in the modal and list. Keep `.md`, chunk IDs, and raw quality codes under technical diagnostics only. **Check:** a PDF-backed source reads as a document and a URL-backed source reads as a website; neither default surface shows a UUID `.md` name.
5. **Protect the seam.** Extend GraphQL service tests for exact edited payload, ownership, stale revision, type mismatch, idempotency, one-draft scope, legacy accepted-unsaved recovery, discard, restore, and saved-decision immutability. Add `playwright/util/fixtures/elementGeneration.ts`, using the existing `getPrisma()` fixture seam to create and clean up synthetic owned KB, graph-build, completed generation-build, and draft rows without a provider call. Use it for the 20-row density check and one hosted journey: list → edit → keep → reload → open Element, plus list → discard → restore. Run GraphQL code generation, affected package tests/checks, root formatting/types, and required build checks. Update `docs/domain-model.md` with the atomic generated-draft persistence and human-facing source-display contract. **Check:** the exact PR head is green and the browser evidence covers English and German at both desktop viewports.

### R1 — make generation stages understandable and recoverable

Estimate: **1–2 engineering days** once R0 and #5635 are stable.

1. **Replace raw stages and fake percentages (`F5`, `F7`).** Show a discrete stepper—Configure, Review coverage, Review question plan, Generate, Review results—and use indeterminate progress until the provider reports a real measurable unit. Translate stage/error codes to lecturer language; place raw codes under **Technical details**. **Check:** a failed `0 of 3` build shows no positive percentage and states what the lecturer can do next.
2. **Add a safe settings-revision path (`F6`).** At both review gates, replace “Reject generation” with **Edit settings and restart**. Explain that the current build ends, then prefill a new configuration rather than attempting to rewind the external workflow. Keep **Approve and continue** as the single primary action. **Check:** from either gate, the lecturer reaches a prefilled configuration and the old build remains terminal and traceable.
3. **Reduce gate duplication (`F6`).** Keep both backend gates for the MVP, but render them through the same step layout and user vocabulary. Reassess whether the design gate can become informational only after provider, cost, and failure behavior are measured; do not remove it as a UI-only change. **Check:** the two screens answer different questions—coverage first, concrete question plan second—without repeating instructions or technical module IDs.

### R2 — improve high-volume review after the MVP

Estimate: **2–4 engineering days**, conditional on observed lecturer demand and a settled evidence-access contract.

1. **Add source excerpts only with a bounded contract (`F8`).** Retrieve a short excerpt only from the citation's pinned resource/page/chunk, enforce ownership and size limits, and show a clear unavailable state. **Check:** the excerpt matches the cited page/chunk and never falls back to unrelated content.
2. **Add bulk actions only after per-item behavior proves stable (`F1`).** Consider multi-select Keep or Discard for experienced lecturers, but keep Review and edit per row. **Check:** bulk Keep validates every selected item, reports partial failures per row, and never changes unselected drafts.
3. **Run a three-lecturer usability pass.** Give each person a six-item and twenty-item review task, measure time-to-first-decision, wrong-action recovery, and whether source evidence is used. Merge findings by affinity rather than averaging severities. **Check:** every participant can explain Needs review, Kept, Discarded, and Open Element without prompting.

## Explicitly not in this roadmap

- Mobile or responsive redesign; Manage desktop is the agreed priority.
- Graph generation, provider contracts, model prompts, quota, or deployment.
- Relaxing `${resourceId}.md` evidence matching. Only the human-facing label changes.
- Automatic Element persistence before a lecturer decision.
- Source snippets as an MVP blocker; the current read model does not carry them.
- A new database migration or generated-only Element subtype.
- Removing either provider review gate before its lifecycle, cost, and recovery implications are separately assessed.

## Planning-stage specialist

The native planner route failed before work because the runtime paired it with the GLM executor model and an unsupported effort. One `generic-continuity` GPT-5.6 Sol xhigh pass returned `DONE_WITH_CONCERNS`. The audit accepts its atomic per-draft Keep contract, source-metadata MVP, deferred snippets, and stack-on-#5635 recommendation. It does not accept the proposed silent switch from current `REVIEW` persistence to `DRAFT`; the roadmap preserves the deployed default and exposes the canonical Status control until the product owner rules otherwise.

## Environment notes — not app UX

- The repository primary checkout is on unrelated branch `docs/chatbot-hitl-config-roadmap`, one commit ahead and 126 commits behind `origin/v3`, with unrelated working changes. It was not integrated or modified. This audit used the clean task worktree at exact `bedc6a8556b07e2603d7c34178cb1dbe06e7891c` instead.
- No local DevPod, devrouter, or devcontainer runtime was started. The live staging session was already authenticated by the user.
- The captured build was terminal, so design review, plan review, processing, and finalizing could not be navigated back to. They are marked exercised rather than verified/captured.
- Screenshot evidence is local to the audit machine and contains staging UI content. It must remain outside Git.
- [PR #5635](https://github.com/uzh-bf/klicker-uzh/pull/5635) is the current overlap boundary. Refresh its head, target, ownership, and CI before starting implementation; this snapshot must not be treated as a future integration authorization.
