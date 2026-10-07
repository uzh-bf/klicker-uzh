# Student documentation roadmap and review

Updated: 2026-10-07. Status: visual prototype implemented locally; production integration remains open.

## Outcome and agreed scope

Make `/docs` a useful student landing page within the PWA: a short, visual introduction followed by practical guidance and links to detailed public tutorials. It must work as a course entry point, including from an LMS, without explaining a particular OLAT navigation structure. Motivation comes from showing useful learning activities, with little marketing copy.

Retain the designer's Student Guide and Progress & Data organization, the existing PWA shell, typography, theme tokens, and controls. Keep Android Play Store installation, iPhone installation, account setup, and notifications easy to find. The supplied designer assets are visual references, not authoritative product claims.

Optional introductions follow actual course capabilities. Gamification, chatbots, and Learning Analytics must disappear when unavailable, including their navigation and related teasers. An embedded chatbot uses existing authentication, disclosure, and usage controls and loads only after a student chooses to open it. Course points, global XP, leaderboard participation, research consent, and Learning Analytics choice remain distinct concepts.

This update reviews the existing work and records the remaining roadmap. It does not implement the open milestones or establish production readiness.

## Verified state

| Area                | State on 2026-10-07                                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Checkout            | `trees/rs/student-docs-prototype`, branch `rs/student-docs-prototype`, tracking `origin/v3`                                                                                                               |
| Prototype commit    | `de715646769cf45be27022dd871776336c647bbf`; four added files: product brief, component, preview route, and this project document                                                                          |
| Baseline and target | Parent `27f2474547df045cc11302c7d9e195798ec66870`; fetched `origin/v3` is `103255c85db481d9ea4f854bd350e69446b43bd5`; task branch is 1 ahead / 171 behind                                                 |
| Delivery            | No remote task branch or PR found. No exact-head CI evidence. Production `/docs` is unchanged; `/docs-prototype` returns `notFound` in production builds                                                  |
| Working changes     | Existing unrelated `util/dev-runtime.sh` modification preserved. This review changes only this roadmap                                                                                                    |
| Preview runtime     | `/docs-prototype` returns HTTP 502. Read-only devrouter inspection reports `drifted`, no active apps/processes, and incomplete managed-route inspection. Current live browser verification is unavailable |

The earlier runtime was retained for the user's requested preview. Its historical availability is not evidence of current health. No runtime was started, repaired, stopped, or deleted during this review.

### Completed prototype work

- Implemented the designer assets in the actual PWA component, with a visual introduction, activity illustrations, setup links, sticky navigation, and a separate Progress & Data view.
- Added course-aware gamification and chatbot visibility. A no-course development preview has independent feature switches; real-course analytics remains hidden.
- Added flashcard reveal, illustrative chatbot modes, a click-to-mount real chatbot iframe, and preserved iframe state while changing views. Synthetic examples are labelled; planned analytics controls are disabled.
- Corrected malformed/repeated `courseId` preview selection and the reported hydration mismatch. The initial server/client render now agrees before preview features appear after mount.
- Produced standalone HTML exports with embedded fonts/assets and desktop/mobile screenshots. These supplement the app implementation; they are static captures.

Implementation references: [product brief](../../apps/frontend-pwa/PRODUCT.md), [preview route](../../apps/frontend-pwa/src/pages/docs-prototype.tsx), [guide component](../../apps/frontend-pwa/src/components/docs/StudentDocsPrototype.tsx), and [current production docs](../../apps/frontend-pwa/src/pages/docs.tsx).

### Evidence and limits

September verification recorded passing PWA typecheck, focused Biome checks, and browser checks at desktop and 390px/360px widths. It covered eight feature combinations, keyboard heading focus, view switching, anchors, flashcard reveal, illustrative chatbot modes, disabled consent, no automatic iframe, malformed query parameters, and the hydration correction.

