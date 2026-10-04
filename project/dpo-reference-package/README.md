# DPO review package v2: proposals for all artifacts (2026-09-05)

## App draft implementation entry point

Use this package as the German copy source for a new app implementation task. Read `prototype.html` including `CHOICES_HTML` and the JavaScript-generated normal edu-ID view; static markup alone misses shared and generated text. Preserve the guide and attachment links. Review banners, fixture identities and simulated success messages are not production content. These remain review drafts, not DPO-approved notices or evidence that the backend guarantees already exist.

Frozen draft package: `../2026-09-05-consent-draft-snapshot.tar.gz`. SHA-256: `3b92abafc3cfaabd7e5149aa24ff21b52dc0c149ff618f14010acd4168f984a8`. It includes exact copy, guide, implementation review, specimens and XLSX files, excluding local `.claude` configuration. This external checksum supersedes the earlier receipt inside the archived README. Preserve the archive. Both the snapshot and editable package are local ignored shared artifacts, not remotely backed up or committed.

Reuse `/Users/rschlae/Git/klicker/klicker-uzh/trees/consent-disclaimers`, branch `rs/consent-disclaimers`, for implementation. At checkpoint it tracks `origin/v3`, is 0 ahead/44 behind and has three existing deletions under `packages/transactional/out/`; preserve them and establish ownership before staging. Refresh refs on takeover. No upstream integration is authorized. The primary checkout contains unrelated changes. Inspect live LA PRs/owners before touching their stack; the existing `trees/chatbot-learning-analytics` directory currently uses branch `fix/chat-disclaimer-dark-scheme`.

Map these surfaces to the app: normal credentials signup, future normal edu-ID signup, assessment activation, existing-account gate, preference changes, leaderboard joining, assessment export, research export and knowledge-base upload. Lecturer LA/audit tabs and specimens support review; they do not automatically add a full analytics dashboard, chat clustering or final export format to scope. Review current ADRs 0023 (global LA/course gate), 0024 (research release boundary) and 0025 (assessment usability gate).

Latest decisions and per-artifact sections below override historical proposals: research defaults to allowed; global LA requires yes/no with neither preselected; saved choices survive renewed terms acknowledgement; leaderboard participation controls publication/ranking while private points persist. Resolve first-join/rejoin ranking and rank-dependent awards before implementing them. Ordinary author names/bibliographic credits are allowed in knowledge-base material; other personal data is excluded. The historical table's mandatory server-side assessment-export move is superseded by deferred technical delivery. Synthetic manifests/audit fields are not final contracts.

The next task should map the app changes and prepare the required execution plan, preserving the German wording except for explicit verified corrections. Publication, deployment, upstream integration and new real-data processing are not authorized by this persistence request. DPO/copyright approval and matching backend guarantees remain release blockers. Verify consequential behavior and desktop/LMS/mobile rendering, without tests pinning prose or example contents. Previous browser checks covered prototype gating, saved choices, export validation and upload confirmations; final points/copyright edits received static checks only. No runtime, migration or seed was started for this checkpoint; no children remain active.

Origin: Codex session `01a01ddb-2bda-7e81-bb4f-6a083ec6936d`, resumable with `codex resume 01a01ddb-2bda-7e81-bb4f-6a083ec6936d`. The required global handoff-folder write failed, including with elevated permissions. This section is the package implementation entry point, not a replacement global handoff.

Supersedes the artifact section of `../2026-09-02-consent-disclaimers-proposal.md` (sections 4–6) and the prototype reviewed in `../../2026-08-20-account-consent-prototype-design-review.md`. The current review scope is account notices (normal credentials, future normal edu-ID, assessment edu-ID), the existing-account gate, leaderboard joining, and assessment/research export request forms. Research default-on with an objection control is settled by the user and is not an open product decision. Research file format and technical delivery remain deferred. Settings, LA views, audit examples and worksheets are supporting material, not part of this disclaimer sign-off.

Files:

| File | Artifact |
| --- | --- |
| `prototype.html` | Self-contained German prototype with eleven views, including normal edu-ID signup and the knowledge-base upload notice (open in a browser, no server needed) |
| `learning-analytics-students.html` | Detailed German student guide with private-insight and group-report examples; current, proposed and later capabilities are distinguished |
| `learning-analytics-review.md` | Source-backed review, first-iteration report contract, implementation gaps and verification boundary |
| `specimens/package-layout.md` | Synthetic export package layout v2 (adds the attestation log) and per-folder notes |
| `specimens/attestation-log.csv` | Synthetic protocol rows matching view 9 |
| `specimens/assessment/assessment-results.csv` | Synthetic assessment result file with the current UI export columns |
| `specimens/assessment/manifest.json` | Proposed server-side assessment-export receipt |
| `specimens/research/` | Synthetic research projections, data dictionary, and manifest |
| `generate-specimens.mjs` | Deterministic generator for all assessment and research specimens |
| `outputs/consent-la-download-examples/` | Three downloadable Excel workbooks linked from the student guide: research records, assessment results and the proposed in-tool LA group view |

Nothing in this directory is committed; `project/_local/` is gitignored because the repository is public. All values are synthetic (`example.invalid`, fabricated UUIDs and references).

## What changed since the 2026-09-02 proposal

| Area | v1 (2026-09-02) | v2 (this package) |
| --- | --- | --- |
| Account form | Avatar and profile-visibility choices still present | Removed. Only e-mail, username, password. Joining a leaderboard is the separate visibility choice. |
| Existing accounts | Not covered | New gate page (view 3): PWA-hosted, reached from every app, chat and LTI redirect there and back; compact layout for the LMS iframe. |
| Undecided accounts | Implicit | Never research-eligible; the research release step excludes them explicitly (view 8 result text, manifest `eligibility`). No historic e-mail objections to migrate. |
| Decline | Open | No decline action. A participant who does not proceed has no account; the assessment account stays locked. |
| Assessment CSV | Server-side move "if approved" | Moves server-side in the same phase as its dialog, so the exact-artifact wording is true from day one. |
| Persistence | Shared disclosure-version table considered | Values and last-change timestamps on the participant record; one audit-log entry per choice change, acknowledgement, or attestation (view 9, `attestation-log.csv`). |
| Field names | `researchConsent`, `learningAnalyticsConsent` | Neutral names before merge (prototype uses `researchDataUse`, `learningAnalyticsChoice` as placeholders). |
| Research export project | Pre-approved project record with authorized team | No approval procedure and no project table. The requester enters title, responsible person, contact, purpose, retention date, and an optional reference in the dialog for every export; the values are stored with the attestation and artifact. |
| Course LA gate | Default false on branch | Default enabled, course-owner controlled like gamification, copied on duplication, archiving stops computation. |

## Design-review findings carried into the prototype

| Finding | How v2 resolves it |
| --- | --- |
| F1 dead submit when everything looks complete | Learning Analytics is open by default and its status shows that a choice is required. The acknowledgement checkbox is red until selected. Research defaults to allowed; Learning Analytics still requires an explicit choice. |
| F2 two colour languages for a valid "no" | Completed answers are neutral grey regardless of value; amber is reserved for missing. |
| F3 duplicate live regions | The form uses visible control states instead of repeated validation messages. |
| F4 contrast and type-size floor | Smallest text 13 px, muted colour #4b5563 on white (7:1). |
| F5 two legal regimes look alike | Both decisions are compact collapsible rows. Each row shows the current decision in its title; the explanation and controls are inside. Research is an objection choice with an allowed default. Learning Analytics is a voluntary, explicit choice. |
| F6 iframe scroll depth | The document has no nested scrolling area. The embedding page or browser owns scrolling. |
| F8, F9 | No decorative glyphs; sections use `aria-labelledby`; dialogs use `aria-labelledby` and `aria-describedby`. |
| F10 / D2 register | UI stays in "du" and avoids a second legal excerpt inside the research choice. |
| F12 / D3 aggregates | Already released group reports remain unchanged only where they passed the disclosure review; personal derivatives and pending contributions follow withdrawal. |
| F13 research status | Status pill "Zugelassen / Widersprochen" beside the title. |
| F14 confirmation row | 24 px checkbox, label capped at 80 ch, one confirmation control only. |
| F15 / D5 one description per purpose | The choice block is one shared template rendered identically in views 1–3. |

## Per-artifact proposals

### 1. Normal account creation (view 1)

