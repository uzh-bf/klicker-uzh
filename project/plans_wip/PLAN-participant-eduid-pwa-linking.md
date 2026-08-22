# Edu-ID login for regular PWA participants, account linking, and merge

Status: execution plan, decisions agreed, not yet started
Date: 2026-08-22
Base: `v3`
Related: `PLAN-participant-account-uniqueness.md` (its Step 1 is a prerequisite here), `docs/auth-model.md` (updates with this work)

## Goal

Offer Edu-ID as an alternative participant login in the regular PWA, using the mechanics that
already work in the assessment build, gated so a student can only arrive that way with a
legitimate course context: a verified course PIN when coming in from outside, or an LTI 1.3
launch when already inside a course in OLAT. Beyond login, a participant ends up with one
account that several login methods point at, can see which methods are linked, and can later
request that separate accounts be merged.

## Agreed decisions

These were settled before planning and are not reopened during implementation.

| Decision | Ruling |
| --- | --- |
| Scope of the PIN gate | The gate applies when an Edu-ID identity first becomes a participant, or first gains a course participation from the regular PWA. A returning, already-linked participant logs in with Edu-ID alone and never re-enters a PIN. |
| Session handoff | Exchange the Edu-ID session once for the ordinary participant token, mirroring the existing LTI exchange. The backend cookie ladder is not extended. |
| Merge execution | A participant requests the merge; it is not fully self-service in the first version. Conflicting course participations are resolved by choosing one, never by summing. |
| Sequencing of the resolver fix | The cross-mode email lookup from the uniqueness plan ships first, as its own small change, ahead of everything else here. |

## Background: what exists, what blocks this

The assessment build already runs the entire Edu-ID participant path — a participant NextAuth
configuration in `apps/auth` with its own cookie, an Edu-ID provider, and a resolver that
creates or reuses a participant. The database already supports several login methods per
participant: `ParticipantAccount` is unique per participant and login type
(`@@unique([participantId, ssoType])`), so an Edu-ID row and an LTI row coexist on one
participant. **No schema change is needed for linking.**

Four concrete obstacles stand between that and the regular PWA.

**The auth app deliberately bounces the PWA.** `apps/auth/src/middleware.ts:125` detects a PWA
origin, from either the referer or the `redirectTo`, and redirects it to the PWA login page.
Separately, one host list drives every participant decision in the app: `getStudentHosts()`
(`apps/auth/src/lib/helpers.ts:69`) reads `AUTH_STUDENT_ALLOWED_HOSTS` and falls back to
assessment-only defaults. It is consulted by `isAssessmentHost` inside `getAuthContext` twice
(`helpers.ts:131`, `helpers.ts:142`), by the `/student` redirect validation in the middleware,
and by the participant NextAuth `redirect` callback
(`apps/auth/src/pages/api/auth/[...nextauth].ts:215`). Widening that one list therefore covers
context detection, redirect validation, and the callback allowlist together.

**The backend never reads the Edu-ID cookie for a PWA origin.** `jwtMiddleware`
(`apps/backend-docker/src/app.ts`) selects the cookie from `req.headers.origin`. Outside
assessment mode a PWA origin reads `participant_token`, then `temporary_participant_token`,
then `next-auth.session-token`. `next-auth.participant-session-token` appears only in the
assessment branch.

**No course gate exists.** `createOrLinkParticipant` (`apps/auth/src/lib/helpers.ts`, from
line 373) resolves or creates a participant purely from the Edu-ID identity. Nothing anywhere
in that path asks whether the person belongs to a course.

**Linking is asymmetric between the two paths.** Both resolvers fall back to email, but they
look at different things:

| Lookup | Edu-ID resolver (`helpers.ts` from 373) | LTI resolver (`packages/graphql/src/services/accounts.ts:593`) |
| --- | --- | --- |
| By own identifier | `participantAccount` by `ssoId` | `participantAccount` by `ssoId` |
| By participant email | `email_isSSOAccount` with the flag pinned to `true` — **cannot see username/password accounts** | `participant.findMany({ email })` — no flag filter, already cross-mode |
| By verified affiliation address | Yes, `participantAccount` where `type: 'affiliation'` and matching `ssoEmail` | **No** |

The consequence is order-dependent and is the single most important defect to fix. Affiliation
addresses are written by `createParticipantAffiliations` (`helpers.ts:316`) as
`ParticipantAccount` rows with `type: 'affiliation'`, `isVerified: true`, and the institutional
address in `ssoEmail`. A student who signs in with Edu-ID first, under a private primary email,
and then launches from OLAT under a `uzh.ch` address is not found by the LTI resolver, even
though that exact address is already stored on their account. They are duplicated or rejected.
The reverse order happens to work by accident.

## Why linking cannot be eager