Those results are historical. Repository-wide checks had unresolved failures during the previous takeover; they must not be reported as passing. A real authenticated chatbot conversation, production `/docs` integration, German content, and working analytics controls have not been verified. The current 502 prevents fresh interaction or responsive acceptance.

The October review inspected the committed source, current `v3` contracts, original docs content, and retained captures. An independent read-only Standards + Spec review confirmed the locale gap, first-chatbot-only behavior, and missing real chatbot verification. Main-session review additionally found the points claim and embedded fallback issues below. No application code or runtime behavior changed in this review.

Local review artifacts remain under `/Users/roland/.codex/visualizations/2026/09/06/01a07701-4e6d-7281-95da-aa2d2ddf955e/designer-refinement/`, with `guide.html`, `progress.html`, and responsive captures. `designer-refinement-review.zip` is in its parent directory. They depict the September prototype, not a newly verified runtime.

## Content coverage and placement

Use the landing page for orientation, a useful example, and the next action. Public tutorials own detailed procedures and changing rules. Reconcile their claims against current behavior before linking them as authoritative help.

| Topic                          | Prototype coverage                                                            | Landing page and linked detail                                                                                                                                                                                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Joining and accounts           | Short getting-started guidance and account tutorial link                      | Keep first-visit orientation and existing-account advice. Put LMS-specific setup, course PINs, recovery, and guest limitations in [student accounts](../../apps/docs/docs/student_tutorials/student_accounts.mdx)                                                                         |
| Live participation             | Live quiz illustration, Q&A/feedback explanation, tutorial link               | Keep the activity summary. Put direct joining, temporary live-quiz identities, and detailed feedback instructions in [live quizzes](../../apps/docs/docs/student_tutorials/live_quiz.mdx)                                                                                                 |
| Practice and flashcards        | Answer reveal, bookmarks, feedback, repeatability                             | Add a concise explanation of the course practice pool and spaced repetition, plus reporting a faulty question. Put controls and detailed behavior in [practice quizzes](../../apps/docs/docs/student_tutorials/practice_quiz.mdx)                                                         |
| Microlearning and groups       | Short summaries and links                                                     | Retain availability/deadline guidance. Keep attempt rules in [microlearning](../../apps/docs/docs/student_tutorials/microlearning.mdx) and group formation, shared submissions, and distributed hints in [group activities](../../apps/docs/docs/student_tutorials/groups_activities.mdx) |
| Gamification                   | Course points, global XP/levels, milestone illustration, optional leaderboard | Correct leaving consequences. Explain the benefit briefly; move scoring numbers, multipliers, repetition rules, and leaderboard details to [course leaderboard](../../apps/docs/docs/student_tutorials/course_leaderboard.mdx)                                                            |
| Chatbots                       | Modes, example prompts, limitations, credits, embedded opening                | Show only accessible course bots. Link [chatbot help](../../apps/docs/docs/student_tutorials/chatbot.mdx) for modes, disclosures, credits, and conversation controls; audit claims against current settings                                                                               |
| Learning Analytics             | Illustrative benefit and disabled choice controls                             | Eventually show the account choice and its course applicability. Keep detailed data-use explanation in maintained privacy/help content; activation has a separate dependency below                                                                                                        |
| Installation and notifications | Android Play Store link, iPhone help, notification FAQ                        | Coverage retained. Keep direct install links; use [app installation](../../apps/docs/docs/student_tutorials/klickeruzh_app.mdx) for device steps and the course notification bell                                                                                                         |
| Privacy and support            | General advice, sign-in FAQ, support illustration                             | Add direct profile/data-use and privacy links. Keep general missing-activity help available without a chatbot; leave course rules and deadlines to teaching teams                                                                                                                         |

The Android Play Store destination remains `ch.uzh.bf.klicker.pwa`; the linked iOS section exists in the tutorial source. Public tutorial files exist for all slugs used by the prototype. Live website/store destinations were not checked in this review and remain part of link acceptance.

