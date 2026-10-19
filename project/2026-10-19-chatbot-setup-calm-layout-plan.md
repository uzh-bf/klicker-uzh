# Chatbot setup: one status-driven page

## Approval summary

**Why and what changes?** Today the chatbot page feels crowded:

- Boxes sit inside boxes.
- Every editor repeats its own heading, description and Save button.
- Saved sections stay open.
- The student information preview always takes half a screen.
- Lecturers cannot see at a glance what is done and what needs work.

Creating a knowledge base also sends the lecturer away from the chatbot, with a
small way back. Published chatbots use a different tabbed layout again.

Every chatbot, in every status, gets one page made of **sections**. A closed
section shows two things:

- a status icon: default, saved, warning, invalid, unsaved, or saved but not
  yet submitted;
- one or two short sentences describing its current settings.

Each open section has one Save button. Saving closes it and updates its status.
Optional sections start closed with working defaults.

The last card depends on the status: request publication, submit changes, a
pending request with "Withdraw", or nothing while paused. Materials can be
added without leaving the chatbot. The materials section previews the
knowledge base and still shows it as a separate, reusable thing.

Response examples move behind a new feature flag. All lecturer-facing chatbot
and knowledge base copy is rewritten in plain language, without dot
separators.

**What stays unchanged?**

- No schema or permission changes.
- Publication, revision review and withdrawal keep their existing server
  behavior.
- A chatbot still works without a knowledge base.
- The only GraphQL change is one additive, read-only field: when a knowledge
  base last changed.
- Every setting stays reachable.

**What could change the decision?** All design questions were settled in a
three-round review with you; see "Settled decisions". The main risk is size:
removing the tabs touches `ChatbotDetails.tsx` (about 2,000 lines) and 36
Playwright test IDs. The work is split into one fix and three stack layers,
and it reuses the existing editors instead of rewriting them.

**How will we know it is done?** Done means three things hold:

- The draft, rejected, pending, published and paused chatbots each show the
  right sections, statuses, summaries and final card.
- Saving closes a section.
- Materials can be added without leaving the page.

Evidence: EN and DE browser captures at desktop and 390 px, a unit test for
the status rules, and the migrated Playwright specs in CI.

**What does approval authorize?** The #6577 fix commit and three new layers
(S11 to S13) in stack #6274. That includes implementation, local commits,
task-branch pushes and draft PRs. Withheld: marking ready, merging, staging
promotion, flag activation and `/final-review`.

## Execution details

### 1. Settled decisions

| # | Decision |
|---|---|
| S1 | Any number of sections may be open. Each open section has one Save button. Saving closes the section and updates its status. There are no in-page prompts. Unsaved sections are labeled. Closing an unsaved section keeps its edits and its "Unsaved" status. |
| S2 | Only the browser's existing leave check runs, when navigating away or switching chatbot with unsaved sections. |
| S3 | Statuses: Default (gray), Saved (green), Warning (amber, never blocks), Invalid (red, blocks the request), Unsaved (blue). On published chatbots there is also "Saved, not yet submitted" (blue-gray). "Default" means the values match what a new chatbot gets. Student information shows a check labeled "Suggested" while it holds the suggested text in English or German. |
| S4 | Materials never block. With no knowledge base connected, the selector shows "No knowledge base. Answers use general model knowledge." and the section shows a warning. Nothing new is stored. Tutor and Explainer keep working; the learning modes summary says that Quizzer needs a knowledge base (ADR 0050). |
| S5 | Creating a knowledge base stays on the chatbot and opens the upload dialog there. The knowledge base appears as its own named card with an "Open knowledge base" link. Creation asks for its name, prefilled from the chatbot name. The upload dialog names the knowledge base. The knowledge base page shows a full-width "Back to chatbot setup" banner when opened from a chatbot. |
| S6 | Name, description and course are edited through "Edit details" next to the chatbot name. |
| S7 | Learning modes and custom modes share one Save button. It sends both in one revision save (`standardModeConfig` and `customModeConfig` in one `ChatbotRevisionSaveInput`), so a second call cannot conflict with the first. |
| S8 | Sections apply to all chatbots and all statuses. The tabs are removed for everyone, including lecturers with advanced management. S11 already moves drafts and rejected chatbots to sections whatever the flag says; S13 does the rest. |
| S9 | The knowledge base "last changed" time is the latest change to any of its resources. |
| S10 | Response examples are hidden behind the new `chatbot-response-examples` flag (default off) in Manage only. The chat runtime is unchanged, because the feature has never been used. The flag lands as a fix commit on #6577. |
| S11 | The knowledge graph section sits alone under an "Advanced" label, below the optional sections. |
| S12 | "Try it yourself" (owner preview) stays. Only published chatbots show the "Live configuration" caveat. Paused chatbots hide the preview, as today. |
| S13 | Manage copy on this surface says "students", "learning modes" and "student information". Code and plans keep "participant". |
| S14 | Rejected chatbots, and published chatbots with a rejected revision, show a "Changes requested" badge. The review comment sits at the top of the final card. |
| S15 | A failed save, or a revision conflict, keeps its section open, with the error and the existing reload notice in the section footer. The publishing authorization notice stays above the final card's blocker list. |
| S16 | Old links open and scroll to their section: `view=knowledge`, `view=behavior`, `view=usage`, `view=disclaimer`, `step=disclaimer`, `step=review`, `step=modes`, `step=credits`. `step=basics` opens "Edit details". `view=overview` opens the page top. |
| S17 | On a published chatbot, each field is labeled "Applies immediately" or "Applies after review". Connecting a knowledge base and building its graph apply immediately; everything else waits for review. |
| S18 | Published and paused chatbots get a compact read-only usage strip under the header: threads, messages, students, credits, last reset and student information responses. The live credit policy table from the Usage tab moves into the Usage limits section, next to the editor. |
| S19 | All sections start closed. |
| S20 | Closed summaries are at most two short plain sentences, with no separators and no truncation. |
| S21 | Every lecturer-facing chatbot and knowledge base string that uses dot separators is rewritten as plain sentences, in EN and DE, including separators built in code. The admin publication queue and question generation are a follow-up. |
| S22 | All new and rewritten copy follows `$rs-prose`: plain words, no filler, no dot separators. |
| S23 | While a section has unsaved edits, a quiet "Discard changes" text link sits next to Save. It restores the saved values without asking. |
| S24 | While pending, Materials stays editable and is labeled "Applies immediately", because the server applies knowledge base changes at once. While paused, every section is read-only in the UI. |