At an LTI launch the system does not hold the participant's Edu-ID subject identifier, and at
an Edu-ID login it does not hold their LTI subject identifier. There is no moment where both
are present. Linking is therefore transitive: each path resolves a participant by its own
identifier, falls back to email, and attaches its own account row to whatever participant it
landed on. The shared address is the join key. Making both paths consult the same set of
addresses — participant email *and* verified affiliation addresses, in both directions — is
what makes "arriving via LTI leaves you with both logins" true in practice rather than only in
the lucky ordering.

Where addresses genuinely differ and no overlap exists, automatic convergence is impossible and
the explicit linking action in Step 5 is the answer.

### One fact to establish before Step 2

What identifiers an OLAT launch actually carries is not knowable from this repository. If the
launch conveys an Edu-ID unique identifier alongside the email, direct identifier-based linking
becomes possible and the address heuristics drop to a fallback role, which would simplify
Step 2 considerably. `apps/lti/src/index.ts` logs the full launch token, so one staging launch
answers it. Do this before Step 2 is scheduled, not during it.

## Step 1 — cross-mode participant lookup in the Edu-ID resolver

Adopt Step 1 of `PLAN-participant-account-uniqueness.md` unchanged: `createOrLinkParticipant`
resolves an existing participant by normalized email regardless of `isSSOAccount`, and fails
closed when more than one participant matches rather than picking one.

This is a prerequisite, not a parallel effort. Retroactive linking for existing
username/password users is impossible while the lookup pins the flag to `true`, because those
are precisely the rows it cannot see.

It ships as its own change, ahead of the rest, so that the behavioural risk of altering an
already-live production login path is isolated from the new feature.

| | |
| --- | --- |
| Touches | `apps/auth/src/lib/helpers.ts` |
| Acceptance | An existing username/password participant signing in with Edu-ID on the same address is linked to their existing account rather than duplicated; two participants sharing an address produce a clean refusal, not an arbitrary pick |
| Risk | Changes an already-live assessment login path. The ambiguous case must fail as a clear refusal a support person can act on. |

## Step 2 — verified affiliation lookup in the LTI resolver

Extend the email fallback in `resolveOrCreateParticipantForLti` so that, when no participant
matches the launch address directly, it also looks for a verified affiliation account carrying
that address, mirroring what the Edu-ID resolver already does.

The existing duplicate-match refusal (`conflict_duplicate_email`) is the model for the new
ambiguity: if the direct match and the affiliation match point at different participants, or if
several affiliation rows match, refuse rather than guess. The two searches must be evaluated as
one result set, so ambiguity across them is caught and not just within each one.

Note that this resolver runs before the `allowCreate` gate, as `docs/auth-model.md` records, so
widening resolution here also widens what a non-creating launch can attach to. That is the
intended effect, and it is the reason the ambiguity handling has to be strict.

| | |
| --- | --- |
| Touches | `packages/graphql/src/services/accounts.ts` |
| Acceptance | The Edu-ID-first-then-OLAT ordering converges on one participant holding both an `EDUID` and an `LTI1.3` account row; ambiguous matches refuse |
| Risk | Broadening resolution on a launch path is security-relevant: it decides which account a launch lands in. Only `isVerified` affiliation rows may count. |
| Independent of | Steps 3–5; can ship any time after Step 1 |

## Step 3 — open the Edu-ID entry path for the regular PWA

Three coordinated changes plus translations.

**Host list.** `getStudentHosts()` becomes the union of the assessment hosts and the PWA hosts,
so that one list keeps driving context detection, the `/student` redirect validation, and the
NextAuth participant `redirect` callback together. The `AUTH_STUDENT_ALLOWED_HOSTS` value in
each environment needs the corresponding PWA host added, and the committed defaults in
`apps/auth/src/lib/constants.ts` need the same. This is as much a configuration change per
environment as a code change, and a missing value produces the `400 Invalid redirect URL` that
`docs/auth-model.md` already documents.

The union is for allowlisting only. The assessment and PWA sub-lists must survive as separate
values, because Step 4 needs to know which participant host class started the flow: assessment
Edu-ID creation stays ungated, PWA Edu-ID creation is PIN-gated. Collapsing the two into one
list would make `isAssessmentHost` true for both and destroy exactly that signal, so
`AUTH_PWA_HOSTS` and `DEFAULT_PWA_HOSTS` are kept and gain a new consumer rather than being
deleted.

**Middleware.** Remove the PWA-origin bounce at `middleware.ts:125` rather than inverting it, so
a PWA-origin request becomes an ordinary participant request instead of a differently special
case.

**Session exchange.** After the Edu-ID round trip the PWA verifies the NextAuth participant
session server-side and calls a mutation that issues the ordinary `participant_token`, exactly
as `apps/frontend-pwa/src/lib/getParticipantToken.ts` already does for the LTI token. This keeps
one session concept in the regular PWA, so the Apollo bearer fallback from session storage, the
thirteen-day cookie, logout, and `useParticipantToken` all keep working untouched. The backend
cookie ladder is not modified.