## Findings to resolve

### Confirmed source defects

1. **Incorrect leaving consequence.** `StudentDocsPrototype.tsx:880–884` says leaving a leaderboard retains collected points. Current `v3` `leaveCourseLeaderboard` deletes leaderboard entries and resets timeline `collectedPoints` to zero. Correct this statement while retaining the valid distinction that leaderboard opt-out does not revoke course or chatbot access. Do not generalize this into a claim that every learning record is deleted.
2. **New-tab fallback retains embedded mode.** `docs-prototype.tsx:75` supplies `?embed=true`; `StudentDocsPrototype.tsx:799` and `:805` reuse the same URL for the iframe and new-tab link. Current chat UI suppresses disclaimer reopening in embedded mode, so that link cannot provide the normal recovery interface after a decline. Supply separate embedded and normal destinations; verify the complete flow after integration.
3. **General missing-activity help depends on chatbot availability.** `StudentDocsPrototype.tsx:1143` gates the combined activity/chatbot FAQ on `chatbotEnabled`. Keep generic activity help visible and condition only chatbot-specific guidance.

### Production and design gaps

The prototype is predominantly hardcoded English despite a localized PWA shell. Move student-facing copy into the existing i18n system before production use. `courseChatbots[0]` exposes only one bot; make all accessible bots discoverable, using a selector when several exist and a direct action when only one exists.

Guide/progress view state is local React state. Direct links to progress sections cannot reveal the hidden view after a reload. Preserve section navigation, browser history, locale, and course context with a URL-addressable view, while retaining an opened chatbot across view switches.

The historical 390px capture shows tall stacked activity cards consuming the initial viewport, with setup actions below them. Compact the mobile introduction so students can reach a useful action earlier. Keep desktop illustrations and the PWA visual language. This is a design refinement to validate in the browser, not a currently measured runtime regression.

Privacy/support sits behind Progress & Data whenever progress features exist, and advice about settings lacks a direct destination. Keep a stable help/privacy entry regardless of feature combination. Make the resulting destination obvious without introducing a course-specific OLAT map.

### Learning Analytics dependency has changed

Current `v3` includes account-wide data-use choices, onboarding, and profile controls. Reuse these contracts rather than implementing a second consent system. In particular, choice-recorded state, disclosure version, revision conflicts, saving failures, and withdrawal confirmation are already handled by the existing account flow.

Optional analytics processing is still disabled: `isLearningAnalyticsEnabled()` returns `false`. The course overview query does not expose a course analytics gate. The accepted direction remains an account-wide participant choice plus an independent course gate, as described in [ADR 0023](../../docs/adr/0023-global-learning-analytics-choice-and-course-gate.md).

Account choice availability does not prove active course analytics, executed withdrawal cleanup, or student-facing analytics results. Keep course analytics introductions hidden until the course capability exists. Account privacy/settings remain independently reachable. Recommend releasing the core documentation before analytics activation if the other acceptance checks pass.

These upstream findings refer to `origin/v3` at `103255c85db481d9ea4f854bd350e69446b43bd5`, not the older task checkout. Relevant paths are `apps/frontend-pwa/src/components/participant/DataUseSettings.tsx`, `apps/frontend-pwa/src/pages/account/data-use.tsx`, `packages/graphql/src/graphql/ops/FParticipantAccountDataUse.graphql`, `packages/graphql/src/lib/learningAnalytics.ts`, `packages/graphql/src/services/courses.ts`, and `apps/chat/src/components/assistant.tsx`.

## Remaining roadmap

The following packages describe the next implementation work; none is complete. The execution session owns integration and proof. Backend analytics remains an explicit dependency rather than an implicit expansion of this UI task.

### 1. Recover a current, verifiable baseline

Owner: docs implementation. Dependency: existing branch and retained runtime state.

