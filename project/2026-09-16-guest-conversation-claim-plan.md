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
their enrolled courses, and needs no schema migration.

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

This is a direction-only plan. Approval covers the planning work and the plan
artifact only. Implementation, task-branch commits and pushes, PR creation and
any production effect each need their own explicit ruling.

## Execution details

### Goal and non-goals

Goal: one person's guest conversations follow them into their real account.

Non-goals: no manual "import" button; no UI change; no migration or new tables;
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
  cascade; reassignment is updateMany on participantId.
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
   claiming every thread each found persona owns. Chatbot access gating
   (PUBLISHED checks in the thread routes) already governs visibility, so a
   PAUSED bot's claimed history simply appears if the bot is ever resumed;
   restricting the claim to PUBLISHED bots would strand paused-bot threads for
   no protective gain. Do not touch ChatUsageCredits, disclaimer acceptance,
   participation rows of the persona, or any other persona-owned state.

4. Idempotency and concurrency. Re-running the claim is a no-op (threads
   already on the account match nothing). Concurrent launches: guard with the
   persona row lock or updateMany natural semantics (WHERE participantId =
   personaId); updateMany cannot double-apply. Log claimed thread count per
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

### Authority and pause conditions

Authority (this plan): direction-only approval covers the planning work and
this committed plan. Implementation slices, ordinary task-branch commits and
pushes, draft PR delivery, and any production effect each require a further
explicit user ruling. The plan records the expected delivery path so the user
can approve it in one word later.

Terminal (post-implementation approval): verified, reviewed draft PR into
v3-ai; deployment and production data changes withheld.

Pause triggers (material, not generic): a discovered need to mutate
persona-owned state beyond threads; any requirement to make the claim
user-visible or reversible; any schema migration; CHAT_GUEST_SEED rotation
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
impact mapped with rs-product-primitives conventions. No implementation exists.

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
Next action: user approval of this plan; implementation remains withheld.