**Login form.** `apps/frontend-pwa/src/components/forms/LoginForm.tsx` currently shows the
Edu-ID button only when `NEXT_PUBLIC_IS_ASSESSMENT` is true. The button becomes available in
both builds. Its label is hard-coded English today and needs proper translations once regular
students see it.

| | |
| --- | --- |
| Touches | `apps/auth/src/middleware.ts`, `apps/auth/src/lib/constants.ts`, `apps/frontend-pwa/src/lib/`, `apps/frontend-pwa/src/components/forms/LoginForm.tsx`, `packages/i18n`, plus `AUTH_STUDENT_ALLOWED_HOSTS` per environment |
| Acceptance | Edu-ID login from the regular PWA completes and lands the student in the PWA as an authenticated participant with a working `participant_token`; the assessment build behaves exactly as before |
| Must not ship without | Step 4 |

## Step 4 — the PIN-or-LTI gate

The gate is enforced in the participant `signIn` callback in the auth app, not at the Step 3
exchange. `createOrLinkParticipant` runs inside that callback
(`apps/auth/src/pages/api/auth/[...nextauth].ts:140`), which is where the participant row is
actually created — well before the PWA ever reaches the exchange. Gating the exchange would
leave an ungated participant already written to the database, and the short-lived signed PIN
value is scoped to `/api/auth` on the auth domain, so it is readable in the callback and not at
the exchange. The exchange therefore stays a pure session-to-token conversion.

Inside the callback the rule is: if the identity already resolves to a participant, this is a
returning student and sign-in proceeds. If it does not, and the flow started from a PWA host
rather than an assessment host, a valid PIN context must be present or sign-in is refused
before any row is written.

| Path | Gate | Mechanism |
| --- | --- | --- |
| PWA, from outside, identity not yet known | Course PIN | PIN verified before the round trip starts; the resulting course id is carried across the round trip in a short-lived signed value and re-verified in the `signIn` callback before any participant is created |
| PWA, from outside, identity already linked to a participant | None beyond Edu-ID | Login proceeds; joining any further course still runs the ordinary PIN join |
| LTI 1.3 launch | The signed launch token | Already enforced in the LTI resolver; the course context comes from the launch |

**The PIN must not be trusted from the client after the redirect.** A PIN typed into a field
after the callback would be trivially bypassable. The workable shape is to validate the PIN
before redirecting, then carry a short-lived signed value scoped to the auth callback — the same
technique the auth app already uses for its redirect cookies, which live for ten seconds and are
scoped to `/api/auth` — and re-verify it in the `signIn` callback.

Two details that must not be missed:

`checkValidCoursePin` (`packages/graphql/src/services/courses.ts:4959`) resolves any PIN,
including an assessment course's. `joinCourseWithPin` excludes assessment courses; the pre-auth
gate must apply the same exclusion, otherwise an assessment PIN could authorise a regular-PWA
Edu-ID signup.

The `asParticipant` guard (`packages/graphql/src/schema/mutation.ts:105`) requires an
authenticated `PARTICIPANT` role and does not filter on token scope, so a token minted from an
Edu-ID login satisfies `joinCourseWithPin`. Verify this rather than assume it — the whole join
flow after Edu-ID login depends on it.

| | |
| --- | --- |
| Touches | The participant `signIn` path in `apps/auth` (`[...nextauth].ts`, `lib/helpers.ts`), `apps/frontend-pwa/src/pages/login.tsx` and the join entry, the PIN check service |
| Acceptance | Edu-ID from the regular PWA without a valid PIN and without an LTI context creates no participant and grants no session; with a valid non-assessment PIN it creates the participant and the course participation together |
| Risk | This is the security boundary of the feature. It ships with Step 3 or immediately before it; Step 3 must never reach production ungated. |

## Step 5 — linked logins in the profile

**Expose the data.** The participant GraphQL type
(`packages/graphql/src/schema/participant.ts:122`) is built from an interface over the Prisma
model plus computed fields, so a linked-logins field follows the established pattern. Per entry:
the login type, a masked form of the associated address, when it was linked, and whether it is
primary. The type must also express whether a usable password login exists — that is a property
of the participant rather than an account row, and it matters because Edu-ID-created
participants receive a random password they can never use. The profile must not imply otherwise.

Mask the addresses. This surface displays institutional addresses; show enough for recognition,
not the full address.

**Explicit linking.** Address convergence will not cover everyone. A participant must be able to
start an Edu-ID authorization while logged in and attach the resulting identity to the
participant *from their session*. This is a new flow, not a variation of the existing one: the
current resolver picks the participant from the identity, whereas an explicit link takes the
participant from the session and refuses if the incoming identity is already attached elsewhere.
That refusal is where a merge request becomes the offered next step.