Integrate current `v3` deliberately in the task worktree before production wiring, preserving the unrelated runtime-script change. Reconcile current PWA, authentication/handoff, chatbot publication, leaderboard, and data-use contracts. Restore only the runtime scope needed for the selected checks; PWA-only preview does not prove a real chat interaction.

**Complete when:** the integrated revision is recorded, applicable checks pass without bypass, and the routed PWA serves both the existing docs and prototype without hydration errors. Record the exact runtime and retained/stop decision under the lifecycle workflow.

### 2. Finish content and navigation within the PWA

Owner: docs implementation. Dependency: package 1 for live acceptance.

Correct the three confirmed defects. Complete the coverage map, direct privacy/settings links, mobile first-screen refinement, URL-addressable views, and English/German content. Keep illustrations synthetic and labelled. Audit linked tutorials, especially scoring, guest access, chatbot disclosure, and credits, before carrying forward old claims. Update detailed help in its existing public-site pages instead of expanding the landing page into a manual.

**Complete when:** every original topic has an explicit home, all linked destinations/anchors work, optional features leave no orphaned navigation, and desktop/mobile keyboard checks pass in both locales. Opening a progress deep link reveals the correct view; returning to the guide preserves an opened chatbot.

### 3. Integrate the core production documentation

Owner: docs implementation. Dependency: packages 1–2.

Wire the reviewed experience into production `/docs` with existing course context and entry links. Preserve generic first-visit guidance without inventing course capabilities. Keep capability-dependent sections closed while data is missing, loading, invalid, or restricted by assessment context. Reuse suitable existing queries without unnecessarily coupling the introduction to participant groups or leaderboard data.

Make every accessible course chatbot discoverable. Retain click-to-open embedding, a normal new-tab destination, and existing auth/disclosure behavior. Handle unavailable chat cleanly. Preserve `Participation.isActive` as leaderboard opt-in only; it must not become a course or chatbot access check.

**Complete when:** production `/docs` works from direct and LMS entry links with no development controls, synthetic settings, or preview-only claims. Verify signed-in/anonymous entry, missing/repeated course IDs, feature combinations, assessment restrictions, and a real authenticated chatbot turn with reload and declined-disclaimer recovery. Keep the preview route development-only or retire it in the integration change.

### 4. Connect analytics choices when the course capability is ready

Owner: docs implementation for presentation; analytics implementation for capability and processing. Dependency: existing account-choice API plus released course eligibility and consent-aware processing.

Reuse the account choice in the course analytics section, making its account-wide scope explicit. Show the section when the course offers analytics even if the student has opted out: consent controls processing eligibility, not access to the explanation and choice. Explain a concrete learning benefit and withdrawal consequences without promising grades, anonymity, aggregate-only lecturer access, or retroactive aggregate removal. Provide a route to the existing account settings; do not duplicate research consent or store a course-local analytics choice.

**Complete when:** course availability, participant choice, and processing eligibility agree; unresolved choice is distinguishable from opt-out; saving and conflict/failure states are truthful; withdrawal behavior is verified against the released implementation. Until then, the core docs can progress with course analytics hidden and account settings accessible.

### 5. Verify and deliver the production change

Owner: docs implementation. Dependency: packages 1–3; package 4 only if analytics is included in that release.

Run required source checks and focused behavior coverage on the integrated change. Capture fresh 1280px, 390px, and 360px views in English/German, with meaningful enabled/disabled variants. Check keyboard/focus, anchors, browser history, iframe lifetime, and hydration. Use synthetic test data. Refresh the static handoff export and screenshot gallery from the verified app.

**Complete when:** findings are resolved or explicitly deferred with safe behavior, required checks and integrated review pass, a draft PR has current evidence, and the export matches the reviewed app. Keep merge, marking ready, and release as their separate authority boundaries. A static export or green PWA typecheck alone is not production acceptance.

## Immediate next step

