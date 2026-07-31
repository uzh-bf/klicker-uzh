# T01 — Re-verify the plan's 13 codebase claims against current v3

Label: `wayfinder:research`
Parent: [MAP.md](../MAP.md)
Status: closed
Assignee: Claude (session 2026-07-31)
Blocked by: —

## Question

The plan's **Current Codebase Findings** table (line ~92) makes 13 claims about the
codebase, each with an evidence path. They were verified on 2026-07-06. Since then `v3`
has moved to Prisma 7 and Next 16, gained a devcontainer, and migrated its docs to a
wiki. Which claims are still true?

Produce a table marking each row **fresh**, **stale**, or **changed**, with a
`file:line` citation for each verdict. Where a claim is stale, state what is true now.

Known already: the LTI-launch-payloads row still says "LTI 1.1 still has a verification
TODO" — retired in PR #5260, merged as `7812fa71ce`. Treat that row as confirmed stale
and check whether its neighbours moved with it.

Pay particular attention to rows whose evidence sits in files this repo has since
reorganised, and to anything Prisma 7 changed about schema-level uniqueness or defaults.

## Resolution

Verified 2026-07-31 against `origin/v3` = `7812fa71ce`.

**Eleven rows fresh, two changed, one stale — and the table is missing a row.**

### Method

The plan names its review base as `d6c7772f8` (2026-07-01). That commit is still
reachable, so the check is a diff rather than a re-read: 21 commits separate it from
`7812fa71ce`, and only seven of the evidence paths were touched at all. Every "fresh"
verdict below means the file is byte-identical to the reviewed version or its changed
lines do not touch the claim; every other verdict is backed by the diff.

Line numbers cite the file as it stands at `7812fa71ce`.

### Verdicts

| # | Claim area | Verdict | Evidence at `7812fa71ce` |
| --- | --- | --- | --- |
| 1 | Participant email fields and uniqueness | fresh | `participant.prisma:53-54` `email String?` / `isEmailValid Boolean @default(false)`; `:101` `@@unique([email, isSSOAccount])` |
| 2 | Participant SSO account email | fresh | `participant.prisma:31` `ssoEmail String?` — see *Undocumented constraints* below |
| 3 | Participant invitations | fresh | `participant.prisma:9-10` raw `email` + `matriculationNumber`; `:22-23` `@@unique([email, courseId])`, `@@index([email])` |
| 4 | Magic-link login | fresh | `accounts.ts:216` `sendMagicLink` |
| 5 | Participant signup | fresh | `accounts.ts:813` `createParticipantAccount`; `:873-894` normalizes, stores, sets `isEmailValid: false` |
| 6 | LTI participant linking | **changed** | `accounts.ts:617-780` still links by `ssoId` then normalized email and writes both `email` and `ssoEmail` — but `:609-613` now rejects any scope other than `LTI1.3` before the transaction opens. The claim holds for LTI 1.3 only |
| 7 | LTI launch payloads | **stale** | The LTI 1.1 branches are gone from `getParticipantToken.ts` and `createAccount.tsx` (PR #5260); no verification TODO remains anywhere. `apps/lti/src/index.ts` is unchanged — LTI 1.3 still puts `email` in the launch JWT and still exposes it from `/info` |
| 8 | Assessment Edu-ID linking | fresh | `apps/auth/src/lib/helpers.ts` byte-identical to the review base. `:416,429,457,462` write `Participant.email`; `:440,474` write `ssoEmail`; `:156` `autoAcceptInvitations` still matches raw invitation emails |
| 9 | GraphQL email exposure | fresh | `schema/participant.ts:140-141`; `schema/course.ts:380,415`; `schema/assessment.ts:96`. `services/courses.ts` changed by 289 lines but `:2051,2136,2163` still read `accounts[0]?.ssoEmail ?? p.email` |
| 10 | Push communication | fresh | `services/notifications.ts` unchanged; `:139-153` `handleSendPushNotifications` still validates VAPID config and returns with the entire delivery body commented out |
| 11 | Export PII | fresh | `packages/export/src` unchanged. `pii.ts:13,23,36` per-run HMAC pseudonymization; `participants.ts:71` applies it at export time only |
| 12 | Passkey dependencies | **changed** | Stronger than the claim: `@simplewebauthn/*` is not installed at all, transitively or otherwise. `pnpm-lock.yaml:2893-2899` shows it only as an **optional unmet peer** of `@auth/core@0.41.2`, pinned to `browser ^9.0.1` / `server ^9.0.2` |
| 13 | Username generation | fresh | `createAccount.tsx:3` imports `generate-password`; `:169,183` still prefill a random username |

### The missing row

A personal-data store landed after the review that the plan does not mention anywhere.
PR #5141 (2026-07-17, `feat(export): export student assessment report with verifiable
credentials`) added `VerifiableCredential` — see
`packages/prisma/src/prisma/schema/verification.prisma` and migration
`20260706151837_add_verifiable_credentials`. It:

- stores `subjectEmail String` raw and non-nullable (`verification.prisma:15`);
- derives that value from `ParticipantInvitation.email` and **throws
  `ASSESSMENT_REPORT_IDENTITY_UNVERIFIED` when no invitation email exists**
  (`services/assessmentReports.ts:341-346`) — a hard dependency on the exact field the
  plan wants to stop retaining raw;
- embeds the same address a second time inside the credential snapshot as
  `subject.email` (`assessmentReports.ts:374`), which is then covered by `snapshotHash`;
- exposes it over GraphQL (`schema/verification.ts:188`) into a lecturer-facing list
  (`CourseVerifiableCredentialsList.tsx:138,214`);
- is mirrored into the analytics database by `prisma:sync`
  (`apps/analytics/prisma/schema/verification.prisma:15`).

The snapshot hash is the sharp part: credentials are meant to stay independently
verifiable after issue, so anything that changes how the subject identity is stored has
to say what happens to already-issued rows. Ticketed as
[Fold the verifiable-credential email surface into the plan](T10-verifiable-credential-emails.md).

### Undocumented constraints found on the way

Not claims that went stale — facts the plan's Data Model section never recorded, both of
which constrain decisions still open:

- `participant.prisma:44` `@@unique([participantId, ssoType])` caps a participant at one
  account per `ssoType`, and `ssoType` is a free-form `String` still defaulting to
  `"LTI1.1"` (`:30`). Noted on
  [Decide the ParticipantAccount migration shape](T05-participantaccount-shape.md).
- `participant.prisma:34-36` `type` (`"sso"` / `"affiliation"`), `isPrimary`, and
  `isVerified` already exist on `ParticipantAccount`, with indexes at `:46-47`.

Prisma 7 also moved connection config out of the schema:
`datasource.prisma` no longer declares `url` or `shadowDatabaseUrl`, and the Pothos
generator's `clientOutput` is now `./client.js`. Relevant to
[Confirm the target data model holds under Prisma 7](T03-target-model-prisma7.md).

### Ticket premises corrected

The ticket assumed several reorganisations had moved the evidence. They had not: all 13
evidence paths still resolve at `7812fa71ce`, `docs/auth-model.md` included. Next 16,
TypeScript 6, the devcontainer, and the OKF wiki all landed inside the 21-commit range
but touched none of them.