An equivalent prompt after an LTI launch — connect your Edu-ID so you can also sign in from the
PWA — covers the OLAT-first direction.

**Where it lives.** `apps/frontend-pwa/src/pages/editProfile.tsx` is small and has no section
structure, so this arrives as a new section alongside the existing fields, carrying the link
action and, later, the merge request.

| | |
| --- | --- |
| Touches | `packages/graphql/src/schema/participant.ts`, participant services and ops, `apps/frontend-pwa/src/pages/editProfile.tsx`, `apps/auth` for the session-bound link flow, `packages/i18n` |
| Acceptance | A participant with several login methods sees all of them accurately, including whether a password login is usable; linking an already-attached identity refuses clearly |
| Depends on | Steps 1 and 2, otherwise the display is truthful about rows that should never have been separate |

## Step 6 — merge with per-conflict choice

The mechanical design is reused from `PLAN-participant-account-uniqueness.md`: a merge service
taking a canonical and a victim participant, per-relation reassignment across roughly
twenty-five foreign-key tables inside one transaction, and a JSON receipt for auditing.

Two deltas from that plan.

**Conflicting course participations are chosen, not summed.** The uniqueness plan's default sums
scores when both participants hold a participation in the same course. The agreed rule here is
that one participation is kept and the other discarded. Merge therefore cannot be a single
atomic call decided in advance. It needs three phases: a preview that reports the conflicting
courses with enough context to choose between them, a choice per conflict, and only then
execution. The receipt must record what was discarded, so the outcome is recoverable in
principle.

Whether the one-off migration in the uniqueness plan keeps summing or adopts choose-one is a
separate decision. Keeping them different is defensible, because the migration has no user to
ask, but it should be a stated choice rather than drift.

**Requested, not self-service.** The participant requests the merge from the profile and proves
control of both accounts, most naturally by having successfully authenticated as each. The merge
then runs after that proof, or is executed by support from the request. Merging is destructive,
irreversible, and driven by a claim of identity, which is why it is last and why the first
version does not hand the trigger to the user unattended.

Merge handles accounts that were already duplicated before linking existed. Steps 1 to 5 deliver
the login and the linking and are independently valuable without it.

| | |
| --- | --- |
| Touches | New merge service in `packages/graphql/src/services/`, profile request surface |
| Acceptance | A merge preview lists every conflicting course participation; execution applies the choices, reassigns everything else, and produces a receipt naming what was discarded |
| Depends on | Step 5 for the request surface |

## Sequencing

| Step | Content | Gate before starting |
| --- | --- | --- |
| 0 | Read an OLAT launch token on staging to establish which identifiers it carries | — |
| 1 | Cross-mode email lookup in the Edu-ID resolver | — |
| 2 | Verified affiliation lookup in the LTI resolver | Step 0, Step 1 |
| 3 | PWA Edu-ID entry: host list, middleware, session exchange, button, translations | Step 1 |
| 4 | The PIN gate in the participant `signIn` callback | Ships with Step 3 |
| 5 | Linked-logins field, profile section, explicit linking | Steps 1 and 2 |
| 6 | Merge with per-conflict choice | Step 5 |

Steps 3 and 4 are one release. Steps 1 and 2 are independently shippable and should not wait for
the PWA work.

## Risks and things to keep intact

**Assessment mode must not change.** The assessment build has its own origin, cookie, and
session. This work adds a second participant origin rather than altering the first. The
regression `docs/auth-model.md` records — anchoring the assessment build on `NEXT_PUBLIC_PWA_URL`
instead of `NEXT_PUBLIC_ASSESSMENT_URL` — becomes easier to reintroduce once both builds offer
Edu-ID, so the build-specific anchoring deserves an explicit check in Step 3.

**LTI 1.1 stays retired.** Nothing here reopens an unsigned launch path.

**Widening resolution is the security-relevant part.** Steps 1 and 2 both broaden which existing
account an external identity can attach to. Both must fail closed on ambiguity. Step 4 is what
keeps Step 3 from becoming an open participant-signup endpoint.

**Environment configuration is part of the change.** Step 3 depends on
`AUTH_STUDENT_ALLOWED_HOSTS` carrying the PWA host in every environment. A missing value fails as
a `400` from `/student`, which is easy to misread as a code fault.

**Verification is browser-based.** Every step from 3 onward changes a frontend-facing auth or
redirect flow, so it is verified in the browser with delegated login, not by reasoning about the
code.

**Documentation.** `docs/auth-model.md` describes the cookie table, the participant login list,
and the resolver behaviour. All three become inaccurate as these steps land, and each updates in
the change that invalidates it.