### 2. Page anatomy

| Area | Content |
|---|---|
| Header | Chatbot name, status badge, "Changes requested" badge when relevant, "Edit details", "Try it yourself". Below it, one muted sentence with the course and visibility, for example "Testkurs. Students cannot see this chatbot yet." |
| Usage strip | Published and paused only (S18). It wraps to two rows at 390 px. |
| Required | Materials, then Student information. |
| Optional | Group label "Optional. The defaults work for most courses." Then Learning modes and framing, Model, Usage limits. |
| Advanced | Group label "Advanced". Then Knowledge graph, which also holds response examples while their flag is on. |
| Final card | Depends on status; see below. |
| Technical details | Advanced management only, as a closed section at the end. It holds the chatbot ID and avatar URL, as today. |

All sections share one container style with equal gaps. Nothing is boxed inside
a section. The page keeps clear of the floating assistant button.

### 3. The section pattern

- **Closed:** status icon with a text label for screen readers, title, summary
  sentences, and a chevron. The header is a button with `aria-expanded`.
- **Open:** the existing editor, rendered flat without its own heading or
  description. One footer holds Save and any error. While read-only (pending,
  paused), the editor is shown read-only without a footer.
- **Status rules** live in one pure function per section, in this order:
  1. Unsaved edits give "Unsaved".
  2. Invalid values give "Invalid".
  3. On a published chatbot, saved revision values (`getChatbotRevisionValues`)
     that differ from the live fields give "Saved, not yet submitted".
  4. A warning condition gives "Warning".
  5. Saved values equal to the creation defaults give "Default".
  6. Anything else gives "Saved".

  Validity comes from the existing form validation.

| Section | Summary example (EN) |
|---|---|
| Materials | "Uses the knowledge base GBL materials. 2 of 3 resources are ready, 1 failed. Last changed 2 hours ago." With none: "No knowledge base is connected. Answers use general model knowledge." |
| Student information | "Students see About this chatbot before they start. This is the suggested text." A "Preview" link opens `ChatbotDisclaimerPreview` in a dialog. |
| Learning modes and framing | "Tutor, Explainer and Quizzer are on. There is no framing and no custom modes." |
| Model | "Students use GPT-6 Luna with medium reasoning. They cannot switch models." |
| Usage limits | "Each student gets 3 messages, refilled to 3 every day." |
| Knowledge graph | "The concept map is hidden from students. Graph search is off." |

The summary examples above are drafts. The final wording is reviewed with
`$rs-prose` in the copy step.

### 4. Materials and the knowledge base

- **The knowledge base card** sits inside the open Materials section. It shows:
  - the knowledge base name and an "Open knowledge base" link;
  - one sentence saying that it is a reusable collection of materials that
    other chatbots can use too;
  - four numbers: resources, ready, processing, failed;
  - the last change;
  - the five most recently changed resources, with type icon and status. A
    failed resource gives its reason in plain words.
