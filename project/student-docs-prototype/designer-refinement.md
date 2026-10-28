# Student documentation: production guide and finishing pass

Updated: 2026-10-26. Draft: [PR #6428](https://github.com/uzh-bf/klicker-uzh/pull/6428), branch `rs/student-docs-prototype`, target `v3`.

## Approved outcome

Make `/docs` the student landing page inside the existing PWA: a visual introduction, a useful next action, concise guidance and links to detailed public tutorials. It also serves as a course entry from an LMS, without explaining a course-specific OLAT structure. Keep the Student Guide and Progress & Data views, the PWA layout and controls, Android Play Store and iPhone installation, account setup, notifications and help.

The user approved the October 26 three-step finishing proposal with “approved”, then requested co-writing with Claude Opus 5.5 and `rs-prose`. The current executable batch integrates current `v3`, checks compatibility with production-source `v3-ai` and pending session recovery, refreshes the student copy with Claude Opus 5.5 and `rs-prose`, verifies the combined app and refreshes the review artifacts. Terminal: a verified draft with current evidence, or a concrete capability blocker after independent work is finished. Ordinary task commits, non-force pushes and draft description updates are authorized. Merge, readiness changes, deployment, new paid model traffic and deletion of other worktrees, runtimes or data are excluded.

Further AI code review was waived. The explicit Claude request covers co-writing the student text. Existing source reviews remain reusable where their contracts are unchanged; main owns source inspection, factual validation and final proof.

## Binding behavior

- Course introductions depend on successful current capability queries. Missing, failed, stale, malformed, loading and assessment contexts hide optional gamification and chatbot sections and their navigation. Generic help and account settings remain reachable.
- The minimal `GetStudentDocsCourse` operation composes existing course-overview fields; it adds no server capability. Published chatbots use the existing participant discovery query. Leaderboard opt-in never grants course or chatbot access.
- Every accessible bot can be selected. Its iframe mounts only after an explicit action, survives guide/progress switches, and clears when course or bot identity changes. The normal-tab fallback omits embedded mode and preserves disclaimer recovery.
- Guide/progress links preserve locale and course context through direct links, reload and browser history. Preview switches and synthetic analytics controls remain development-only.
- Current `v3` and `v3-ai` reset timeline course points and remove leaderboard entries when leaving. Account-wide XP and course access remain separate. Pending [#6257](https://github.com/uzh-bf/klicker-uzh/pull/6257) changes this to private point retention; update the guide, FAQ, tutorial and domain wording together when that behavior lands.
- Existing account-wide research and Learning Analytics choices are saved by the account flow. The course analytics section stays hidden until the separate course gate and consent-aware processing exist. Do not add a second consent system or present illustrative controls as saved choices. See [ADR 0023](../../docs/adr/0023-global-learning-analytics-choice-and-course-gate.md).

## Content ownership

| Topic                     | Landing page                                                                               | Linked detail                                                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts and installation | Course link, sign-in, Android and iPhone setup actions                                     | [Student accounts](../../apps/docs/docs/student_tutorials/student_accounts.mdx), [installation](../../apps/docs/docs/student_tutorials/klickeruzh_app.mdx)                                                              |
| Live participation        | Question/feedback example and next action                                                  | [Live quizzes](../../apps/docs/docs/student_tutorials/live_quiz.mdx)                                                                                                                                                    |
| Independent practice      | Practice Quizzes, Practice Pool, flashcards, bookmarks, microlearning and groups           | [Practice](../../apps/docs/docs/student_tutorials/practice_quiz.mdx), [microlearning](../../apps/docs/docs/student_tutorials/microlearning.mdx), [groups](../../apps/docs/docs/student_tutorials/groups_activities.mdx) |
| Chatbots                  | Available course bots, modes, trying the actual chat and a short accuracy/privacy reminder | [Chatbot tutorial](../../apps/docs/docs/student_tutorials/chatbot.mdx) owns attachments, dictation, read-aloud, answer controls, credits, sources and disclosure procedures                                             |
| Progress and privacy      | Course points versus global XP, optional leaderboard, direct account choices and help      | [Leaderboard](../../apps/docs/docs/student_tutorials/course_leaderboard.mdx), existing account data-use page and privacy policy                                                                                         |

Use the visible Practice Pool terminology. Describe current functions rather than all pending roadmaps: personal generated cards, Anki, FSRS, offline practice and adaptive selection are separate workstreams. Illustrative activity, leaderboard and analytics values remain labelled synthetic.

## Finishing sequence and ownership

Execution mode: standard, resuming the existing full-path package. No new stack or independent feature is introduced.

1. Main integrates `v3` once for freshness and the recently merged chat features. It owns runtime recovery and source compatibility. Acceptance: no unresolved merge, existing docs/header/query contracts preserved, no unrequested source changes.
2. Claude Opus 5.5 co-writes the bounded English/German guide keys and linked chatbot/practice tutorials using `rs-prose`; main applies only source-verified edits. Acceptance: concise paired text, existing links/placeholders preserved, current points and privacy facts retained. This is prose collaboration, not a new code-review gate.
3. Main verifies the actual PWA and linked docs, captures EN/DE desktop/mobile states and refreshes the existing review export. Acceptance: meaningful behavior tests, no overflow/hydration regression, a working authenticated embedded/fallback path, and explicit evidence limits. Real external OLAT acceptance needs a supplied test-course entry and signed-in browser; synthetic LTI handoff is recorded separately.
4. Main inspects the final diff, runs applicable checks, commits and ordinarily pushes the existing task branch, updates the draft evidence and canonically stops the exact runtime. Acceptance: source identity, CI and screenshot claims agree; provider/route state is recorded truthfully.

## Verification portfolio

| Risk                                                                      | Evidence                                                                                                                                                 |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capability leakage, course transitions, multiple bots and iframe lifetime | Existing `playwright/tests/Y-student-docs.spec.ts` with test-owned capability fixtures                                                                   |
| Locale, direct views, reload and history                                  | Existing browser cases plus responsive captures at 1280px, 390px and 360px                                                                               |
| Chat authentication, disclosure refusal and normal-view recovery          | Existing integrated browser case with real synthetic authentication/disclosure/thread APIs; generated output is intercepted                              |
| Text, translations and linked tutorials                                   | Focused formatter/type checks, paired keys and public docs build/link checks; no prose-pinning tests                                                     |
| Scoring/consent                                                           | No new mutations or scoring changes; inspect current source for factual accuracy                                                                         |
| Actual OLAT entry                                                         | Separately identify environment, course entry, authentication mode and browser evidence; do not substitute a signed-token fixture for external LMS proof |

The browser chat fixture proves thread/disclosure recovery, not server-side persistence of intercepted generated messages or live model quality. A separate provider-boundary fixture or authorized live qualification is needed for those claims. Public tutorial source corrections need the website's normal delivery.

## Progress

The October 8 application revision `5f9b34b27b` was delivered through `3a575344f8`. All five guide browser cases passed locally; final codebase and Playwright workflows passed at that head. EN/DE captures, synthetic signed LTI handoff, account choice access and seventeen published screenshots were verified. Completed source reports remain under the ignored review directory. [Codebase run](https://github.com/uzh-bf/klicker-uzh/actions/runs/37758611460) and [browser run](https://github.com/uzh-bf/klicker-uzh/actions/runs/37758611906) are historical evidence for that source.

October 26 review confirmed the branch was stale and the preview returned 502. The provider reported NotFound while four routes remained registered. The old running-container collision is historical, not a current diagnosis. The installed host CLI was version 0.1.0; a temporary repository-locked 0.5.1 CLI is used for this checkout, without a global tool change.

Current `v3` at `712cb42d0d061564577be4852880b8714c88989e` merged cleanly in `4aaa73ee9816a132a2b4f08a6a63fb5452c602dd`. It supplies the newer chat attachments, dictation and answer-preference functions. Production-source `v3-ai` still exposes the participant-token/cookie result consumed by the docs wrapper. Pending [#6414](https://github.com/uzh-bf/klicker-uzh/pull/6414) adds session revision, establishment and frame metadata; its eventual integration must include this new docs route in its session-prop migration. Do not import its unmerged auth implementation into the documentation package.

The temporary pinned CLI has canonically reconciled the absent runtime and freed its four stale routes. Claude Opus 5.5 completed the bounded co-writing pass. Main applied paired English/German landing copy, consistent Practice Pool terminology and the linked practice/chatbot tutorials, then checked attachment, dictation and preference claims against source. The PWA type check and lint passed; the public documentation build passed with existing anchor warnings. No behavior tests were added for prose.

The first chat-profile preparation stalled after a utility build and was canonically stopped. An isolated build passed. Startup outside the sandbox then completed; process-identity inspection is unavailable inside the sandbox. All five guide browser cases passed against the integrated source, including real synthetic authentication, disclaimer refusal and normal-view recovery. Agent-browser confirmed EN/DE at 1280px, 390px and 360px without horizontal overflow or page errors. Guide and progress exports were regenerated from current DOM/CSS with local fonts and images embedded; local navigation and desktop/mobile rendering passed.

Container-dependent pre-commit checks passed (35 type/build tasks); host-only launcher checks passed 41/41, and CI/runtime contracts passed 118/118 on the host. The unsplit root command rejects the host-only tests inside a container, so those checks were run at their required boundary. Test delta: no new, changed or removed tests. Existing reviews are reused; further AI code review remains waived.

Packaging: 2,921 substantive added/removed lines against `v3`, excluding project artifacts and lockfiles. This is the existing cohesive guide package; this finishing pass introduces no new stack or capability.

The production build passed all 23 tasks; the final public documentation build also passed. A generated Next.js dev/production type collision was resolved by stopping the owned app processes and preserving the generated dev-type directories outside compiler inputs, following the existing runtime guide. No application source or type-checking policy was changed. The exact task runtime was canonically stopped after verification; the source-path ownership record has zero routes and its matched Devsy provider reports Stopped. Use the draft PR for the published source, screenshot and CI status. External OLAT verification is blocked on a supplied test-course entry and signed-in browser; the question is already pending. Synthetic handoff evidence does not replace it.

## Later dependencies

Course analytics activation follows its own capability/privacy package. The new guide must be included in the design-system v5 and mobile-navigation consumer acceptance when those branches integrate. Public account/chatbot tutorial edits overlap website/documentation work and should retain one coordinated version. The existing real-OLAT verification task remains the home for external LMS acceptance. Historical implementation logs and earlier draft states are available in Git history; they do not override this current status.
