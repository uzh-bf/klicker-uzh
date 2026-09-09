# Biology chatbot prototype design decisions

## Scope and authority

The user approved the reviewed configuration-first prototype plan. Synthetic
preparation and scoped implementation are authorized within that plan. Its
configuration qualification stop remains active. Private-material uploads,
provider spending, live configuration, deployment, and a student pilot remain
outside current authority; qualify the actual runtime target before use.
The intended eventual audience is one biology course with approximately 20
students. Teaching staff first assess the prototype.

## Settled interview decisions

| Decision | Agreed direction and consequence |
| --- | --- |
| Learning support | Prioritize software coaching for PyMOL, CLC, and GraphPad Prism, with bounded paper and figure understanding. Prefer short actionable steps, rationale, and source references. |
| Visual scope | Keep figure and screenshot support simple. No protein viewer or bespoke scientific tooling for this course. Reuse existing capabilities where verified. |
| Materials and interpretation | Prototype with permitted public and synthetic examples now. Include interpretation of students' own experimental outputs in the intended product. Start with exported figures/screenshots and supplied context; no raw-table calculations. Private material likely matters for specificity, but no private upload is authorized now. |
| Provider and cost | Plan within an institution-approved text/image provider route, subject to verification. CHF100 is the accepted provisional total model/API spending ceiling for future staff qualification and a possible student trial, not an estimate or spending authority. Existing soft budgets are not proof of a hard cap. |
| Teams entry | Include a Teams tab embedding the chatbot. The existing flow requires participant login followed by course-PIN enrollment; PIN alone does not authenticate. Microsoft SSO is unnecessary. Verify the browser-session contract before promising compatibility. A standalone link is not an equivalent replacement for the requested tab. |

## Existing ownership and shared contracts

Writing Coach remains owned by the separate task “Research writing coach mode”.
Its proposal at `trees/proposal-writing-coach/project/writing-coach/RESEARCH_PROPOSAL.md`
owns writing feedback, rubrics, and the no-rewriting policy. Biology does not
duplicate those features. Existing chemistry work remains separately owned in
`trees/latex-chemistry-investigation`; its execution authority does not transfer.

Reuse the existing course chatbot, chat mode, course sources, participant
attachments, and conversation history where their actual contracts suffice.
Do not turn participant attachments into shared course sources. The existing
glossary distinguishes AI usage authorization from publication approval; retain
both boundaries before any eventual pilot.

No new durable domain term is settled by this round. No glossary edit is needed.
The decisions are reversible prototype scope choices, so they do not meet the
three-part ADR threshold. New identity, private-data ownership, or incompatible
shared-mode decisions would require a fresh ADR assessment.

## Evidence and working context

The remote-state gate completed on 2026-09-09. The primary `v3` checkout was
43 commits behind `origin/v3` and contained unrelated changes. It is untouched.
This dedicated planning worktree tracks `origin/v3` at
`cbcede79718e8e60ff04d3f8376ab6a3f4bb64ed`, with no ahead/behind difference at
creation. Target selection follows the repository declaration and remote
default `v3`. The repository's existing artifacts root is `project/`.

Current remote documentation reviewed: `docs/chat-platform.md` and
`docs/adr/0041-chatbot-trusted-pilot-boundary.md`. These are source evidence,
not deployed or Teams runtime proof. The Writing Coach draft was read only.

## Ownership and next decision frontier

The main session owns product decisions, privacy boundaries, synthesis, and
final evidence. A read-only explorer owns the bounded source check of embedding
and PIN authentication. The configured planner checks each interview round.
Acceptance for exploration is exact source references separating supported
behavior from unverified Teams compatibility.

The user included interpretation of students' own experimental outputs. The
original independently checked decision frontier was empty. Working assumption:
give direct operational steps; for assessed interpretation first elicit the
learner's observation, then discuss evidence and limitations. Direct worked
interpretations of approved teaching examples remain compatible with coaching.
Propose six staff-reviewed examples, two per tool, including paper/figure help.
Exact source versions, example tasks, and junior slices follow these decisions.
Institutional data processing and pilot activation remain
separate later approvals, not assumptions supplied by this interview.

## Progress

- The user selected synthetic material only for the current source setup.
  Three original teaching notes replace external manuals as active case sources.
  Manual links are deferred. Current evaluation covers coaching and qualitative
  interpretation, not exact vendor-software accuracy. Source binding and model
  evaluation remain unproven; no runtime was started for this content change.

- Round one independently checked by the native planner; its mistaken exclusion
  of protein viewing was corrected before presentation. The user then explicitly
  excluded the viewer and accepted the other directions with material and Teams
  amendments recorded above.
- Round two independently checked by the native planner. It reduced the frontier
  to the essential private-material question; the user selected interpretation.
- Round three independently checked: no further design questions needed. Scope
  is exported figures/screenshots with context, not raw-data computation.
- PIN and embed source mapping completed. PIN is course admission; current
  participant cookies use SameSite=Lax. Cross-site Teams authentication remains
  unverified and may require separate senior-owned platform work.
- The [proposal](2026-09-09-biology-chatbot-prototype-plan-pr-5862.md) passed native
  planner review after correction and received execution approval. Synthetic
  persona, cases and figures are prepared and statically checked. No runtime
  or model acceptance is established.
- Subsequent source qualification found that custom modes use generic Tutor
  starters and require operator setup, with source bindings configured
  separately. The plan's explicit stop applies. The user reopened grilling to
  examine this setup decision; minimal tooling and the original learning scope
  remain settled. The main session owns the decision record; one read-only
  planner checks the complete follow-up question frontier.
- Refreshed remote refs for this follow-up: the task branch
  rs/biology-chatbot-prototype-plan tracks origin/v3 and is zero commits ahead,
  one behind remote default v3. The sole newer commit remains the unrelated
  shared translation context fix; no rebaseline is needed for this interview.
- Follow-up planner review completed. Accepted its narrowing: only the starter
  presentation requires a user decision now. Operator setup and separate source
  binding are implementation facts to qualify, not additional preference
  questions. Pending question: retain generic Tutor buttons and supply biology
  starters in the staff guide. Recommendation: accept for the first prototype.
  This supersedes the earlier bundled setup question. The user subsequently
  approved it: retain generic Tutor buttons and copyable biology starters in
  the staff guide. The interview frontier is empty again. This approval changes
  starter presentation only; source and provider qualification remain factual
  execution work, with the original runtime and inference boundaries intact.