Resume with package 1, then fix content and navigation before further decorative design work. The visual direction is established. Current priorities are factual accuracy, real course integration, and current browser evidence; analytics activation can follow on its own dependency schedule.

## Approved execution batch — 2026-10-07

The user approved working through this roadmap with a native goal. Terminal: reviewed draft PR against `v3`, current applicable checks, responsive English/German captures, and refreshed static review exports. Merge, readiness, deployment, destructive database recovery, new paid model traffic, and runtime/worktree deletion remain outside this batch. Analytics activation is deferred because its prerequisites are absent; existing account data-use settings remain reachable.

Execution mode: standard (runtime main-model identity is not proven to be on the solo allowlist). Full-path ceremony. One cohesive student documentation PR: component, route, translations, and linked tutorial corrections share one audience and release outcome; no new backend capability or stack topology is needed. Main owns integration, runtime, public contracts, final proof, and delivery.

### Primitive impact

| Primitive | Disposition | Contract and consumer |
| --- | --- | --- |
| Course access and published chatbot | Reuse/compose | Existing queries and chatbot handoff enforce access; guide exposes all accessible bots, without interpreting leaderboard membership as access |
| Leaderboard participation and XP | Reuse | Explain existing opt-in/reset consequences and separate account-wide XP; no new write path |
| Account data-use choice | Reuse | Link the existing account settings; no duplicate mutation or course-local consent |
| Course analytics capability | Deferred | No released capability means no production analytics section or controls |

### Ownership and implementation sequence

1. Main integrates `origin/v3`, preserves the historical runtime workaround in the recovery stash, and resumes the exact PWA profile. Acceptance: current source and producing-run runtime evidence; no conflict markers. Commit the integration after checks.
2. One trusted implementation worker owns `StudentDocsPrototype.tsx` and the paired `en.ts`/`de.ts` messages for its content. It corrects content, adds accessible multi-chatbot selection, compact mobile orientation, URL view navigation, and persistent help/privacy links. Main independently owns `docs.tsx`, `docs-prototype.tsx`, PWA header entry links, and any minimal generated query needed for course settings. Acceptance: capability/locale/context behavior and focused PWA checks. Existing component is reused; rename only if necessary for production clarity.
3. Main audits linked public student tutorials against source, making only factual corrections or concise missing help necessary for the new docs. Acceptance: installed site build/link checks plus live destinations where available.
4. Main verifies integrated docs, prototype and account entry with desktop/mobile, both locales, disabled/error/assessment states, view/deep-link/history behavior, iframe lifecycle and normal fallback. Real chat validation uses existing deterministic/synthetic local test infrastructure; external paid traffic requires named authority. Capture through agent-browser and the screenshot-gallery workflow. New behavior coverage, if needed, belongs in `playwright/tests/Y-student-docs.spec.ts`, with harness-owned interception for capability/error states, no production test-only branches.
5. Run simplification and integrated review, correct accepted findings, complete runtime lifecycle, refresh export under the existing visualization artifact directory, then ordinary task-branch push and draft PR with screenshot evidence. CI/final-review workflow follows repository rules. Update roadmap completion evidence.

### Test portfolio

| Observable risk | Obligation and boundary |
| --- | --- |
| Hidden features leak into unavailable/invalid/assessment contexts | Add minimal browser behavior coverage using synthetic intercepted GraphQL; assert UI presence and state, not prose |
| Direct progress links/history drop locale or course context | Browser behavior regression covering reload/back and query preservation |
| Chat iframe loads automatically/remounts or normal fallback uses embedded mode | Browser contract check with synthetic bots; real authenticated turn separately |
| Translation/layout/hydration | Native typecheck, paired message keys, agent-browser responsive/locale checks; no prose snapshots |
| Consent mutations and scoring | No new test: this package adds no mutations or scoring behavior; verify factual descriptions against current source |

### Progress