- **Data:** the counts come from the existing `materialsReadiness`. The
  resource list uses the existing `GetKbResources` query, loaded only when the
  section opens.
- **New field:** `KBMaterialsReadiness.lastChangedAt`, the latest `updatedAt`
  among visible resources. It is computed in the same owner-scoped grouped
  query in `getKbMetricsMap` and is null without resources.
- **Creating a knowledge base** from the section asks for its name, prefilled
  from the chatbot name. It connects the new knowledge base and opens
  `KnowledgeBaseAddResourceModal` for it, titled with the knowledge base name.
  S12.2 exports the modal from `packages/kb-management/src/index.ts`. The
  section also offers "Add files".
- **Banner:** the knowledge base page shows "You are preparing materials for
  the chatbot TEST." with a primary "Back to chatbot setup" button whenever
  `?chatbotId=` names one of the lecturer's chatbots.

### 5. Final card by status

| Status | Sections | Final card |
|---|---|---|
| Draft, Rejected | Editable | "Request publication": use case, expected students, and the request button. While blocked, a short list names the sections that are unsaved or invalid, each linking to its section. |
| Pending (new chatbot, or a published chatbot with a pending revision) | Read-only, except Materials (S24) | Request summary with "Withdraw" (`withdrawChatbotRevision`). |
| Published | Editable | "Submit changes for review" while a saved revision exists. It lists the "Saved, not yet submitted" sections and uses the same blocker list. |
| Paused | Read-only, with the notice "The team paused this chatbot." | No action. |

### 6. Response examples flag (fix on #6577)

- Register `chatbot-response-examples` (default `false`, fails closed) in
  `packages/feature-flags/src/contracts.ts` and document it in
  `docs/feature-flags.md`.
- With it off, `ChatbotResponseExampleReview` is not rendered and its query
  does not run, whatever the advanced management flag says.
- The chat runtime and the stored examples are unchanged.
- The Playwright GrowthBook mock gains the flag. Response example specs set it
  on.

### 7. Copy rules

- Plain words, short sentences, active voice, no filler, per `$rs-prose`.
- No dot separators in UI strings, and none built in code. Lists of facts
  become sentences.
- EN and DE change together.

### 8. Delivery

| Layer | Branch | Content |
|---|---|---|
| #6577 fix | `enhance/iteration1-collapsed-advanced-settings` | Response examples flag |
| S11 | `enhance/iteration1-setup-sections` | Section pattern and statuses for draft and rejected chatbots, all six sections, the final request card with its blocker list, "Edit details", the preview dialog, and the copy rewrite (S21) |
| S12 | `enhance/iteration1-materials-in-place` | Knowledge base card, `lastChangedAt`, creating and uploading in place, the knowledge base page banner |
| S13 | `enhance/iteration1-setup-all-statuses` | Sections for pending, published and paused chatbots. Removes the tabs. Usage strip, per-field apply labels, old links, Playwright migration, `docs/chat-platform.md`, and the ADR |

S13 adds the ADR "One status-driven setup page replaces the tabbed chatbot
workspace". It is numbered 0052 if that is still free on `origin/v3` and in
the open layers at commit time. It links ADR 0043 and ADR 0050. S11 adds a
"Knowledge base" entry to `CONTEXT.md`: an owner's reusable collection of
course materials that chatbots answer from, which a chatbot does not require.

New worktrees go under `trees/` and branch from the layer below. This plan is
the first commit of S11. The test runtime moves to the top layer once it
exists.

### 9. Slices

Execution mode: solo. The main session implements, then simplifies and reviews
the integrated result once per layer.

