# Guest conversation claim into Klicker accounts

## Approval summary

A learner without a Klicker account chats through an LTI or eLearning chatbot as
a course-scoped guest persona. When they later create or link an account, those
guest conversations stay stranded on the persona: they never appear in the
account's history. This package moves a person's own guest chat threads into
their real account automatically, the first time they enter the same chatbot
through a verified launch after holding an account.

The identity join is already designed into the system: the guest persona key is
a deterministic per-course HMAC over the verified LTI subject and course, and
the backend re-derives it from every verified launch. The claim finds that
persona's threads and reassigns them to the resolved account participant in its
own transaction. It is idempotent, covers the person's guest threads across
their enrolled courses. The approved review correction adds two participant
indexes through concurrent migrations; no fields or tables change.

Unchanged: guest-only access, token separation, model fallback policy, credits
and disclaimer semantics (guest credits/consent are persona-scoped and are not
merged), participation opt-in values, and all authorization gates. The
previously recorded "guest history is not transferred" contract in
docs/auth-model.md is deliberately reversed by this package and the doc is
updated; the old unified-access plan (project/2026-09-10-lti-chatbot-access.md)
remains linked as history.

Material decisions baked in: automatic claim (no UI), trigger is the
account-status resolution inside the existing verified-launch backend call
(never the browser cookie), scope is the person's guest threads across their
enrolled courses, and guest persona cleanup is deferred (personas stay,
see Alternatives). Rotating CHAT_GUEST_SEED after this ships would make old
personas underivable, so any future rotation must be paired with a claim
backfill; that coupling is documented in the plan.

Acceptance: unit/integration proof of the exact claim semantics (all-handles,
cross-bot, idempotency, cookie-guard, failure-atomicity), full existing LTI/guest
and thread suites green, browser proof of guest→account transition with history
visible in the account, and a reviewed draft PR into v3-ai. Deployment and
production data changes are withheld.

This is an approved executable batch. The user approved implementation and draft
delivery on 2026-09-16, then authorized updating the existing PR against current
v3-ai and completing its remaining reviews on 2026-10-14. Ordinary task-branch
commits, non-force pushes, verification and review corrections are authorized.
The user subsequently authorized marking PR #6097 ready and completing final
review on 2026-10-14; both are complete. Merge, deployment and production data
changes remain withheld. The related LTI roadmap below records follow-up work,
not additional implementation or release authority.

## Related LTI roadmap — updated 2026-10-26

Outcome: validate the browser-to-LTI launch separately from participant-session
recovery and guest-conversation transfer. Passing a downstream session test
does not establish that ltijs accepts real iframe cookies with dev mode off.