Goal active. `v3` at `103255c85db481d9ea4f854bd350e69446b43bd5` merged without source conflicts, pending commit/checks. Local runtime workaround conflicted during stash application; current upstream script selected and the original preserved in `stash@{0}` (`student-docs pre-v3-sync 2026-10-07`). Roadmap restored. Canonical runtime resume running in host context after sandbox process-inspection denial. No bypass or manual provider mutation.

### Planner correction and frozen implementation contracts

Capability reads use a minimal new client operation `packages/graphql/src/graphql/ops/QGetStudentDocsCourse.graphql` selecting the existing `getCourseOverviewData.course` fields `id`, `displayName`, `color`, `isGamificationEnabled`, and `isAssessmentEnabled`. No server/schema capability is added. Both route wrappers share that operation; a feature is available only after a successful current query with the requested course ID, no loading/error, and non-assessment environment/course. Chatbots additionally require the current successful chatbot query. A course-ID change clears mounted chatbot state. Invalid, missing, failed, partial, or stale query results never enable course features. Generic guidance and assessment warning remain available.

Delegation Map: native `executor` owns slice 2's existing component and exactly `packages/i18n/messages/en.ts` and `packages/i18n/messages/de.ts`; depends on current source and returns paired keys and behavior checks. Main owns slice 1 integration/runtime; slice 2 route/query/header wiring in `apps/frontend-pwa/src/pages/docs.tsx`, `apps/frontend-pwa/src/pages/docs-prototype.tsx`, `apps/frontend-pwa/src/components/common/Header.tsx`, and the named new operation; slice 3 tutorial corrections plus the contradictory paragraph in `docs/domain-model.md`; slice 4 `playwright/tests/Y-student-docs.spec.ts` and screenshot/export verification; slice 5 reviews/delivery. Each slice appears once. Keep the existing component filename; no additional abstraction or file beyond the named operation and test spec. `executor` is eligible for public source only; runtime, fixtures, local artifact paths, and secrets stay with main.

Test obligations: capability/stale-transition/multiple-bot/iframe/view-history risks are `add new` in the named browser spec, using test-owned GraphQL interception and existing mock chat stream. Generic help with all features disabled and assessment guidance are included. Locale/layout/hydration is `none` for new maintained tests beyond those behavioral cases; verify through typecheck, matching message keys, browser captures and console checks. Consent/scoring is `none` because no mutations or algorithms change.

Chat acceptance uses `playwright/util/chat.ts:mockChatStream` for deterministic browser-intercepted model SSE, keeping real authentication, disclosure and thread APIs where possible. Explicitly test initial disclosure, decline blocks conversation, normal-tab link drops embed mode, reopening and acceptance, then conversation/reload. Report that model generation is intercepted. If persistence of an intercepted response cannot be proven, keep that acceptance open; do not claim model-backed E2E from iframe checks. Do not seed/reset retained databases; fixture writes require an already marked disposable test database.

Slice 2 arms one slice-reviewer pass covering course capability/access composition, context transitions, and chatbot embedding; run alongside simplification after its commit. Final review covers full committed scope. Initial planner findings are accepted as constraints; revised batch remains within the user's approved roadmap.

Final ownership correction: split package 2 into slice 2a (native `executor`: existing guide component and paired messages) and slice 2b (`main`: production/preview routes, header docs entry, named client operation and generated outputs). Slice 2a depends on integrated source; slice 2b consumes its props contract. Combined acceptance and the committed-range slice review cover both slices once, before package 3.

Shared component contract: retain `StudentDocsPrototype`; accept `gamificationEnabled`, `learningAnalyticsEnabled`, `previewChatbot`, `preview` (default false), and `chatbots` (default empty) containing `id`, `name`, normal `href`, and `embeddedHref`. Wrappers derive current capabilities and assessment restrictions; component owns selector/open state and URL-addressable guide/progress navigation, clearing bot state when course context or selected bot changes. Production always passes analytics false and no preview features; development wrapper alone may show synthetic examples. Synthetic activity illustrations remain labelled in both contexts. No route-to-component dependency on a new hook or abstraction.