| Slice | Outcome | Main files | Acceptance |
|---|---|---|---|
| F1 (#6577) | Response examples flag | `contracts.ts`, `docs/feature-flags.md`, `ChatbotDetails.tsx`, Playwright GrowthBook fixture | Browser: no response examples with the flag off, even with advanced management. Checks pass. The #6577 description names the flag. |
| S11.1 | Section shell, status function, Materials and Student information, preview dialog | `ChatbotDetails.tsx`, new `ChatbotSetupSection.tsx`, new `chatbotSetupStatus.ts`, `ChatbotAuthoring.tsx` | Saving student information closes the section and shows "Saved". The preview dialog opens. |
| S11.2 | Learning modes (one Save), Model, Usage limits, Knowledge graph | `ChatbotDetails.tsx`, `ChatbotAuthoring.tsx`, `ChatbotCreditPolicy.tsx` | Each summary updates after save. Defaults show "Default". |
| S11.3 | Header, "Edit details", request card with blocker list, rejected badge, old draft links | `ChatbotDetails.tsx`, `ChatbotPublicationRequest.tsx`, `chatbotWorkspace.ts` | A blocked request names its sections. 390 px has no sideways scroll. |
| S11.4 | Copy rewrite (S21, S22) and the `CONTEXT.md` entry | `packages/i18n/messages/{en,de}.ts`, `KnowledgeBaseMaterialsReadiness.tsx`, `KnowledgeGraphPanel.tsx`, `KnowledgeBaseResourceList.tsx`, `Chatbots.tsx`, `CONTEXT.md` | No dot separators remain on lecturer chatbot and knowledge base surfaces. |
| S12.1 | `lastChangedAt` field and the knowledge base card | GraphQL KB readiness type and `getKbMetricsMap`, `QGetChatbotsInfoWithKnowledgeBases.graphql`, `ChatbotKnowledgeBaseSetup.tsx` | Integration test. The card numbers match the knowledge base page. |
| S12.2 | Create and upload in place, "Add files", modal export | `ChatbotKnowledgeBaseSetup.tsx`, `packages/kb-management/src/index.ts`, `KnowledgeBaseAddResourceModal.tsx` | Create, upload and return to a closed Materials section without navigation. |
| S12.3 | Knowledge base page banner | `KnowledgeBaseDetail.tsx` | The banner leads back to the chatbot. |
| S13.1 | Pending, published and paused sections and final cards; tabs removed | `ChatbotDetails.tsx`, `ChatbotWorkspaceNavigation.tsx` (removed), `chatbotWorkspace.ts` | Each status shows the right sections and final card. "Withdraw" works. |
| S13.2 | Usage strip, per-field apply labels, old links | `ChatbotDetails.tsx`, `ChatbotCreditPolicy.tsx` | Old links open their section. The strip wraps at 390 px. |
| S13.3 | Playwright migration, docs, ADR | `T-chatbot-authoring.spec.ts`, `Y-chatbot-kb-setup.spec.ts`, `Y-chat-knowledge-graph.spec.ts`, `docs/chat-platform.md`, `docs/adr/` | Specs use section test IDs and run in CI. |

`ChatbotSetupSection.tsx` and `chatbotSetupStatus.ts` are the only new source
files; every section uses both.

### 10. Test portfolio

| Risk or behavior | Obligation | Seam | Realistic failure |
|---|---|---|---|
| Section status rules | add new | Unit test of `chatbotSetupStatus.ts` with synthetic values | A changed credit policy shows "Default", empty student information shows a check, or a published chatbot with a saved but unsubmitted change shows "Saved". |
| The request stays blocked while a section is unsaved or invalid, and a missing knowledge base never blocks it | extend existing | `Y-chatbot-kb-setup.spec.ts` | The request drops an unsaved model edit, or a chatbot without a knowledge base cannot be published. |
| Draft setup end to end | extend existing | `Y-chatbot-kb-setup.spec.ts` | The new structure breaks the existing setup path. |
| Creating a knowledge base keeps the lecturer on the chatbot | extend existing | `Y-chatbot-kb-setup.spec.ts` | Creation still navigates away. |
| Published, pending and paused behavior without tabs | replace/consolidate | `T-chatbot-authoring.spec.ts`. No lecturer mutation pauses a chatbot, so the paused case sets the status through Prisma in the spec. | Submitting changes or withdrawing breaks after the tab removal. |
| `lastChangedAt` follows the newest visible resource and owner scope | extend existing | `knowledge.test.ts` (Postgres, CI) | A deleted resource's time shows, or another owner's knowledge base reports a time. |
| Response examples stay hidden while their flag is off | extend existing | Flag-off chatbot setup test | Advanced users see the section without the flag. |

No test pins copy, summaries or translations. Playwright runs in CI only.

### 11. Verification

- Per layer: typecheck, Biome, lint and the affected unit and integration
  tests.
- Screenshot gallery per layer through `$rs-build-screenshot-gallery`:
  - EN and DE;
  - desktop and 390 px;
  - every status and every summary;
  - the preview dialog, the knowledge base card and the banner.
- Interaction checks:
  - saving closes a section;
  - unsaved sections block the request;
  - "Withdraw" works;
  - old links open their section.

### 12. Follow-ups

- Rewrite dot separators in the admin publication queue and in question
  generation.
- Simplify the knowledge base page for ordinary lecturers: quotas, cleanup,
  filters, "Ingest all" and imported sources.
- Explain failed ingestion with a retry action.

## Progress

- Status: approved on 2026-10-19. F1 is on #6577 (67547123e1). Executing S11.1.
- Next action on approval: commit the response examples flag fix on #6577.
  Then create the S11 worktree from the #6577 head, commit this plan, and
  start S11.1.