Two columns. Left: e-mail, username, password, plus four independent explanatory accordions about collection, access, purpose, and retention. Right: research and Learning Analytics as choice rows. Learning Analytics is open by default, but no answer is preselected. The title of each choice shows its current state. The target benefit includes private exercise insights and protected group reports for lecturers, with a link to the detailed student guide. The guide explicitly marks private LA insights as proposed, not an existing dashboard. The footer contains one shortened acknowledgement checkbox and "Konto erstellen". Ask the DPO whether notice and terms need separate controls.

### 2. Assessment activation (view 2)

The additional “Konto mit edu-ID” tab is a future normal account variant. It shares normal-account retention, purpose and access wording; only the identity source and login card differ. It does not make an edu-ID account an assessment account. Its review fixture includes an assigned username without defining the future username setup workflow.

Identical choice block and footer. Left column becomes the edu-ID access card plus the same four explanatory accordions with assessment-specific collection, access, purpose, and retention text. Assessment means assessment- or grade-relevant activities, not necessarily an examination. Button "Zugang freischalten". The account stays locked until the required choices are complete (ADR 0025).

### 3. Gate for existing accounts (view 3, new)

Heading "Bevor du weitermachst", the account name, and the return target ("zurück zu Chat · Benibot"). Only the choice block and footer; button "Speichern und weiter". The backend marks undecided accounts in the login session; every app honours the mark; chat and LTI redirect to this PWA page with a return URL. The embedding page or browser owns scrolling. Undecided accounts are excluded from research exports and from Learning Analytics computation until they pass this page.

The gate also covers acknowledgement of updated terms. Previously recorded research and LA choices are preserved. A review-only scenario selector demonstrates an old account with no choices and an account with both uses declined. The latter needs only the renewed acknowledgement unless the person changes their choices. This applies to credential and edu-ID login, including assessment.

### 4. Settings (view 4)

"Deine Daten" holds the two choices as switches with their consequence texts. It does not show legal-regime labels or text metadata. Switching Learning Analytics off asks for an inline confirmation naming deletion of personal derived rows and the fact that existing group values are not recomputed. Switching research either way shows the export consequence. Profile visibility and avatar controls are not part of this proposal.

### 5. Leaderboard join note (view 5, new)

Decision confirmed on 2026-09-05: leaderboard participation controls visibility and ranking, not personal point accrual or retention. Students collect points and retain ordinary personal statistics without joining. Leaving removes their leaderboard visibility but preserves their personal points and statistics; they can join again. Research and Learning Analytics choices remain separate. Additional personal LA insights still require the global LA choice.

This is target behavior, not the current backend contract. The verified scoring paths in `packages/graphql/src/services/stacks.ts` and `liveQuizzes.ts` currently gate awarded course points on active participation. `leaveCourseLeaderboard` in `courses.ts` deletes leaderboard entries and resets timeline points. These paths must be changed before the new wording ships. Raw answer scores, correctness and independent XP already exist. Implementation must settle how retained points enter the ranking on first join or rejoin, including any rank-dependent awards; this prototype does not promise a historical ranking or award policy. No backend changes are included in this review package.

### 6. Lecturer Learning Analytics view (view 6)

The lecturer view contains rounded activity-group summaries of completion and first/last correct-answer rates, plus a suppressed example. It has no participant key, participant list, participant-level rows, or individual error history. The review specifies distinct-contributor, rare-outcome, dominance, complementary and historical-comparison checks. No numerical anonymity guarantee is displayed. A separate course switch pauses new lecturer reports and remains independent of each participant's global choice and proposed private insights.

This is the proposed product boundary, not a description of every current `v3` path. Current Manage queries still expose participant-level Learning Analytics, including one path with username and e-mail. The in-tool lecturer LA views and their server responses must become group-only before this wording can ship. Separate research downloads may retain participant-level records with identifier safeguards and a prohibition on attempted re-identification; the group-only rule does not apply to them. The existing LA specimen illustrates group values, not the full permitted research-export scope. Existing points/XP timelines do not establish the proposed private exercise-insight dashboard. The new guide explains that gap and treats chat-content analysis as a later expansion.

### 7. Identifiable assessment export dialog (view 7)