### Current implementation evidence — 2026-10-07

Integration committed as `d68c2fe610`, with `v3` source `103255c85db481d9ea4f854bd350e69446b43bd5`. Component, route/query/header wiring, paired English/German messages, linked tutorial corrections, and four browser behavior cases are implemented. Production analytics remains hidden; account data-use settings are always reachable. Production `/docs` reuses the existing server-side participant/LTI handoff and cookie/session fallback so a first LMS launch can discover accessible chatbots. No new authentication or consent primitive is added.

Native checks: container workspace type checks (35 tasks), lint (7 tasks), syncpack and repository guards passed; staged upstream formatting passed; host workflow suites passed 125 tests using the temporary repository-pinned devrouter CLI. PWA and Playwright type checks and focused Biome passed. Public docs build passed with unrelated existing broken-anchor warnings. Hook equivalents ran across host/container boundaries because the retained host dependency tree is stale; no host reinstall or global configuration change was made.

The user separately approved guarded initialization of this worktree's marked disposable `klicker_test` and `klicker_test_shadow` schemas with synthetic seeds. Recovery completed successfully. Runtime identity: Devsy `rs-student-docs-prototype`, exact checkout `/Volumes/HOME/Git/klicker/klicker-uzh/trees/rs/student-docs-prototype`, compose project `default-rs-b8e16`. Canonical startup fails on managed source-configuration drift; non-destructive stop fails on retained container identity mismatch. Exact runtime recreation is awaiting named approval. Browser acceptance, captures/export refresh, slice/final reviews and draft delivery remain open; source checks alone do not complete the package.

Implementation revision: `5f9b34b27b`. Root production build passed 23 tasks, including production `/docs`; `/docs-prototype` remains absent from the production pages manifest. Simplification found no concrete behavior-preserving reduction. Risk review and final source review are running; browser evidence is still pending. The root build emitted existing manage translation/precaching and shared-package warnings without failing.

Public link inspection confirmed the Android Play Store app and public account, live quiz, practice quiz, microlearning, groups, chatbot, and installation pages resolve. The iOS anchor exists. The leaderboard destination timed out in both web retrieval and direct HTTP; its repository page builds, but live destination acceptance remains open. Tutorial corrections are committed source, not yet published website behavior.

Draft PR: https://github.com/uzh-bf/klicker-uzh/pull/6428, target `v3`. CI started at `3cc1be0bba`; no runtime/capture evidence claimed. Substantive package size against `v3`: 2,790 added/deleted lines excluding project artifacts; one cohesive student-introduction audience and release, no backend schema change or separate runtime model.

Slice review confirmed capability/access composition and content corrections. Its only threshold finding was the still-open integrated chat/disclosure obligation. A fifth behavior case now covers the real embedded refusal and normal-view recovery paths, accepted disclosure, a deterministic intercepted response, and saved thread/disclosure on reload. The spec selects the `chat` runtime profile (PWA/API/auth plus chat). Intercepting POST `/chat` bypasses server-side message persistence, so generated-message persistence remains explicitly unproven. Test types pass; execution awaits runtime recovery.

Configured final review failed before work on expired Claude authentication; the AGY fallback could not read files in headless mode. Ordered GLM fallback is running with the complete final-review contract. Exact runtime recreation approval remains pending; the failed non-destructive stop has not been bypassed.

Final source review completed through the ordered GLM fallback with no threshold findings. Canonical result schema validated; completed report is in the ignored review directory. Slice review accepted the integrated test correction as source coverage. Neither gate proves browser acceptance; five browser cases have not executed. The exact provider reports `Running` after the failed guarded stop, with no matching task routes returned by devrouter. Runtime release remains unverified. The pending exact recreation request is the next human authority boundary. CI remains pending; draft delivery is in progress, and the native goal is not complete.
