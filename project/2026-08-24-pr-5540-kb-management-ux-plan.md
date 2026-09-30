# Knowledge Base management UX audit and improvement roadmap

Status: implementation complete; desktop browser proof and Sol final review passed; publication update pending

Date: 2026-08-24

Base snapshot: `1d57f4f11a65698b72916de7c6f14c66422f9293`

Plan branch: `rs/kb-management-ux`

PR base: `feat/kb-graph-lifecycle`

Ultimate target: `v3-ai`

PR: [#5540](https://github.com/uzh-bf/klicker-uzh/pull/5540)

Related history: published #5424 (`feat/kb-graph-lifecycle`); no sibling PR changes are in scope.

## Goal

Make Knowledge Base management fast to scan and safe to operate. A lecturer should be able to answer three questions immediately:

1. What is in this Knowledge Base?
2. Is each resource usable by the AI, and what needs attention?
3. How do I add or remove one resource?

The recommended direction is to make resources the primary workspace, present them in a metadata-rich table, and provide one `+ Add resource` entry point. Website, document upload, and future video support then become choices in one modal instead of separate stacked forms and repeated links.

## Scope and method

### In scope

- The authenticated lecturer flow for the Knowledge Base catalog and detail page.
- Empty and populated states.
- Resource creation, resource search/filtering, inspection, ingestion status, and deletion affordances.
- The surrounding chatbot-binding and knowledge-graph controls insofar as they affect hierarchy and cognitive load.
- English and German desktop behavior at 1440×900.
- A limited keyboard, focus, landmark, and heading check.

Mobile layout, full WCAG conformance, ingestion correctness, graph quality, chatbot behavior, and production deployment are outside the accepted completion scope. The earlier mobile findings remain historical audit evidence for a separate shared Manage-shell follow-up.

### Evidence

The primary audit used the running local branch above with the seeded delegated lecturer fixture and `agent-browser` 0.32.0 in headless Chrome. Screenshots are private and remain uncommitted in `/private/tmp/kb-v3-ai-ux-audit-2026-08-24/`.

| State | Evidence | What it establishes |
| --- | --- | --- |
| Empty catalog | `05-kb-catalog.png` | The catalog has a clear empty state and a single create action. |
| Empty detail | `06-kb-detail.png` | The detail page introduces metrics, two creation surfaces, chatbot bindings, graph controls, and resources in sequence. |
| Populated detail top | `07-kb-detail-populated.png` | The primary add-file and add-link forms occupy the first working area before the resource list. |
| Lower detail and graph | `13-kb-detail-resources-correct.png` | Chatbot and graph configuration appear before the resource workspace; graph controls can expose unavailable cost configuration. |
| Resource controls | `14-kb-detail-resources-visible.png`, `15-kb-resource-card.png` | Search, type/status filters, selection, two status panels, Inspect, and prominent Delete are all available. |
| Resource inspector | `16-resource-inspector.png` | The current inspector exposes useful metadata but duplicates close affordances and needs a stronger modal focus contract. |
| Mobile detail top | `17-kb-detail-mobile-top.png` | The global header does not reflow at 390px; navigation is clipped and the detail starts with four stacked metric cards and an upload panel. |
| Mobile resource workspace | `19-kb-detail-mobile-resources.png`, `20-kb-detail-mobile-resources-header.png` | Resources are reachable only after a long scroll and each card repeats substantial status and action content vertically. |
| Environment issue | `01-kb-page-initial.png` | The first attempt hit a missing local Manage process and returned 502. This is not a product UX finding. The managed audit process was restored before judging the UI. |

The audit combined one familiarization pass, a second evidence-capture pass, source inspection, and an independent Sol review. No destructive action, successful ingestion, model call, or external provider call was required. A document upload could not be confirmed because the local Blob request failed before confirmation.

### Existing strengths

- The catalog title, create action, search, result count, and compact resource/chatbot metrics are easy to identify.
- The detail page uses consistent spacing, labels, borders, and status language.
- Resource search, type/status filters, empty results, selection limits, bulk deletion, inspection, and background-operation messaging are already present.
- URL syntax validation is inline and uses `aria-invalid` and an associated error message for malformed input.
- Destructive operations require confirmation, and Escape cancels the tested dialogs.

The earlier Knowledge Base work already provides useful data and lifecycle behavior. This plan changes the presentation and entry points first; it does not propose replacing the ledger-only graph lifecycle or inventing a separate Knowledge Base graph-version lifecycle. The core package preserves the current `BLOB`/`URL` resource model, the four existing metrics, explicit post-creation ingestion, and the current server-backed cursor/polling behavior.

## Findings register

Severity uses 0–4: 0 cosmetic, 1 minor friction, 2 material friction, 3 serious task/accessibility barrier, 4 blocking or unsafe.

### F1 — The global header is fixed-width at mobile size

Severity: 3

Evidence: `17-kb-detail-mobile-top.png`; independent Sol pass.

At 390px the document is wider than the viewport. The navigation visibly truncates at “Resour…”, while Analytics and account controls are offscreen. This makes orientation and access to other areas unreliable and fails the responsive reflow expectation.

Source anchor: `apps/frontend-manage/src/components/common/Header.tsx:309-330`.

This is a real usability issue, but it crosses the KB package boundary. It is therefore a proposed separate Manage-shell follow-up, not a prerequisite for the KB detail redesign.

### F2 — Dialog focus and description behavior is inconsistent

Severity: 3

The tested create, inspector, and delete dialogs did not reliably move focus into the dialog, trap Tab within it, or return focus to the exact opening trigger. After Escape, focus could remain on the background or land on an unrelated control. The inspector also showed duplicate close affordances, and the browser console reported missing dialog description wiring.

Evidence: `16-resource-inspector.png`; keyboard spot check; independent Sol pass.

Source anchors: `packages/kb-management/src/components/CreateKnowledgeBaseModal.tsx:43-57`, `packages/kb-management/src/components/KnowledgeBaseResourceList.tsx:1197-1213`.

The add-resource chooser must meet the repository’s existing modal contract. A broad shared-dialog repair belongs in a separate task if the current design-system `Modal` cannot satisfy the contract without cross-application changes.

### F3 — Client URL validation does not express the server’s safety policy

Severity: 2

The client accepts any HTTP(S) URL, while the server rejects private or local targets. A rejected but syntactically valid URL therefore reaches submission and produces a generic failure instead of a field-level explanation and correction path. The same recovery pattern should be checked for upload failures: preserve the selected file context, explain what failed, and offer retry without forcing the user to rediscover the task.

This finding comes from the independent partner pass and source inspection; the main audit did not probe private targets. It should be verified against the approved server policy before implementation. Structured policy errors are a separate API/product-contract follow-up, not a reason to expand this UI-only redesign.

Source anchors: `packages/kb-management/src/components/KnowledgeBaseUrlForm.tsx:9-16,40-56`, `packages/kb-management/src/components/KnowledgeBaseFileDropzone.tsx:81-99`, `packages/i18n/messages/en.ts:1551`, and the current URL-policy contract at `docs/domain-model.md:62`.

### F4 — The primary resource task is buried and each resource card is over-composed

Severity: 2

The detail order is metrics, file upload, URL form, chatbot bindings, graph controls, and only then Resources. On mobile, Resources begins roughly 2,200px down a page of about 3,037px in the captured fixture. Each resource then repeats operation status, serving status, timestamps, Inspect, and a prominent red Delete button. The page asks the user to understand implementation-oriented state before they can scan the resource inventory.

Evidence: `07-kb-detail-populated.png`, `13-kb-detail-resources-correct.png`, `14-kb-detail-resources-visible.png`, `15-kb-resource-card.png`, `17-kb-detail-mobile-top.png`, `19-kb-detail-mobile-resources.png`, `20-kb-detail-mobile-resources-header.png`.

Source anchors: `packages/kb-management/src/KnowledgeBaseDetail.tsx:101-201`, `packages/kb-management/src/components/KnowledgeBaseResourceList.tsx:1037-1177`.

### F5 — Website and video resources are not distinguishable in the current model

Severity: 2

The URL form is presented as “Add a link”. A YouTube resource is rendered as the same generic Link type and uses the same icon/filter path as a website. Users cannot scan or filter the inventory by the actual content type they care about. The current model supports only `BLOB` and `URL`, so the core redesign must not relabel existing URLs as Video. Video remains an announced “Coming soon” option until a backend media-type contract exists.

Evidence: `19-kb-detail-mobile-resources.png`, `20-kb-detail-mobile-resources-header.png`; independent Sol pass.

Source anchors: `packages/kb-management/src/components/KnowledgeBaseUrlForm.tsx:75-76`, `packages/kb-management/src/components/KnowledgeBaseResourceList.tsx:918-923,1229-1232`.

### F6 — Page structure gives assistive technology weak orientation

Severity: 2

Both the catalog and detail content begin with an `H2`, while the shared layout provides a content `<div>` rather than a `<main>` landmark. The visual page can look understandable while the semantic page outline remains weak.

Source anchors: `packages/kb-management/src/KnowledgeBaseManager.tsx:64-75`, `packages/kb-management/src/KnowledgeBaseDetail.tsx:87-100`, `apps/frontend-manage/src/components/Layout.tsx:84-100`.

### F7 — Resource creation has multiple competing entry points

Severity: 2

The detail page exposes separate upload and link panels near the top, while the empty resource state repeats two links that jump back to those panels. This creates duplicated navigation and forces a choice between controls that belong to one conceptual action: adding a resource. It also makes the page grow as new resource types are added.

Evidence: `07-kb-detail-populated.png`, `14-kb-detail-resources-visible.png`; source anchors `packages/kb-management/src/KnowledgeBaseDetail.tsx:185-194` and `packages/kb-management/src/components/KnowledgeBaseResourceList.tsx:989-1016`.

## Review scores

These are directional scores for this limited audit, not quality gates. F1, F3, and real Video classification remain important follow-ups even though they are outside the core KB-local package.

- UX heuristics: 6/10. Navigation clarity loses points for F1. Helpful errors loses a point for F3. The “nothing makes me stop and think” heuristic loses a point for the combined F4/F5/F7 presentation and taxonomy friction.
- Refactoring UI: 9/10. Seven of eight diagnostic areas pass in the current implementation; visual hierarchy fails because F4/F5/F7 make the working inventory secondary and visually noisy.
- Accessibility: not a single conformance score. The limited check found reflow risk under WCAG 1.4.10, focus-order risk under 2.4.3, weak landmark/heading structure under 1.3.1 and 2.4.1, and dialog-description warnings. A dedicated accessibility pass remains necessary after redesign.

## Recommended information architecture

Use one page with one obvious primary workspace:

```text
Knowledge Base name and description                         [ + Add resource ]
Compact summary: resources | storage | pending cleanup | linked consumers

Resources                                                   Search  Filters
Semantic data table

Secondary configuration                                     collapsed by default
  Chatbot access                                            expandable
  Knowledge graph                                           expandable
```

The summary should answer health questions without four large cards. Keep the existing visible-resource, storage, pending-cleanup, and linked-consumer metrics; do not invent an aggregate “AI-ready” metric. Resources should be the first substantial section after identity and summary. Chatbot and graph configuration should remain available but should not compete with the inventory.

## Improvement roadmap

The sequence below keeps existing GraphQL mutations and lifecycle behavior wherever possible. It is intentionally presentation-first and should be delivered in small, independently testable slices.

### R0 — Agree the resource workspace contract

Addresses: F4, F5, F7; anchors `KnowledgeBaseDetail.tsx:101-201` and `KnowledgeBaseResourceList.tsx:881-1016`.

Freeze the table columns, current type taxonomy, status vocabulary, action hierarchy, and modal states before changing layout. The current API model supports `BLOB` and `URL`; use File and Link/Web resource as the initial visible types and reserve Video for the unavailable future option. Do not client-sort only the loaded subset or render clickable sortable headers until a server-side ordering contract exists. The repository has `packages/shared-components/src/DataTable.tsx:27`, but it currently owns local sorting/pagination and does not provide the required server-backed load-more, selection, polling, or responsive-column contract. Prefer local semantic design-system table primitives in the KB package unless a narrowly scoped extension is approved.

The recommended initial row model is:

| Column | Purpose |
| --- | --- |
| Select | Existing bulk-selection behavior, including the 50-item limit. |
| Type | File or Link/Web resource now, with Video reserved as “Coming soon”. |
| Resource | Title plus filename or hostname. |
| Ingestion | Latest run status, version, and a short actionable failure state. |
| AI availability | Whether the resource is currently available to the AI. |
| Updated | Last resource update. |
| Actions | Inspect as the primary action; overflow menu for ingest/retry/delete. |

Acceptance: product/design sign-off on these columns, the File/Link labels, the unavailable Video treatment, and the existing explicit post-creation ingestion behavior. Estimate: 0.5–1 day if the existing resource fields are sufficient; no API expansion is part of the core package.

### R1 — Reorder the detail page and prepare one creation entry point

Addresses: F4, F7, F6.

- Add a page-level `H1` and a `<main>` landmark.
- Keep the back link, name, and description as the identity block.
- Replace the four large metric cards with a compact summary strip. Keep the visible-resource, storage, pending-cleanup, and linked-consumer values; move secondary cleanup/storage detail into an expandable “Capacity details” view if it is not immediately actionable.
- Put Resources directly below the identity and summary.
- Keep the existing creation forms reachable during this transitional slice; remove them and the empty-state jump links only when R3 supplies the working chooser.
- Move Chatbots and Knowledge graph into collapsed secondary sections or a clearly labeled configuration area below the resource workspace.

Acceptance: at 1440×900 the resource workspace header is visible after the identity block; at 390×844 the resource workspace is reachable in the first meaningful scroll; no creation path disappears before R3 lands. R2 supplies the table rows after this placement slice. Estimate: 1–2 days if the existing sections can be reordered without data-flow changes.

### R2 — Replace resource cards with a metadata table

Addresses: F4, F5, F6; source `KnowledgeBaseResourceList.tsx:1037-1177`.

Use local semantic design-system table primitives in the KB package. Do not reuse `packages/shared-components/src/DataTable.tsx` unchanged: its local sorting/pagination model does not match the resource connection’s server search, cursor load-more, selection, and polling contract. Do not force every desktop column into the 390px layout: preserve Type, Resource, AI availability, and the primary action, and expose the remaining metadata in a row detail/inspector.

Keep existing search, type/status filters, result count, load-more, selection, bulk delete, polling, and inspector behavior. Reduce the row to one compact status line, use badges or short labels instead of two nested panels, and make Delete an overflow action with confirmation rather than a peer to Inspect.

Acceptance: a lecturer can scan 20 resources without opening cards; each row exposes type, identity, ingestion state, AI availability, and update time; keyboard selection and bulk deletion retain their current limits; server search, cursor load-more, polling, and active-row fencing remain intact; mobile has no horizontal scroll and does not hide the primary action. Estimate: 2–3 days if local semantic primitives are sufficient, 4–6 days if responsive semantics and selection must be built locally.

### R3 — Add one `+` resource modal

Addresses: F5, F7.

The `+ Add resource` button opens a short choice dialog with three options:

- **Add website** — available now; opens the existing title/URL form inside the modal or a modal step.
- **Upload document** — available now; opens the existing dropzone and shows accepted formats, size limit, progress, retry, and confirmation states. Cancellation is limited to before an upload ticket is requested unless a separate cleanup contract is approved.
- **Add video** — presented as an announced unavailable “Coming soon” option until the backend contract exists; do not classify or migrate existing URL resources.

The modal should not auto-ingest unless that behavior is explicitly accepted as the product contract. After creation, show the new row and offer the next action, such as “Ingest”, from the row or inspector. Preserve title and URL/file context on recoverable errors. The upload ticket reserves quota for up to 15 minutes after request (`packages/graphql/src/services/knowledge.ts:1244`); cancellation after that boundary is a lifecycle change, not presentation polish.

Acceptance: the detail page has one add button and no duplicate creation panels; every current creation path is reachable in at most two deliberate steps; the existing modal contract focuses the first meaningful control, traps focus, and returns focus to `+ Add resource`; the Video option is announced as unavailable; successful creation lands in the table without a page reset and remains `ADDED` until explicit ingestion. The current explicit `ADDED`-then-ingest behavior is anchored at `packages/prisma/src/prisma/schema/knowledge.prisma:9-15,97`, `packages/graphql/src/services/knowledge.ts:1450-1462,1499-1506`, and `packages/kb-management/src/components/KnowledgeBaseResourceList.tsx:754-799`. Estimate: 2–3 days if the existing mutations and forms are retained.

### R4 — De-emphasize secondary graph and chatbot configuration

Addresses: the remaining hierarchy and option overload observed in `KnowledgeBaseDetail.tsx:195-196`, `KnowledgeBaseChatbotBindings.tsx:96-202`, and `KnowledgeGraphPanel.tsx:353-430`.

Keep these controls available, but show a compact summary and an explicit “Configure” disclosure rather than a full configuration surface on every detail load. A collapsed graph section must still expose active polling and queued, processing, failed, stale, and cost-review states. When graph cost configuration is unavailable, explain the prerequisite next to the disabled build action and avoid presenting a wall of empty values.

Keep the approved ledger-only graph-to-question flow. Every `KBGraphBuild` attempt is one durable row in the append-only build ledger; its status and accounting fields settle in place, while `activeGraphBuildId` and `publishedGraphBuildId` remain the only liveness pointers. This slice must not change GraphQL operations, publication rules, pointers, or create another version identity. See `docs/adr/0017-graph-build-ledger-is-canonical.md:15` and `packages/kb-management/src/components/KnowledgeGraphPanel.tsx:216`.

Acceptance: a user managing resources can complete the common scan/add/inspect path without passing through chatbot or graph controls; configuration remains discoverable; active graph states do not disappear when collapsed; no graph lifecycle behavior changes. Estimate: 1–2 days after R1, with no API changes expected.

### R5 — KB-local accessibility, regression proof, and documentation

Addresses: F2 and F6, plus the affected core slices.

- Add a KB-local page-level `H1` and `<main>` to both the catalog and detail surfaces without broadening the shared Manage layout change. Include `packages/kb-management/src/KnowledgeBaseManager.tsx` in the affected target files.
- Use the repository’s existing modal contract for the chooser and existing dialogs: focus the first meaningful control, contain Tab, close on Escape, return focus to the exact trigger, provide an accessible name and description, and render one close control. If the shared `Modal` cannot satisfy this without cross-application work, pause and split X1 below.
- Add a reproducible keyboard matrix for catalog create, add-resource choice, website form, upload flow, inspector, and delete confirmation. Screenshots establish layout only; they do not prove focus behavior.
- Add focused Playwright coverage because the current repository has no KB-management Playwright spec. Verify English and German changed-string parity, 1440×900 and 390×844, plus 320 CSS pixels for the narrowest reflow check. This is not a broad localization audit.
- Record durable keyboard results for each dialog in the new spec or its review evidence: focus entry, Tab containment, Escape cancellation, and exact trigger restoration. Screenshots establish layout only.
- Update `docs/frontend-conventions.md` and `.agents/skills/klicker-frontend-ui/SKILL.md` in the implementation PR when the new table/modal pattern becomes a durable repository convention.

Acceptance: `scrollWidth` equals the viewport width at 390px and 320px; the KB page has one H1 and one main landmark; focus never escapes an open modal and returns to the opening control; table headers, row/action names, status announcements, and chooser descriptions are exposed; focused tests and browser evidence cover empty, populated, active, ready, failed, and modal states. Estimate: 1–2 days for KB-local work, plus time for any separately authorized shared primitive repair.

### X1/X2 — Separate follow-ups outside the core KB redesign

- **X1 Manage shell and shared dialog remediation** — F1 and any F2 failure that cannot be solved within the KB package. Repair the global header at small widths and the shared dialog implementation only under a separate task with Manage-wide browser proof. Do not expand the KB PR into an application-shell refactor.
- **X2 URL policy errors and real Video type** — F3 and the real portion of F5. Confirm the server URL policy and stable GraphQL error contract, then add field-level policy errors and a true media-type taxonomy in a separate API/UI change. Until then, keep the current `BLOB`/`URL` model and show Video only as unavailable “Coming soon”.

## Proposed execution contract

The user approved R0 and the named S1–S5 local implementation work in this task. The current goal authorizes scoped code edits, local commits, browser verification, and required read-only reviews; it does not authorize X1/X2, pushes, PR updates, merges, deploys, or shell/API follow-ups outside the named runtime checks.

If the user approves R0 and the implementation package, the main session is the execution orchestrator and the user remains the product/authority boundary owner. Use a new task branch such as `rs/kb-management-ux` from the exact published #5424 snapshot `77ab853f697b8ffdeb2f9956fd387deb2e6eccb1` or the later base the user names. The proposed delivery is one cohesive UX PR targeting `v3-ai`, stacked on #5424 only while that remains the intended integration base; it must not touch sibling question-generation PRs. Do not implement the redesign on `rs/kb-v3-ai-finalization`, which remains the #5424 finalization worktree.

Approval ratifies R0 and the named S1–S5 local work only; it does not authorize X1/X2, push, merge, deploy, or any graph/API contract change. The current #5424 audit runtime is deliberately kept running for user testing under its separate worktree; do not stop it while this goal uses it for browser verification. At implementation handoff, stopping and verifying the exact implementation runtime is terminal work unless the user explicitly keeps it running; runtime/worktree deletion remains separately authorized.

### Slices and ownership

| Slice | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| S1 Resource-first page shell | Main session | R0 contract | Existing four metrics are compacted; Resources precedes configuration; KB-local H1/main; existing creation forms remain reachable until S3. |
| S2 Metadata table | KB implementation executor | S1 | Semantic responsive table preserves server search, cursor load-more, polling, selection, inspector, and actions. |
| S3 Unified add-resource chooser | KB implementation executor | S2 | One `+`; Website and Document use existing mutations; duplicate forms/links are removed only after the chooser works; Video is announced unavailable; creation remains explicit `ADDED` until ingestion. |
| S4 Secondary configuration | Main session | S1–S3 | Chatbot/graph summaries reduce clutter without changing graph polling, pointers, publication rules, or ledger lifecycle. |
| S5 Integrated proof and docs | Main session | S1–S4 | Focused Playwright checks, mandatory browser evidence, package checks, final review, wiki/skill updates, and a clean scoped diff. |
| X1/X2 follow-ups | Separate authorized task | Independent contracts | Manage shell/shared modal or API/media-type changes are planned and verified separately. |

Execution-tier skip reason for S1: main retains this slice because it spans the catalog/detail semantic shell and the detail-section ordering that S2/S3 must integrate against; delegating it would add coupling at the critical path.

### Target files and documentation

The core implementation should stay in the reusable package:

- `packages/kb-management/src/KnowledgeBaseDetail.tsx`
- `packages/kb-management/src/KnowledgeBaseManager.tsx`
- `packages/kb-management/src/components/KnowledgeBaseResourceList.tsx`
- `packages/kb-management/src/components/KnowledgeBaseFileDropzone.tsx`
- `packages/kb-management/src/components/KnowledgeBaseUrlForm.tsx`
- a new KB-local add-resource chooser component if needed
- `project/screenshots/kb-management-ux-<state>-<locale>-<viewport>.png` and a durable keyboard-results matrix in the implementation evidence
- `packages/i18n/messages/en.ts` and `packages/i18n/messages/de.ts`
- a new focused spec under `playwright/tests/` for KB catalog/detail flows
- `docs/frontend-conventions.md` and `.agents/skills/klicker-frontend-ui/SKILL.md` when the new pattern is durable

Do not modify `apps/frontend-manage/src/components/common/Header.tsx`, shared modal primitives, GraphQL schemas, Prisma models, or graph lifecycle code in the core package. Those are X1/X2 or explicitly out of scope.

### Verification, review, and terminal conditions

Per slice: inspect the diff, run the affected package checks and formatting, run the focused browser/test proof, obtain the applicable simplifier and slice review, update this plan’s Progress section, and create one conventional commit for the slice. After integration, run the final reviewer before presenting the package as complete.

Required checks include the affected package typechecks, repository formatting/lint checks, focused GraphQL regression coverage, the new KB Playwright spec in English and German, and browser screenshots at 1440×900. Keep the existing resource lifecycle tests and graph ledger tests unchanged unless a presentation-only selector or assertion requires a narrow update. The boundary owner must confirm any new policy error, media type, upload-ticket cleanup, or shared primitive change before implementation proceeds.

Pause before implementation or between slices for a material product/API decision, a need to change the current `BLOB`/`URL` contract, a shared Manage-shell or modal change, a graph lifecycle change, a destructive/external action, unavailable required credentials, or a verification blocker that remains after distinct safe approaches. The plan terminates after local checks, browser evidence, required reviews, documentation updates, a clean scoped diff, and stopping/verifying the exact implementation runtime unless explicitly kept running. Publishing, merging, deploying, and runtime/worktree deletion remain separate authorities.

## Progress

- [x] Live desktop/mobile audit completed against the exact local snapshot.
- [x] Independent Sol UX audit completed; strengths, findings, and roadmap corrections integrated.
- [x] Planner review completed; scope, existing contracts, table primitive, sequencing, evidence traceability, and execution boundaries corrected.
- [x] Independent Sol final review completed after corrections; roadmap approved with no remaining concerns.
- [x] User approved the KB-local redesign package and implementation goal; local execution is authorized through S5.
- [x] S1 resource-first shell implemented locally: KB catalog/detail use semantic `main`/`H1` landmarks, metrics are compact metadata, and Resources precedes creation/configuration. `@klicker-uzh/kb-management` check and targeted formatting pass.
- [x] S2 metadata table implemented locally: the resource cards are now a semantic design-system table with responsive metadata, server-backed filters/search/load-more/polling, selection, inspector, deletion, and ingestion behavior preserved. `@klicker-uzh/kb-management` check and targeted formatting pass.
- [x] S3 unified add-resource chooser implemented locally: one `+` action opens a KB-local chooser for Website and Document, Video is disabled as coming soon, existing BLOB/URL mutations remain in explicit forms, and the old empty-state links/direct form stack are removed. `@klicker-uzh/kb-management` check and targeted formatting pass.
- [x] S3 accessibility correction completed after review: the chooser now associates its description, traps Tab locally, and restores focus to the exact `+ Add resource` trigger after close. No shared modal change was required.
- [x] S4 secondary configuration implemented locally: chatbot and graph configuration own collapsed disclosures with explicit Configure affordances; graph status, stale, and human-review states remain in the summary, and the expensive graph preview mounts only after expansion. Existing queries, polling, mutations, pointers, and lifecycle contracts are unchanged. The focused Playwright spec covers the English/German workspace, chooser keyboard path, table metadata, and mobile overflow.
- [x] Final static review corrections applied locally: file-upload dismissal is locked after upload starts, chooser dismissal is singular, destructive deletion is in the row overflow menu, the `ADDED`-before-Ingest lifecycle is asserted in the focused spec, and the frontend KB conventions are documented.
- [x] Static S5 package proof complete: Sol final review passed the exact implementation range through `f817a281dd25ceab33d6d13850b8e6d186911457`, the focused spec covers desktop plus 390px and 320px reflow guards, and the full repository typecheck passes 29/29 Turbo tasks after workspace outputs were generated.
- [x] Root formatting passes. Root lint remains environment-blocked in the unrelated analytics package: the host lacks `llvm-ar`, the DevPod lacks a C compiler for its pandas build, and the standalone ruff run exposes 97 pre-existing analytics findings outside this change.
- [x] Host-side Playwright execution is available through `util/run-host-e2e.sh`: it maps routed worktrees, a plain devcontainer, and host-run apps while keeping browser binaries in the shared host cache. The focused lecturer-login smoke passes against the exact linked workspace.
- [x] The latest `origin/v3` local-runtime improvement (`2619be5a2`) is selectively adapted without merging unrelated v3 changes: dependency fingerprinting, bounded stale Next.js cache repair, semantic app readiness, `dev:doctor`, and runtime guard tests are preserved alongside the KB/Azurite startup wiring. The exact linked workspace was re-reconciled successfully with `KB_GRAPH_BLOB_HOST_PORT=10004`; all five Next.js readiness contracts passed. Runtime checks pass for `test:dev-runtime`, `dev:doctor`, formatting, the KB package, and Playwright TypeScript.
- [x] Direct browser verification against the retained workspace reaches the redesigned authenticated detail page, metadata table, and unified add-resource chooser; Website and Document are available and Video is disabled as “Coming soon”. Desktop and 390px screenshots are captured in `/private/tmp/kb-management-ux-add-desktop.png` and `/private/tmp/kb-management-ux-detail-mobile.png`.
- [x] Sol final review of `42773ea45` returned `DONE_WITH_CONCERNS` for one low-severity README cache-policy wording mismatch; the wording now matches the unconditional `.next/dev` cleanup and bounded full-cache repair behavior. The same reviewer’s correction pass over `da6149e29` returned `DONE`; no code, security, architecture, or scope findings remain.
- [x] The reviewed implementation range is based on #5424 head `1d57f4f11a65698b72916de7c6f14c66422f9293` and ends at `9a0792a891e1850bb3b3b284eef4be12f6cbd77a`. Normal publication remains authorized; this plan-only closure update follows that reviewed head before the branch readback is refreshed.
- [x] S5 desktop browser proof passes through `util/run-host-e2e.sh`: the English/German KB journey covers creation, chooser focus handling, the pending document-upload dismissal lock, successful confirmation dismissal, refresh-failure dismissal, the resource table, and the inspector. Mobile and the known shared Manage-header overflow are explicitly outside the accepted completion scope.
- [x] Sol final review of the exact reviewed range confirmed both prior modal findings are resolved and found no correctness, security, architecture, maintainability, desktop UX, or stack-compatibility defects. Its only plan-status finding is closed by this update.

## Verification plan for implementation

Each slice should be verified against the same seeded local fixture and a synthetic populated Knowledge Base. The repository currently has no KB-management Playwright spec, so the implementation must add focused coverage rather than treating screenshots as regression protection.

- Desktop: catalog, empty detail, populated table, add-resource chooser, website form, document upload states, inspector, failed ingestion, and delete confirmation at 1440×900.
- Mobile: deferred to the separate shared Manage-shell follow-up; it is not a completion gate for this desktop-focused package.
- Keyboard: open/close/focus return for every dialog, focus containment, table row selection, filters, load-more, primary row action, and confirmation cancellation. Screenshots alone do not prove these behaviors.
- Assistive technology smoke check: one page-level H1, one main landmark, labeled table headers, row/action names, status announcements, and dialog name/description.
- Localization: English and German strings remain in parity for the chooser, table headers, status labels, errors, and unavailable Video option.
- Regression: retain existing GraphQL resource creation, upload confirmation, ingestion, polling, selection limit, bulk delete, chatbot binding, and graph build tests.
- Browser console: no duplicate keys, unknown DOM props, missing dialog description warnings, or handled-error overlays in the reviewed states.

The implementation should add only the tests that protect consequential observable behavior. A screenshot matrix and focused interaction checks are more valuable here than broad visual snapshots.

## Open questions and unreachable states

These should be resolved before implementation crosses the API or product-contract boundary:

1. Is Video a planned resource type with a known backend shape, or only a future UI option? The recommendation is to show it disabled as “Coming soon” until the contract exists.
2. Does the repository’s design system expose a lower-level semantic table primitive that can be composed locally? `packages/shared-components/src/DataTable.tsx` exists but is not suitable unchanged because it sorts and paginates the loaded client array. The recommendation is to compose local semantic rows with the design-system table primitives and avoid a new dependency.
3. Should creating a resource leave it un-ingested, as the current lifecycle suggests, or should the modal offer an explicit follow-up “Ingest now” action? The recommendation is explicit follow-up, not hidden automatic work.
4. What exact server URL policy should be surfaced to lecturers? The client/server mismatch must be settled before promising a specific validation message.
5. Which graph cost fields are expected to be configured in this environment? The audit saw build controls disabled because cost configuration was unavailable; this was not treated as a product defect without confirmation.

The local document-upload path could not be confirmed because the Blob request failed before confirmation. No conclusion about the successful upload UX should be drawn from that failure alone.

## Boundaries

This plan does not authorize or include:

- Merging, closing, deploying, or changing the published PR.
- Backend lifecycle changes, new model/provider integrations, or graph-version entities.
- Deleting the disposable local Knowledge Base or its synthetic resources.
- A German localization pass or full WCAG conformance claim.
- Runtime teardown of the current #5424 audit runtime; it remains available for user feedback and testing until separately requested.