| Workstream and owner | Sequence and current evidence | Next action and acceptance |
| --- | --- | --- |
| [Local LTI launch harness (#6719)](https://github.com/uzh-bf/klicker-uzh/pull/6719), harness session | Independent draft PR into `v3`; preferred first landing after its own checks and merge approval. It exercises ltijs through a real mock platform and browser redirects. | Complete the harness's own delivery gates. Keep it separate from session recovery; no stacked PR dependency. Use its calibrated cookie restriction for later launch experiments. |
| [Participant-session recovery (#6414)](https://github.com/uzh-bf/klicker-uzh/pull/6414), session-recovery session | Independent PR into `v3`. Its current blocked-Chromium project relies on a launch flag and branches on observed shared-cookie access instead of requiring blocking. | Adopt CDP cookie restriction and explicit blocked-project metadata. Require a cross-site ordinary-cookie probe to fail when restriction is ineffective, then rerun recovery scenarios. Classify partitioned cookies separately. |
| Partitioned ltijs cookies, experiment owner to be assigned | Proposed local experiment in a fresh `v3-ai` worktree, using a pinned copy of the harness until normal integration makes it available. Existing PWA cookie serialization provides a reference. | Verify ltijs 5.9.9 serialization, then test adding `Partitioned` to state/session cookies with secure cookie attributes. Run real top-level and iframe launches with dev mode on/off across allowed Chromium, calibrated blocked Chromium, Firefox and WebKit. Record each outcome; browser support remains a hypothesis. |
| [Guest-conversation transfer (#6097)](https://github.com/uzh-bf/klicker-uzh/pull/6097), this session | Ready PR into `v3-ai`; final review and required CI passed at `1a5d63409be706de021667f3c027c5c12f756f74`. This operates after verified identity resolution. | Refresh readiness against current `v3-ai` before a merge decision. Retain subject binding, atomic ownership transfer and history-ordering checks. Neither harness success nor session-recovery success replaces these checks. |

### Evidence boundaries and coordination

The [cookie-blocking review comment](https://github.com/uzh-bf/klicker-uzh/pull/6414#issuecomment-6410720487)
was posted on 2026-10-26. Inspection of #6414 confirms the launch flag,
conditional cookie assertions, intercepted `/login` request using `route.fetch`,
and the registration script's `LTI_DEV_MODE=true` requirement. Its existing
blocked-Chromium result therefore does not prove cookie blocking. Its launch
test covers participant-session recovery rather than ltijs validation with dev
mode off. Correct that evidence before claiming blocked-browser acceptance.

The harness PR reports local browser measurements: top-level launches pass with
dev mode off, while blocked Chromium and WebKit iframe launches fail with
`MISSING_VALIDATION_COOKIE`. These are the harness author's results, not a new
run by this session. Its restriction calibration distinguishes ordinary from
partitioned cookies; successful partitioned storage must not fail an assertion
intended to reject shared third-party cookies.

Keep the two PRs independent. The advisor reported no overlapping changed files
and no benefit from stacking; the reported `useChatResponse.ts` conflict already
exists between #6414 and `v3`. Recheck conflicts when integrating. Their mock
platform registrations use separate identities. Reusing the harness's mock
platform in #6414 is a later simplification, not a prerequisite for correcting
its cookie-blocking test.

The proposed experiment must first establish a working local runtime. The
harness owner reported an `oidc` reconciliation failure; a fresh isolated
worktree is the proposed recovery path, not proof the failure is resolved.
The claimed ltijs omission of `partitioned` must be checked against its installed
serializer before patching. Preserve signature, issuer, audience, nonce and
state validation, and use real browser cookie handling throughout the experiment.
Chromium improvement is expected but unproven; WebKit results must be measured.

Opus consultation on 2026-10-26 added three acceptance refinements, checked
against the named branch sources:

- The harness's cookie calibration must use an independent cross-site probe
  with an allowed-cookie positive control. A session cookie absent because the
  LTI launch failed before creating it does not prove blocking. Report ordinary
  and partitioned cookies separately, and measure Firefox/WebKit restrictions
  without implying Chromium's CDP settings apply to those browsers.
- After participant-session recovery reaches `v3-ai`, its owner must exercise
  the Chat LTI/eLearning paths as well as PWA recovery. Chat issues partitioned
  account cookies, while #6414 replaces shared account cookies and rotates a
  session revision. Verify duplicate cookie precedence and revision behavior;
  `v3`-only CI cannot cover Chat's `v3-ai` launch path. Verify the intercepted
  `/login` request does not manufacture evidence of browser cookie acceptance.
- The partitioned-cookie experiment must cover state-cookie issuance and
  clearing, session-cookie validation, replay rejection, concurrent launches,
  and rejection across separate browser contexts or top-level partitions.
  Reaching a PWA URL with a signed handoff is an upstream launch result;
  downstream iframe account/guest session establishment needs its own check.

The guest-transfer deployment gate remains values-free confirmation that Chat
and the backend receive the same `CHAT_GUEST_SEED`. The backend manifest consumes
its own Secret, so Chat's secret projection alone does not establish this.
Verify the projection before enabling transfer; sanitized failure logging and
successful account login must not be mistaken for completed history transfer.

This roadmap update records sequencing and acceptance only. Starting the new
experiment, merging any PR, changing deployment settings or disabling dev mode
requires the corresponding explicit approval. The immediate source follow-up
belongs to #6414's owner: correct and rerun the blocked-browser test. This
session retains ownership of #6097 and its separate readiness refresh.

## Execution details

### Goal and non-goals

Goal: one person's guest conversations follow them into their real account.

Non-goals: no manual "import" button; no UI change; no migrations beyond the
two approved participant indexes and no new tables;
no merge of credits, disclaimer acceptance, ratings metadata changes, or other
persona-scoped state; no cross-person data movement; no new token trust domain;
no change to how guests are created, authorized, or limited to the fallback
model; no change to eLearning learner binding or origin tagging.

### Plan identity

- Plan: project/2026-09-16-guest-conversation-claim-plan.md (this file)
- Worktree: trees/guest-conversation-claim; branch: rs/guest-conversation-claim
- Baseline: c4f0ecde20 (origin/v3-ai, merge of latest v3, 2026-09-16)
- Target branch: v3-ai (PR to be created at delivery time)
- History: project/2026-09-10-lti-chatbot-access.md (unified OLAT LTI access;
  deliberately withheld guest-history transfer; this plan supersedes that
  single withheld decision with the user's direction)
- Related: PR #5083 introduced the original guest access; the code comment in
  apps/chat/src/lib/server/ltiGuest.ts already reserves this seam ("Phase C
  will recompute these to match guest personas to a real account by
  (ltiSub, courseId)").

### Current mechanics (verified at baseline)

- Guest creation (apps/chat/src/lib/server/ltiGuest.ts): findOrCreateGuestPersona
  derives ssoId = 'chat-guest:' + HMAC-SHA256(CHAT_GUEST_SEED,
  ltiSub:courseId) (base64url), creates Participant + ParticipantAccount
  (type 'lti_guest', ssoType 'LTI1.3') + Participation (isActive=false).
- Both launch routes call the persisted operations
  LoginParticipantForLtiChatbot / LoginParticipantForElearningChatbot, whose
  shared core establishLtiChatIdentity (packages/graphql/src/services/
  accounts.ts, ~1790-1859) resolves account-vs-guest from the VERIFIED launch
  subject (or a valid existing participant session on the LTI route).
- The LTI route passes participantToken (browser cookie). establishLtiChatIdentity
  treats a valid cookie session as the account (session precedence). The claim
  must NEVER run keyed on that cookie identity.
- ChatThread (participantId, chatbotId) owns messages and attachments via
   cascade; reassignment updates participantId only, preserving activity timestamps.
- ChatUsageCredits and disclaimer acceptance are keyed to (participantId,
  chatbotId) and persona-scoped; they are intentionally not merged.
- docs/auth-model.md:63 records "Guest history is not transferred to an
  account." This plan reverses that contract; the doc must be updated in the
  same package.

### Binding contracts

1. Trigger and timing. The claim runs inside the backend account-status
   resolution (establishLtiChatIdentity) after the account participant is
   resolved and the participation upsert completes, only on the ACCOUNT path
   (never GUEST, never DENIED), before token issuance. It executes in its own
   Prisma transaction (thread reassignment only), wrapped in its own try/catch,
   never inside the login-critical resolver transaction: a claim failure is
   caught, logged as a structured event (no PII), and token issuance continues.
   Launch availability outranks history transfer.

2. Identity binding. The claim key is the VERIFIED LTI subject (ltiSub) of the
   current launch plus the participant's course participations. Never use the
   participantToken cookie identity. Concretely: after participant resolution,
   re-derive the guest ssoId for (ltiSub, courseId) for each of the account's
   participations (or at minimum the current course), look up the persona's
   participantId via ParticipantAccount.ssoId, then reassign that persona's
   threads. The eLearning path uses verified.learnerId as ltiSub (already the
   OLAT LTI subject per the route comment). The LTI-with-cookie path uses the
   launch's sub, even when the cookie session belongs to a different
   participant (session precedence). In that cookie-wins branch the resolver
   never consults the launch subject, so the claim must do its own match
   check: look up the non-guest ParticipantAccount by ssoId=ltiSub and claim
   only if its participantId equals the session participant's id; otherwise
   skip the claim entirely. Never move threads into an account the verified
   subject does not resolve to. The eLearning path passes no cookie, so its
   account resolution is always subject-verified and the check is trivially
   satisfied.

3. Thread scope. Claim all ChatThread rows of the found persona(s), regardless
   of chatbot lifecycle status. Persona derivation is per-course, so one
   persona lookup per (ltiSub, courseId) pair over the account's participations,
   claiming every thread each found persona owns without changing its creation or
   activity timestamps. Chatbot access gating
   (PUBLISHED checks in the thread routes) already governs visibility, so a
   PAUSED bot's claimed history simply appears if the bot is ever resumed;
   restricting the claim to PUBLISHED bots would strand paused-bot threads for
   no protective gain. Do not touch ChatUsageCredits, disclaimer acceptance,
   participation rows of the persona, or any other persona-owned state.

4. Idempotency and concurrency. Re-running the claim is a no-op (threads
   already on the account match nothing). Concurrent launches: guard with the
   persona row lock or conditional update semantics (WHERE participantId =
   personaId); an ownership-guarded update cannot double-apply. Log claimed thread count per
   persona for observability (structured event, no message content). Known
   benign race: a guest turn in flight during the claim keeps writing to its
   thread id, which now belongs to the account — the message lands correctly
   for the same person; threads the persona creates after the claim are picked
   up by the idempotent re-claim on the next account launch.

5. Failure semantics. Claim errors never deny the launch (contract 1). Log
   event=guest_thread_claim_failed with courseId, chatbot count and error class
   (never ltiSub, email, username, or message content). Retry happens naturally
   on the next verified launch.

6. Privacy. No new identity attributes are collected or stored. Existing guest
   messages move between rows owned by the same natural person; retention is
   unchanged. Logs carry course and thread counts only. No exports, analytics
   events, or third-party recipients are added.

7. Guest persona lifecycle (deferred). Personas are not deleted after claim.
   Persona rows (Participant + lti_guest account + participation) are cheap,
   they keep GUEST launches working for the same person in other contexts, and
   deleting them is a separate data-retention decision. The plan records this
   as deferred; a future package may retire claimed personas via a backfill.

8. CHAT_GUEST_SEED rotation. Rotating the seed changes the derived persona key
   for every existing guest, making previously created personas unclaimable.
   Any future rotation proposal MUST be paired with a claim backfill executed
   before/with the rotation. Record this coupling in docs/auth-model.md so it
   is discoverable from the secret's documentation.

9. Docs. Update docs/auth-model.md (reversal of "no transfer" + claim contract
   + seed-rotation coupling). docs/chat-platform.md guest sections need no
   change (thread ownership rendering is unchanged; sidebar lists threads by
   participantId, which now includes claimed threads).

10. Derivation compatibility. Moving the persona-derivation helper from
    apps/chat/src/lib/server/ltiGuest.ts into packages/util must keep the
    derived ssoId byte-identical for every (ltiSub, courseId): same
    GUEST_SSO_PREFIX, same HMAC-SHA256 over "ltiSub:courseId", same base64url
    encoding, same seed resolution. Any change to the output breaks every
    existing persona's findability and with it the claim and guest continuity;
    the existing apps/chat/test/lti-guest.test.ts derivation assertions are
    the regression guard and must keep passing unchanged.

### Primitive impact

| Product primitive | Disposition | Contract delta | Affected compositions and consumers | Evidence / open ruling |
| --- | --- | --- | --- | --- |
| Guest persona | Extend | Persona identity is stable and now claimable: verified account launches can move the persona's chat threads into the account | LTI/eLearning launches, thread sidebar, history APIs | ltiGuest.ts derivation comment; auth-model doc reversal; user ruled import-into-account is wanted |
| Chat thread ownership | Reuse | Identity is (participantId, chatbotId); ownership transfer is a participantId update with no message/attachment mutation | Thread list, history load, message rating, origin tags | ChatThread schema + threads route |
| Participant storage access | Extend | Non-unique participant indexes support the existing transfer predicates without changing ownership or enrollment | ChatThread transfer, Participation lookup | Approved 2026-10-26 index amendment |
| Participant session / LTI identity | Reuse | No change; claim is keyed to verified launch subject, never cookie | establishLtiChatIdentity | accounts.ts session-precedence branch |
| Credits / disclaimer | Reuse | Deliberately persona-scoped, not merged | Credit checks, disclaimer gate | ChatUsageCredits schema |

No new product primitive is created; the claim is a lifecycle operation on the
existing guest persona. ADR gate: this is an extend of an existing primitive
with a user-directed contract reversal already recorded in the linked prior
plan; no new domain object or architecture. A new ADR is not armed. Scope
changes that would re-arm it: making the claim an opt-in/undoable user action,
changing persona retention/deletion policy, or introducing a new trust domain
around persona identity.

### Research

No external research is required; all evidence is repository-local and was
verified at baseline during this planning session. Open implementation-time
question (non-blocking, resolved by the executor within contract 2): whether to
claim across all the account's participations in one launch or only the current
course — all-courses is the recommended default and matches the user's "any
chatbot where they had used it as a guest".

Question: should the claim run when a valid browser session exists but differs
from the LTI-linked account (session precedence)? Ruling recorded in contract 2:
the claim runs only for the identity the launch subject itself resolves to.
When a different valid session wins, skip the claim (the person is effectively
using another account in that browser; claiming into it would move threads
across accounts). This is a settled product decision from this session's
discussion; the planner challenged it and the arbitration kept it (see Progress).

### Test portfolio

Extend existing suites; no new test files are required except one claim
integration suite.

| Risk | Obligation | Primary seam | Distinct realistic failure | Slice |
| --- | --- | --- | --- | --- |
| Wrong-person claim via cookie identity | Add new | establishLtiChatIdentity claim wiring + claim service | Valid session cookie of participant B + launch subject resolves to A: no thread moves to B | S1 |
| Cross-course overreach | Add new | Claim service | Threads are claimed only via the persona derived for that same (ltiSub, courseId); another course's persona is untouched | S1 |
| Lifecycle-status coverage | Add new | Claim service | A PAUSED chatbot's guest threads are claimed too; lifecycle gating governs visibility, never the ownership transfer | S1 |
| Partial application on failure | Add new | Claim service transaction | Persona with 3 threads, forced failure mid-transaction: zero threads moved | S1 |
| Non-idempotent repeat | Add new | Claim service | Second launch: zero threads move, no error, no duplicate rows | S1 |
| Launch blocked by claim failure | Add new | establishLtiChatIdentity | Thrown claim error still returns ACCOUNT with token | S1 |
| eLearning learnerId mismatch | Extend existing | elearning auth tests | eLearning launch claims the persona derived from learnerId, not from any cookie | S1 |
| Doc contract drift | none | docs/auth-model.md review | n/a (manual review) | S2 |
| Guest access regression | Extend existing | existing lti-guest, chatbot-published-gate, graph-query-scope tests | Guest launch still resolves persona and token exactly as before | S1 |
| Account history visibility | Add new | Playwright/browser | After claim, account thread list shows the guest conversation (real local browser) | S2 |
| Coexistence with account history | Add new | Claim service | An account that already has threads on the same chatbot keeps both sets; no overwrite, no dedup, no reordering | S1 |

### Delegation map and slices

| Slice | Owner / route | Files | Acceptance | Commit boundary |
| --- | --- | --- | --- | --- |
| S1 Claim service + backend wiring + tests | main (security-sensitive identity seam; executor candidates for the bounded test authoring within S1) | packages/util/src/chatGuestIdentity.ts (derivation helper moved/shared), packages/graphql/src/services/accounts.ts, apps/chat/test/lti-guest.test.ts (unchanged assertions guard byte-identical derivation), packages/graphql/test/accountLtiLinking.test.ts + new packages/graphql/test/guestConversationClaim.test.ts | All S1 portfolio rows green; claim service unit tests + integration via mocked prisma | Commit 1 |
| S2 Docs + browser proof + delivery | main | docs/auth-model.md, docs/chat-platform.md (only if needed), playwright/tests/Y-chat-lti-access.spec.ts (extend), plan Progress | S2 portfolio rows; draft PR opened; exact-head CI status recorded | Commit 2 |

Execution-tier skip reason for S1 remaining main-owned: the identity seam
(session precedence, verified-subject binding, launch routing) is security- and
data-integrity-sensitive and couples the util helper move, backend resolver and
prisma transaction; the coupling prevents a disjoint writer. Bounded test
authoring inside S1 may still go to the configured executor.

### Verification plan

S1: pnpm --filter @klicker-uzh/util test (vitest suite verified to exist),
pnpm --filter @klicker-uzh/graphql test focused on accountLtiLinking + new
claim suite, then the full graphql suite. Typecheck and lint for touched
packages. S2: extend Y-chat-lti-access.spec.ts with a
guest→account transition scenario (guest chat → create/link account → relaunch
→ thread list shows the conversation); run the relevant Playwright profile;
docs review. The full root check:all may need the documented host/container
split; record the split honestly if the hook cannot run whole.

The approved index correction additionally requires generated SQL provenance,
Analytics schema synchronization, local migration application, index validity
and usability checks, and equivalence of the amended schema to the generated
index changes. Preserve unrelated retained database drift.

### Authority and pause conditions

Authority: the approved batch covers implementation, ordinary task-branch commits
and non-force pushes, draft PR updates, verification and review corrections.
Repository policy also authorizes the final AI review command after CI and
ordinary feedback are settled. Marking ready was separately approved and
completed on 2026-10-14. Merge, deployment and production data changes require
separate authority.

Terminal (post-implementation approval): verified, reviewed draft PR into
v3-ai; deployment and production data changes withheld.

Pause triggers (material, not generic): a discovered need to mutate
persona-owned state beyond threads; any requirement to make the claim
user-visible or reversible; migrations beyond the two approved participant
indexes; CHAT_GUEST_SEED rotation
becoming entangled; conflict with the deployed release train (v3.4.0-alpha.77
is not an ancestor of origin/v3 — flagged in the prior session; verify before
delivery).

### Alternatives with dispositions

- Explicit "import my conversations" button: rejected for now — automatic claim
  needs no UI, no i18n, no new public contract; the button can be added later
  if users ask for control. Reopens if users report unwanted automatic claims.
- Claim only the current course per launch: weaker than all-participations
  enumeration; user asked for "any chatbot where they had used it as a guest",
  so all-participations is the default. Reopens only if per-course enumeration
  proves unsafe.
- Move threads plus merge credits/disclaimer: rejected — credits and consent
  are persona-scoped by design; merging would grant the account unaccepted
  consent or unearned credits. Reopens only on an explicit product ruling.
- Delete claimed personas: deferred — data-retention decision; see contract 7.
- Do nothing (stranded guest history): rejected by user direction.

### Working context

Repo root: /Users/rschlae/Git/klicker/klicker-uzh (primary checkout is clean
control; do not implement there). Implementation belongs in
trees/guest-conversation-claim. Container-dependent checks run in the managed
disposable task runtime; Playwright runs through the host wrapper. Both
CHAT_GUEST_SEED and APP_CHAT_GUEST_SECRET are dev fixtures in
util/_with_local_test_origins.sh, so local/CI guest flows work without real
secrets. Never print or commit secret values; query by key/status only.

## Progress

Plan constructed and grounded in this session (2026-09-16) by the main session
with repository evidence verified at baseline c4f0ecde20. Product-primitive
impact mapped with rs-product-primitives conventions. Implementation had not yet
started at that checkpoint.

Plan-hardening completed 2026-09-16 in round 1 under a user-authorized
native-model substitution. The configured planner child (gpt-6-astra, medium)
and its one permitted continuity fallback (gpt-5.6-sol, xhigh) both failed
terminally with the account usage limit before producing work (recorded in
project/_local/reviews/2026-09-16-guest-conversation-claim-plan-hardening.md);
the user then directed "use your native model instead." The challenge pass ran
in the main session as a native-self-review with the planner contract and
returned APPROVED with six accepted findings, all applied: cookie-wins match
detection (contract 2), claim-all-threads lifecycle scope (contract 3),
own-transaction placement (contract 1), byte-identical derivation invariant
(contract 10), portfolio coexistence row, and the documented benign in-flight
race (contract 4). Provenance is native-self-review, not an independent child;
an implementation-time planner-child pass remains possible as a fresh round.
The user subsequently approved implementation; this planning checkpoint is
historical.

### S1 implemented 2026-09-16 (commit b67b17c8e8)

The user approved the plan and directed "proceed according to plan with a goal".
S1 delivered the shared derivation helper, the claim service, the resolver
wiring and the integration suite.

- `packages/util/src/chatGuestIdentity.ts` holds the guest persona identity
  contract (`GUEST_SSO_PREFIX`, `GUEST_ACCOUNT_TYPE`, `getChatGuestSeed`,
  `deriveGuestSsoId`) and is re-exported from `packages/util/src/index.ts`.
  The derivation is byte-identical to the previous chat-local one; the golden
  vectors with seed `test-chat-guest-seed` were independently recomputed with
  plain `node:crypto` and match the recorded values.
- `apps/chat/src/lib/server/ltiGuest.ts` now re-exports the shared helper; its
  derivation assertions in `apps/chat/test/lti-guest.test.ts` are unchanged and
  pass, which is the contract-10 guard.
- `packages/graphql/src/services/guestThreadClaim.ts` implements the claim:
  a subject-to-participant match check (contract 2), enumeration of the
  account's participations, one persona lookup per `(ltiSub, courseId)`, and an
  `updateMany` reassignment of all of the persona's threads regardless of
  chatbot lifecycle status (contracts 3-4).
- `packages/graphql/src/services/accounts.ts` calls the claim on the ACCOUNT
  path only, after the participation upsert and before token issuance, in its
  own try/catch; the failure branch logs `event=guest_thread_claim_failed`
  without PII and the launch still returns a token (contracts 1 and 5).
- `packages/graphql/test/guestConversationClaim.test.ts` covers the S1
  portfolio rows: basic claim, cookie-wins skip, cross-course scope, paused-bot
  coverage, idempotent repeat, coexistence with account history, claim-failure
  non-blocking, eLearning learnerId, and the GUEST-path no-op.

Verification run in the worktree container (`default-rs-90dfb`): the new suite
(9 passed), `accountLtiLinking.test.ts` (20 passed), the chat `lti-guest` suite
(10 passed), the full chat vitest suite (1374 passed, 33 skipped), the full util
suite (139 passed), and the full graphql suite (1380 passed, 1 unrelated failure
that was residue from an interrupted run and passes on a clean database).
`packages/graphql` `check:ts` and `apps/chat` `tsc --noEmit` both pass; the 48
`TS2883` errors from a bare `tsc --noEmit` in `packages/graphql` are
pre-existing pothos portability noise in untouched schema files, and none are in
the touched files.

### S2 docs and browser proof 2026-09-16

`docs/auth-model.md` now records the reversed contract (guest history is
transferred), the claim's identity binding, failure semantics and retention, and
the `CHAT_GUEST_SEED` rotation coupling from contract 8.
`playwright/tests/Y-chat-lti-access.spec.ts` extends the LTI launch spec with a
guest → account transition: an anonymous launch creates the persona, the persona
owns a seeded conversation, the same LMS subject relaunches with a real account,
and the spec asserts the account session, the moved thread, and the conversation
visible in the account's sidebar. Ran on the host via `pnpm playwright:host`:
all 9 tests in the spec pass.

Open deployment gate (not a code blocker): the claim runs in the backend GraphQL
package, so production enablement needs `CHAT_GUEST_SEED` present in that
deployment's environment. The chart's backend-graphql container currently reads
only `secret-backend-graphql` plus GrowthBook; Chat receives the seed through
the out-of-band `…-secret-chat`. Adding it to the backend secret is an
infrastructure change and is withheld here.

### Refresh and review completion 2026-10-14

The user authorized bringing [PR #6097](https://github.com/uzh-bf/klicker-uzh/pull/6097)
up to date with current `v3-ai` and completing the reviews before a merge decision.
The existing branch and worktree are reused. Integration target:
`be6ae67368b3249dc01c2284bd6a8d66812a062d`; reason: 314 upstream commits since the
previous verified baseline, including account, runtime and review-workflow changes.
The ordinary merge preserves both guest identity and participant data-use exports.

Execution mode: standard; the current runtime identifies GPT-6 without an exact
allowlisted model ID. Main owns integration and verification because they are on
the critical path. Scoped simplification and risk review precede integrated final
review. Previous planner self-review remains applicable to the unchanged design.

Local implementation and verification are complete. The updated draft continues
through integrated final review, hosted CI and the repository's final AI review.
Those delivery gates are tracked on [PR #6097](https://github.com/uzh-bf/klicker-uzh/pull/6097).
The exact runtime will be stopped after the pre-push build.

Integration committed as `68df3b42e47d08bd4a82daefbf46a7d779036007` with all
repository hooks enabled. Full root checks passed; the initial unbounded build
stall was cleared through exact-runtime stop and bounded verification. The
focused account/claim suites passed 30 tests, guest/access regressions passed 36,
and the host LTI browser suite passed all 9, including claimed-history visibility.
Independent simplification and risk reviews of the original implementation found
no reportable issues; their reports are in `project/_local/reviews/`.

Main-session contract inspection reproduced a chronology defect: Prisma's
`@updatedAt` refresh on ownership reassignment promoted old guest conversations
above newer account history. The claim now uses a tagged, parameterized update
inside the same transaction and retains the owner predicate, preserving thread
timestamps. The existing coexistence test now verifies timestamp and history
ordering, and the rollback test forces a failure after this actual update.
This correction preserves the approved thread-only transfer contract.

Correction committed as `2a2289aa8fc57c68f6b75adc07587f7872d6544f`. The chronology
regression failed before the correction and passes with it. All 30 focused tests
and the type check passed; all root commit hooks passed with no bypass, and the
updated LTI browser spec passed 9 tests in 41.4 seconds. Synthetic placeholder
hashes are now explicitly labeled as dummy values so the hygiene gate recognizes
their fixture status. No runtime, deployment or merge acceptance is inferred from
these local results.

### Readiness refresh and Opus consultation — 2026-10-26

The user approved refreshing this PR against current `v3-ai`, checking the
affected behavior, and completing CI and review. Integration target is
`c86162dd786960e3ec3fbf0ab3f70a3d0b4c013a`; reason: 168 target commits since the
previous refresh, including changed Chat history and local verification tooling.
The merge is conflict-free and retains the nine-path guest-transfer package.
No behavior change or schema migration is planned. Execution mode remains
standard; main owns the integration and verification because they share the
candidate and disposable database. Existing design and simplification reviews
are reused unless inspection or verification finds a material change.

The user also requested discussion with Opus. A separate, read-only Claude Opus
5.5 consultation examines cookie-blocking calibration, the proposed ltijs
partitioned-cookie experiment, and dependencies between the harness, participant
session recovery and guest transfer. Its findings are advice to verify; source
readiness still requires the integrated review and applicable checks.

Verification is in progress. The exact task runtime uses the supported
`KB_GRAPH_BLOB_HOST_PORT=10013` override to avoid a port owned by another
workspace. No other workspace is stopped or changed. The existing hook exception
was for the preceding documentation-only commit and does not waive application
verification for this integration. Merge and deployment remain withheld.

Opus returned `DONE_WITH_CONCERNS` after inspecting the frozen branch sources.
It found no refresh-specific source defect and confirmed that the transfer
guard remains independent of which cookie the browser supplies. Accepted
roadmap refinements are recorded above. Speculative lookup batching and another
fixture for first-email linking are deferred: existing account-linking and
transfer tests cover the separate contracts, and neither is a reproduced
refresh regression. Local focused checks passed: 30 account/claim tests, 37
guest/access tests, and the GraphQL type check. Browser verification and full
repository checks remain in progress.

### Approved participant-index amendment — 2026-10-26

The hosted final review on `6a25fae37884d47df8d4184810c745aecc373268`
identified participant-filtered database work without a participant-leading
index. Source inspection confirms that `ChatThread` has no such index and
`Participation` only has the `(courseId, participantId)` unique index. The
participation lookup runs on verified ACCOUNT launches; the thread update runs
when the account has an eligible guest persona, including later launches after
the transfer. Production query plans, table sizes and latency are unmeasured.

Recommendation: amend this PR with a non-unique `participantId` index on each
table. A single-column index addresses the claim predicates with the smallest
index. The existing sidebar filters participant and chatbot and sorts by
activity time; optimizing its full ordering with a larger composite index is
outside this correction. The user chose to amend #6097 after the alternative
of a separate index PR was presented.

The user directly approved the amendment with "Amend #6097 (recommended)" in
response to the explicit two-index, two-migration approval card. That instruction
authorizes this source-only sequence:

1. Record the user's explicit decision before any schema edit. This approval
   extends the original no-migration package only to the two participant indexes.
2. Add `@@index([participantId])` to `ChatThread` and `Participation`. Generate
   the base SQL with Prisma in the guarded disposable runtime, then follow the
   existing concurrent-index convention: one statement per migration, preserving
   Prisma's names `ChatThread_participantId_idx` and
   `Participation_participantId_idx`. Two small ordered migration files are
   required because multi-statement concurrent builds cannot use the same
   transaction. Preserve the generated base and document the minimal addition
   of `CONCURRENTLY`. Check ordering against the current migration history.
3. Apply only in the guarded local environment, synchronize the Analytics
   schema mirror and run the schema-equivalence check. Never reset retained
   data to generate a migration; if retained history or drift prevents the
   normal create-only path, use a safe source-schema comparison or stop before
   changing existing schema or data. Verify both indexes are ready and valid.
   Use selective synthetic data or `enable_seqscan=off` with `EXPLAIN` to
   establish that the exact predicates can use the indexes; this proves
   usability, not production performance. Run the focused account/claim and
   browser transfer checks plus mandatory checks/build.
4. Update the no-migration passages and the primitive/verification sections.
   Ordinary task-branch delivery
   and review completion continue under the existing implementation approval.
   Hold the resulting candidate for its required CI and final review; no merge
   or real-environment migration/deployment is included.

Concurrent builds avoid the write-blocking build lock of ordinary index
creation, but can wait for older transactions and can leave an invalid index
if interrupted. A later deployment preflight must verify the two named indexes
and migration status alongside the matching-seed gate. Real-environment recovery
requires separate authority: inspect first, drop only an invalid newly added
index with `DROP INDEX CONCURRENTLY`, resolve that failed migration as rolled
back, then redeploy through the normal hook. Any local recovery is confined to
these newly created indexes in the marked disposable database. Source revert
is sufficient only before a shared database has received the migrations;
additive indexes remain compatible with an application rollback.

The user-requested Opus follow-up reviewed the frozen proposal independently.
Its requested corrections are reflected here: explicit approval first, no
unmeasured slowdown claim, a separate-PR alternative, the established two-file
concurrent convention, concrete index-usability checks, deployment recovery,
and plan updates after approval. Main retains ownership.

The index amendment is source-complete, with final verification pending.
Prisma 7.8 generated exactly the two index statements by comparing the previous
and amended source schemas after the normal create-only path reported unrelated
retained drift. The generated SQL was split into
`20261026122014_chat_thread_participant_index` and
`20261026122015_participation_participant_index`, adding only `CONCURRENTLY`
and the existing single-statement explanation. The Analytics mirror is synced.
Both migrations applied successfully through the guarded local migration path;
both indexes are ready, valid, non-unique and usable by the exact predicates.
The post-apply comparison removed only the two index gaps and retained the
unrelated drift. All 30 focused account/claim tests and all 9 browser cases pass
with the indexes. Mandatory checks/build, review of the correction, integrated
final review and hosted CI on the new candidate remain pending.