The dialog retains four commitments covering purpose, access, secure storage and retention. It has a read-only scope block, logging note, one confirmation checkbox and a primary button disabled until confirmation. Scope describes identity and point values without assuming an examination. Link lifetimes, format, checksums and server implementation promises are excluded from the disclaimer review.

### 8. Research export dialog (view 8)

The dialog describes the export as personal data without direct identifiers. Required project fields start empty. The form requires a valid contact email, a planned deletion date no earlier than today, one example data class and acknowledgement. The date label and attestation both refer to deletion, subject to retention obligations. Free text carries a warning without promising a particular transformation. Format, key versions, timestamp precision and delivery mechanics are deferred. Success messages explicitly simulate a request rather than claiming an export was created.

### Knowledge-base materials: copyright and personal-data exclusion

The additional “Wissensbasis: Materialien” tab proposes a notice before files are transferred for ingestion, both initially and for later additions. It requires separate unchecked confirmations of usage rights and absence of personal data. Both must be checked before the simulated upload is enabled; cancellation resets them. The proposal does not upload or inspect files, grant licences, or certify compliance. The same requirement should cover replacement files and imports, not only knowledge-base creation. Changes to the permitted audience or purpose need a renewed rights check.

The wording refers to teaching-material distribution rules familiar from LMS use, without asserting that LMS permission automatically covers AI processing, retrieval or excerpts. It does not invent a percentage-of-a-work rule or say that paraphrasing makes an upload permissible. Ordinary author names and bibliographic credits are permitted and preserved, as confirmed by the user. Other personal data in content and ancillary file data are excluded. The confirmation explicitly states this distinction.

Questions for copyright counsel and the DPO:

- Which teaching exceptions, publisher licences or permissions cover document ingestion, storage, indexing, retrieval, answer generation and displayed excerpts for the actual service and its processors? This is not assumed to be model training.
- Which materials and amounts may be used, for which students, for how long, and with which source-credit and excerpt restrictions? Does a licensed full text require additional permission?
- Is this attestation sufficient, what supporting information is needed, and how should later uploads, changes of audience and removal requests be handled?

Source context checked on 2026-09-05: the [UZH Library guidance on AI and licensed full texts](https://www.ub.uzh.ch/de/literatur-suchen-nutzen/e-library-nutzen/ki-und-lizenzierte-volltexte.html) distinguishes permissions by licence and use. The [UZH recommendations on generative AI](https://www.uzh.ch/de/explore/basics/ai/recommendations.html) identify copyright and data-protection risks. These sources inform the questions; they are not approval of the KlickerUZH upload workflow. Final wording and any exceptions remain for the specialist review.

### Attestation log supporting example

One table of synthetic entries covers acknowledgement, choice changes, an assessment attestation and download, and a research attestation with eligibility revision, row count, and checksum. The view does not display text metadata. Participant-record fields use neutral placeholder names.

### Synthetic export package (specimens/)

The package contains one current-shape assessment result CSV, proposed research projections, manifests, a data dictionary, and an attestation log. The assessment specimen uses the current `assessmentResultsCourse` fields; the proposed manifest adds the exact-artifact receipt that the current browser download lacks. The research quiz specimen preserves current `LiveQuizResponse` meanings while removing direct identifiers. The Learning Analytics specimen uses only cohort-level activity and response summaries derived from current aggregate models. It must be recalculated from the eligible population rather than exporting existing aggregates unchanged. The research manifest records privacy classification, project-identifier scope and key version, timestamp precision, eligibility revision, source models, row count, schema version, disclosure controls, and per-file checksums.

## Open items the prototype deliberately does not settle

- Final German wording and correspondence with the full privacy terms. Research default-on is settled, not reopened by this review.
- Whether a warning-based opt-in is acceptable for chat transcript text, given that free text can contain identifying details (proposal 5.5, 8.2).
- Whether per-export self-declaration of the project plus attestation is sufficient, or whether a written request or agreement must exist outside KlickerUZH (proposal 8.1).
- Sufficiency of group disclosure controls for in-tool lecturer LA; individual research records remain a separate export scope.
- Combined versus separate notice/terms controls (proposal 8.1).
- Retention of course-level derived rows while the course gate is off, and retention of attestations and manifests (proposal 4.3, 12.5).
