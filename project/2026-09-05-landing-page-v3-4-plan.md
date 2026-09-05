# Landing page implementation: teaching value and release clarity

## Approved execution amendment

On 5 September 2026 the user approved the reviewed proposal and requested implementation in a new PR. This supersedes planning-only and existing-PR amendment statements below. Topology: `v3` → existing [website refresh PR](https://github.com/uzh-bf/klicker-uzh/pull/5791), branch `rs/website-v3-4-refresh` at `d7ff68275d2064d35d249ea31a86e01de3bb8ffd` → new `rs/landing-page-v3-4` branch and draft PR. This session owns the native stack in the existing `trees/rs/website-v3-4-refresh` worktree; no individual layer is checked out elsewhere. Native stack support verified through the repository API. No base integration is authorised or performed.

Approval permits source edits, the website-only preview, scoped checks, native reviews, local commits, push to `origin/rs/landing-page-v3-4`, and a separate draft PR targeting `rs/website-v3-4-refresh`, linked as the upper native stack layer. The lower branch is unchanged. Terminal condition: reviewed implementation with recorded verification, stopped preview, published draft PR and host readback. Merge, ready-for-review promotion, upstream rebase/merge, deployment and external outreach remain excluded. User request for a new PR overrides the prior proposal to fold into the lower PR.

Reuse vetted existing screenshots if new product captures require a full application stack; adapt illustrative captions to what those assets actually show. Do not fabricate product UI. Hero and story slice retains `TitleImage.tsx`, `FeatureSection.tsx` ownership; release/access slice owns a new small `ReleaseUpdates.tsx` and homepage-only closing component, leaving shared CTA consumers unchanged. Parent owns page composition, navigation, styles, evidence and all claim decisions. Other existing components stay unchanged if unused by the new page.

Progress: implementation beginning. Prior planner approved the content/design plan after one correction; this amendment changes delivery authority and records the user's requested separate PR.

## Approval summary

Help a lecturer understand what KlickerUZH offers, see a relevant teaching example, and choose a useful next step. The page should explain classroom participation, independent practice and reusable teaching content before asking visitors to interpret product terminology or release numbers.

Recommend a teaching-task-led page with a compact release section. Refresh the hero, replace repeated feature inventories with three illustrated teaching stories, make the strongest v3.3 additions visible, and explain the v3.4 preview in a separate panel. Provide a clear path for new lecturers, retain direct sign-in for returning users, and explain course participation to students. Keep the UZH identity and existing site framework.

This is a planning deliverable only. Proposed implementation would extend the existing [website draft PR](https://github.com/uzh-bf/klicker-uzh/pull/5791), subject to its live state when work resumes. No website source, dependencies, account rules, legal text, tracking, external messages or deployments change under this planning request. The approved maintenance work remains independently reviewable.

The principal risk is overstating availability: the published v3.3 notes label sharing and templates private beta, while current v3.4 source is not a stable-release or deployment receipt. Treat release history and present account access as different facts. Prefer omission or a visible qualification when evidence is insufficient.

Success means visitors can identify the teaching purpose, distinguish available features from previews, find one relevant example, and choose a correctly labelled next action. Verification combines a production build, responsive and keyboard checks, editorial fact checking and a proposed short lecturer comprehension exercise. No conversion gain is claimed without measurement.

Approval of this plan would permit local implementation, synthetic screenshots, scoped checks, required independent reviews and local commits in the existing task worktree. Push or amendment of the draft PR, upstream integration, merge and deployment remain excluded from this new proposal unless explicitly authorised. No implementation has started.

## Direction and alternatives

| Direction | Visitor experience | Decision |
| --- | --- | --- |
| Teaching tasks first | Understand what to do in class, between classes and during preparation; then see relevant features and release changes | Recommended; durable across releases and suitable for first-time lecturers |
| Release showcase first | Lead with v3.3 improvements and v3.4 previews, followed by the existing product story | Useful for returning users; use as a compact secondary section, not the homepage structure |
| AI first | Lead with course chatbots and AI-assisted teaching | Defer: current access and publication constraints would dominate the promise and obscure established capabilities |

Primary audience: lecturers exploring adoption, including lecturers outside UZH. Secondary audiences: existing lecturers checking changes, teaching teams evaluating reuse, and students arriving at the website. This is a proposed audience priority, not an analytics finding. Preserve student and institutional routes without equally weighting every audience in the hero.

## Snapshot, scope and method

Repository worktree: `trees/rs/website-v3-4-refresh`, branch `rs/website-v3-4-refresh`, snapshot `d7ff68275d2064d35d249ea31a86e01de3bb8ffd`. Target is the live draft PR base `v3`. Remote refs refreshed 5 September 2026; branch equals its remote upstream and is ten commits ahead of, one unrelated CI commit behind `origin/v3`. No upstream integration.

Scope: homepage hero and navigation; feature narrative and images; release and access messaging; use-case selection and closing actions. Linked documentation supplies facts and destinations, but detailed tutorial rewrites remain with [the existing documentation PR](https://github.com/uzh-bf/klicker-uzh/pull/5434). English only, matching the current page.

This is a bounded planning assessment of the existing candidate, not a fresh production UX audit or WCAG certification. The preceding task verified the rendered page on desktop, tablet and mobile, including working keyboard/hover controls. Its current desktop screenshot is `project/assets/website-v3-4-refresh/home-after-desktop.png`; recent tablet and interaction evidence is in `project/_local/website-fixes/`. The older `project/_local/website-v3-4-refresh/home-after-mobile.png` contains superseded copy and must not substantiate current wording. Source at the pinned head confirms current content order and mobile image hiding. Capture fresh mobile evidence during implementation before comparing layouts.

One evaluator assessed information architecture and visual hierarchy; another worker checks release facts, not usability. Findings are provisional expert judgments, not measured user failure rates. No overall usability or visual score is assigned because a complete fresh diagnostic matrix, grayscale and contrast pass is not part of this planning task. All source-only observations below are marked. No authentication, backend, paid model, personal data or analytics access is needed for this plan.

Prior-review disposition: keyboard feature selection, About links, overflow, figure sizing, reduced motion and repaired links are fixed in the current draft and must be preserved. Preview qualification and separation of feedback meanings are settled constraints. The remaining issue is the homepage's message and content structure, rather than reopening those repairs.

## Findings and strengths

The current site has a recognisable identity, clear navigation and search, a real classroom photograph, concrete activity documentation and an existing feedback destination. The refreshed prose uses teaching actions, and repaired controls support keyboard operation. Retain these strengths.

Severity uses the UX heuristic scale: 2 means a minor usability problem; 3 means a major task problem. These are single-rater provisional priorities. No task-blocking defect is established here.

| Finding | Evidence and mechanism | Priority and response |
| --- | --- | --- |
| Narrow opening promise | Desktop homepage at 1440px: the logo is the H1 and “Bring students into the conversation” is the only product explanation. `TitleImage.tsx:29` onward. A new lecturer must scroll to learn that independent practice and content preparation are supported | Severity 2; make the teaching proposition the textual H1 and add a concrete explanatory sentence |
| Competing first steps | Desktop hero displays “Sign up or log in” next to “Get started”; the latter opens broad welcome documentation. `TitleImage.tsx:40` onward. Both sound like starting, but lead to different kinds of work | Severity 2; distinguish “Start with a Live Quiz” from “Explore teaching examples”; retain explicit lecturer sign-in in navigation |
| Repeated inventory hides differentiators | Current source (code): three feature lists, a question-pool block and the complete use-case collection precede the closing actions. `index.tsx:16–145`, `UseCaseOverview.tsx:14`. Selection questions, Case Study questions, temporary accounts and reusable Answer Collections are not explained in the opening narrative | Severity 2; use three teaching stories and a small release-specific selection; preserve the full use-case index behind a descriptive link |
| Weak mobile product evidence | Current source (code): `FeatureSection.tsx:67` hides previews below the small breakpoint, and `TitleImage.tsx` hides the hero image below medium. A mobile visitor receives feature copy without its illustrative proof | Severity 2; provide one compact, static image per teaching story on mobile; verify the fresh rendered result |
| Visual priority favours branding and repetition | Desktop 1440px screenshot: large logo, tall hero spacing and two v3.4 notices consume the initial view before a feature is explained. Source `TitleImage.tsx:18`, plus site announcement in config. Source also gives all use-case cards similar weight | Severity 2; reduce hero height, use one release notice, give the teaching proposition and primary action the strongest hierarchy |

These findings cluster around one problem: visitors must assemble the product story from a long catalogue. The change should establish that story before showing the catalogue. Accessibility repairs are acceptance constraints, not evidence that this communication problem has been solved.

## Release and claim ledger

| Evidence | Benefit to explain | Placement and qualification |
| --- | --- | --- |
| Published [v3.3 release, 24 August 2025](https://github.com/uzh-bf/klicker-uzh/releases/tag/v3.3.0): temporary pseudonyms and avatars in gamified Live Quizzes | Participants can appear on the leaderboard without creating a persistent account | Classroom story; scope “no account needed” to the supported Live Quiz participation path, never all activities |
| Same release: Selection and Case Study question types; Answer Collections | Ask students to select from reusable options or assess cases against criteria; discuss aggregated responses | Reuse/preparation story and v3.3 highlight. Automated grading requires a defined sample solution; avoid implying automatic grading of every response |
| Same release: list filtering, activity overview and batch operations | Find and maintain teaching content with less repetitive editing | Reuse story; describe operations, not unsupported time savings or performance percentages |
| Same release: activity templates, direct sharing, catalog collections and user groups introduced with private-beta qualification | Teaching teams can prepare and reuse resources where access allows | “Introduced in v3.3; access varies.” Do not promote these as available to all users. Recheck current eligibility before implementation; otherwise keep the historical qualifier or omit the tile |
| Current `project/2026-09-04-v3-release-notes.md`: Manage and practice improvements | Clearer activity preparation and course practice navigation | v3.4 “In preparation” panel; internal draft is source evidence only. Do not publish alpha numbers, test counts or implementation machinery |
| Same draft and current chatbot tutorial: lecturer draft authoring, guided setup, publication requests, approved access | Lecturers prepare course-specific chatbot support for enrolled students | v3.4 preview; authoring access and publication approval are separate. Existing team-assisted chatbot setup is a different access path |
| Same draft: course-material grounding and conversation modes | Course-specific explanations and practice support | Supporting chatbot detail only after verifying actual course configuration. No claim of infallibility, automatic material ingestion, universal knowledge-base access or unlimited usage |
| Same draft: discoverable beta enrollment | Eligible users can find how to participate | Preview detail, not a guarantee of access. Link to the roadmap until an actual supported signup destination is confirmed |
| Existing public feedback link in navbar/footer/CTA | Report problems and suggest improvements | Closing “Help shape KlickerUZH” link. This is product feedback, distinct from Live Feedback and AI formative feedback |

The release API reports v3.3.0 as the latest published stable release on 5 September 2026. This does not establish deployment or present-day eligibility for every feature. Current roadmap marks AI question generation, AI formative feedback and learning analytics as planned; do not promote them into the available story based on source presence or a use-case article.

## Proposed page and draft copy

Draft copy is a reviewable starting point, not approved publication. Spiral is unavailable in this session; use the direct prose fallback with plain language and factual checks. Keep official feature names consistent, favour verbs and examples, and use British English in surrounding prose. Avoid “revolutionise”, “seamless”, guaranteed engagement or improved attainment, and unmeasured speed claims.

### Opening screen

Eyebrow: **KlickerUZH · Developed at the University of Zurich**

H1: **Live participation and independent practice for your course.**

Supporting copy: **Ask questions, discuss responses and give students opportunities to practise. Build Live Quizzes, Practice Quizzes and Microlearning from one question pool.**

Primary action: **Start with a Live Quiz** → `/tutorials/live_quiz/`. This deliberately makes the beginner path educational rather than dropping an unfamiliar visitor directly into authentication. Secondary: **Explore teaching examples** → `#teaching-examples`. Returning users retain **Lecturer sign-in** → the existing Manage URL in navigation. Do not label the Manage destination “Create a quiz” before sign-in actually reaches quiz creation.

Student helper: **Joining a class? Use the link or QR code shared by your lecturer.** Link to `/student_tutorials/student_accounts/`; do not invent a join-code form or a new participation URL.

Use one compact announcement: **Explore what is new in v3.3 and what we are preparing for v3.4.** → `#release-updates`. Remove the duplicate in-hero preview badge if the announcement remains global. Keep release promotion visually below the teaching promise.

Use the literal H1 as the default because it states the product purpose without depending on the optional comprehension exercise. “Bring your teaching to life” is not the recommended opening.

### Three teaching stories

| Story | Proposed copy | Evidence and next action |
| --- | --- | --- |
| Hear from your whole class | “Ask a question, collect responses and use the results to guide discussion. Students can also ask and upvote questions through Live Q&A.” Supporting detail: “For gamified Live Quizzes, temporary profiles let participants join the leaderboard without creating an account.” | Current synthetic Live Quiz question/results image; link “See a Live Quiz example” to `/use_cases/live_quiz/` (route verified in source) |
| Keep practice going between classes | “Give students questions to revisit throughout the course. Use Practice Quizzes for repeat practice and Microlearning for short activities with a completion window.” | Synthetic student practice image, caption describing visible action; link `/use_cases/practice_quiz/`. Keep Group Activities and optional gamification as supporting detail |
| Build on the content you already teach | “Reuse questions across activities. Create Answer Collections for Selection and Case Study questions, and find or update your content from the question pool.” | Synthetic Selection or Case Study question paired with a reusable collection; link `/tutorials/answer_collections/`. Sharing/templates require their own visible access qualifier |

Use these synthetic examples as the image brief and supporting caption:

| Story | Short teaching scenario | Image subject and caption |
| --- | --- | --- |
| Hear from your whole class | Before explaining diversification, ask which of two portfolios is less exposed to a single company. Discuss why responses differ | Question and aggregate response view with synthetic totals; “Use the class responses to open a discussion.” |
| Keep practice going between classes | After a lecture on probability, students revisit a short Practice Quiz before the next class | Student question with explanation and progress, all synthetic; “Revisit a question and read the explanation before continuing.” |
| Build on the content you already teach | Ask students to select relevant indicators from an Answer Collection, then assess a fictional business case against defined criteria | Selection question beside a Case Study criterion, synthetic content only; “Reuse answer options and compare how students assess a case.” |

Each story gets one concrete example, one relevant image and one descriptive link. Do not add another complete question-type inventory. Use the supported-element-types documentation for the full list. Replace generic screenshot alternatives with descriptions of the action or information illustrated.

### Release section: “What has changed in KlickerUZH?”

Use two clearly labelled columns on desktop and consecutive sections on mobile. These are editorial groups, not switchable tabs or a rotating carousel.

**Introduced in v3.3**

“More ways to participate and work with teaching content: temporary profiles for gamified Live Quizzes, Selection and Case Study questions, and reusable Answer Collections.”

Link: **Read the v3.3 release notes** → published GitHub release or its official community post. Supporting sentence for teams, only if retained: “Sharing and activity templates were introduced in private beta; availability depends on access.” Do not label v3.3 “just released”.

**Preparing for v3.4**

“We are preparing lecturer tools for course chatbots, alongside improvements to activity preparation and course practice. Chatbot authoring depends on account access, and publication for students remains subject to approval.”

Link: **Explore the v3.4 preview** → `/development/`. Include a short factual note: “Preview plans may change.” Do not include a release date until supplied by an authoritative release decision. Keep planned AI generation and analytics on the roadmap.

On release: replace preview copy only after a published release and feature-specific availability evidence exist. Update the announcement, release panel and roadmap together. A version bump alone must not remove access qualifications. Describe each feature as available, restricted preview or planned in words, not only colours.

### Selected examples, access and closing action

Combine the selected examples with the three illustrated stories above, rather than adding another card grid. Their links are Live Quiz → `/use_cases/live_quiz/`, Practice Quiz → `/use_cases/practice_quiz/`, and reusable Answer Collections → `/tutorials/answer_collections/`. Give the whole story section `id="teaching-examples"` and end it with **Browse all teaching examples** → `/use_cases/`. Retain the complete catalogue on that route.

Add a compact trust/access block: **Developed at the University of Zurich. Open source.** Follow with: “Core features are free to use on the public instance. Some features require Catalyst access or beta participation.” Link to Catalyst, the source repository and the existing privacy policy. The current FAQ supports this free-use wording; recheck before publication if policy changes. No new compliance, residency, funding-continuation or support-service claims, customer logos, testimonials or adoption counts.

End with **Start with one activity.** Copy: “Follow the Live Quiz guide, or explore an example that fits your course.” Repeat the primary and secondary actions consistently. Below them, a quieter **Suggest an improvement or report a problem** link to the existing feedback platform, with “Please do not include personal or course data.” Keep community discussion as a separate link.

## Visual and interaction specification

Retain the current UZH blue, neutral backgrounds, logo, fonts and shared design-system tokens. Use a textual H1, roughly 36–48px on desktop and 30–36px on mobile, and readable 16–18px body copy. Use a constrained text measure around 55–70 characters; no new font or animation dependency. Exact sizes are implementation choices within current tokens.

Reduce hero padding so a 1440×900 viewport shows the product explanation, actions and the start of the first teaching story. At 390×844 the H1, explanatory sentence and primary action should be visible without scrolling, provided default text sizing is used. At enlarged text, content may extend vertically; never clip or shrink it to preserve the fold.

Show a readable product example alongside the desktop hero or first story. Prefer newly captured synthetic current UI over the decorative phone photograph as the primary proof. Keep the photograph only if it adds context without pushing product evidence down. If new screenshots cannot be captured within a website-only environment, use vetted existing assets with accurate captions; no real course or student data and no invented product UI.

Keep essential copy and images visible on touch screens. The existing hover/focus previews may be simplified to static illustrated stories; do not create inert selectors for images hidden on mobile. No autoplay, carousel or video gate. Use native links/buttons, clear focus, logical headings, visible access labels, descriptive image alternatives and respect reduced motion. Retain destinations, search, mobile navigation and feedback links. Avoid a second sticky action bar.

## Primitive impact and scope

Existing Live Quiz participation, Practice Quiz/Microlearning activity behaviour, shared resources and permissions, course chatbot publication, and product-feedback intake are reused without semantic changes. The plan changes presentation and navigation only. Temporary participation does not create course access; leaderboard choice does not govern chatbot access. Beta enrollment does not imply publication approval. No new product primitive or ADR is required.

Proposed source scope: `apps/docs/src/pages/index.tsx`, `src/components/landing/{TitleImage,FeatureSection,FeatureFocusSection,UseCaseOverview,CTA}.tsx`, scoped styles and `docusaurus.config.ts` only for the announcement and relevant navigation labels; new vetted synthetic assets under existing image directories. Do not change shared `USE_CASES` descriptions globally just to shorten homepage cards: use a small homepage selection of the existing entries. No new dependencies, analytics events or full tutorial work.

## Delegation Map

All component paths below are relative to `apps/docs/src/components/landing/`. Executors work serially where shared layout dependencies remain; they never edit `index.tsx` or global configuration. Parent owns those integration files and the claim decisions.

| Slice | Owner and exact scope | Dependency and acceptance |
| --- | --- | --- |
| Settle copy, claims and assets | Main; this proposal, existing execution plan and vetted asset choices | Human direction approved; copy, destinations and assets fully specified |
| Build hero and teaching stories | Executor; `TitleImage.tsx`, `FeatureSection.tsx`, `FeatureFocusSection.tsx`, vetted images under `apps/docs/static/img/landing/` | Settled copy/assets; responsive rendered stories and working actions |
| Add release and access content | Executor; `CTA.tsx` and a small `ReleaseUpdates.tsx` component if needed to keep ownership separate | Accepted narrative structure; release labels and qualifications visible beside claims |
| Integrate and verify | Main; `apps/docs/src/pages/index.tsx`, scoped styles, `apps/docs/docusaurus.config.ts`, progress | Both slices accepted; required reviews, verification and stopped preview |

Do not change `UseCaseOverview.tsx` or the global catalogue merely to remove its homepage rendering. Parent removes that call from `index.tsx`; the full use-case route remains intact.

## Delivery sequence and acceptance

| Package step | Owner and reason | Work and acceptance | Conditional estimate |
| --- | --- | --- | --- |
| Settle the message and claim ledger | Main session; product/access decisions cannot be delegated as mechanical copy | Confirm audience, primary action and release qualifiers; verify all proposed destinations and images. Read the full plan and approved boundaries | Half a day if current public evidence settles access |
| Build the hero and illustrated teaching narrative | Executor with bounded homepage component ownership; parent integrates | Implement approved copy and layout. Production build, link/asset checks, screenshot comparison at 390/800/1440px, keyboard/touch selection and no page overflow | 1–2 days if suitable synthetic images already exist |
| Add release, access and selected-example content | Executor with disjoint release/content component ownership after hero structure settles | Every release claim matches ledger; labels remain next to claims on mobile; only valid destinations and approved images; prose read aloud and checked for duplication | Half to one day if eligibility is confirmed |
| Verify and review the integrated page | Main session plus native simplifier and final reviewer | Repeat affected build, formatting, diagnostics comparison, generated-route checks; browser interactions, focus, 200% zoom, image loading and reduced motion. Final review covers content contracts and executable changes | Half to one day if checks remain within website scope |

Commit boundaries: after approval, fold this proposal into the existing execution plan and commit that amendment. Commit the hero/story implementation with its integration after focused checks, then run its native simplifier. Commit the release/access implementation after its focused checks; run the native simplifier and one claim-risk slice-reviewer over that range. Accept or correct those findings, then complete integrated verification and the final-reviewer on the committed whole package. Reviewers are read-only gates, not component owners. Any correction receives the affected checks and the applicable bounded same-reviewer correction pass.

The main session owns final claim decisions, integration and proof. No additional exploration worker is needed for the bounded homepage source; delegation would duplicate already inspected evidence. Required planner review happens before this plan is presented. Implementation specialist routing follows the repository role configuration. No upstream merge or rebase is implied by using the existing worktree.

Reuse the [existing website execution plan](2026-09-05-pr-5791-website-v3-4-refresh-plan.md), particularly “Executable verification and environment” and “Broader website verification”. In its task-owned Node 24.16.0/pnpm 11.5.0 container, run `pnpm --filter @klicker-uzh/docs run build:docs`. Compare `tsc --noEmit` diagnostic identities against `project/_local/website-v3-4-refresh/baseline-types.log`, normalising source line shifts only, rather than comparing counts alone. Use the repository formatter for the exact changed paths.

Browser acceptance: at 390×844, 800×1000 and 1440×900, activate “Lecturer sign-in” and verify its existing Manage destination without submitting credentials; activate the beginner guide link and verify `/tutorials/live_quiz/`. Activate the examples and release anchors and verify their unique target sections are visible below the header. Confirm each story image loads and is visible at 390px, each release/access qualification remains adjacent to its claim, and all retained feature controls work with pointer and keyboard. Check the mobile menu, search entry point, feedback destination, 200% zoom and no horizontal page overflow. New layout assertions protect behaviour only; do not assert exact prose.

Reuse the website-only container recipe and acceptance evidence documented in that plan. It has no application database or credentials. If new app screenshots require another runtime, first try existing approved synthetic assets; a full application runtime is not silently included. Keep audit screenshots gitignored. Stop each task-owned preview and verify that it has stopped after the last check.

No copy snapshots or tests asserting prose strings. Existing 35 TypeScript diagnostics and root-check environment limitations are inherited; require no new diagnostic identities. Do not expand this package into dependency or monorepo repair. Any newly introduced build, link, runtime or interaction failure must be fixed.

Proposed comprehension exercise after local implementation: ask three lecturers unfamiliar with the draft to explain what KlickerUZH offers, identify what they can use now, find a relevant teaching example, and distinguish the beginner guide from sign-in. Have them identify the 3.4 access qualification. Treat repeated confusion as a revision signal. Recruitment is user-owned and optional; no outreach is authorised. Without this exercise, report expert review and browser verification only, not user validation.

## Evidence and progress

Primary product evidence: [v3.3 release](https://github.com/uzh-bf/klicker-uzh/releases/tag/v3.3.0), current release draft, homepage source, current roadmap, FAQ and course-chatbot tutorial. Refresh eligibility before publishing copy; internal source and historical notes have different evidential limits.

Design rationale: [NN/g homepage principles](https://www.nngroup.com/articles/homepage-design-principles/) support explicit purpose and useful actions. [W3C carousel guidance](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/) describes the interaction complexity avoided by the static proposal. These sources guide the proposal, not prove a conversion outcome.

This proposal remains uncommitted until human approval and then folds into the existing execution plan; it is not a second competing execution contract. Proposed implementation terminal condition: locally committed changes, accepted required reviews, recorded verification and a task-owned preview verified stopped. Push, PR amendment, upstream integration, merge and deployment are withheld.

Planning status: independent planner APPROVED after one revision. All five findings accepted: concrete examples, exact ownership, review timing, reproducible acceptance and local completion boundary. Planner approval is not human implementation approval. No landing-page implementation, commit, PR amendment or deployment under this request. The existing website refresh PR remains open and separate from approval of this additional design work.


## Implementation verification

The two delegated component drafts are integrated as one atomic homepage commit so the page composition, global announcement target and section IDs remain buildable together. This is one substantive slice with both simplifier and claim-risk slice-review gates before integrated final review. Existing commented future sections and shared catalogue/CTA consumers are preserved. No package, lockfile, legal or tracking changes.

Existing public illustrations are reused unchanged: Live Quiz aggregate prize results, a Practice Quiz embedded in OLAT and a Case Study using an Answer Collection. Captions match visible content; these are not new synthetic or current-application captures. No full application runtime is introduced. Current React DOM guidance was retrieved through Context7.

Website production build and six-file Biome check pass; TypeScript reports the same 35 diagnostic identities as the baseline, with source positions normalised. Required root checks and build were attempted and fail on unrelated missing dependencies and build tools in the website-only container (including email and rollup). Host Git hooks use the previously documented container-check split. Baseline screenshots and final browser evidence live under project/_local/landing-page/. No fully green monorepo claim.
