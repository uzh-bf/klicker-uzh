# Review: PR #5128 — Participant Privacy Authentication Plan

- **Reviewed**: 2026-07-06, against plan at commit `23e3da53e` and codebase at `v3` (`d6c7772f8`)
- **Scope**: UX of the proposed flows, quality/accuracy of the plan document, usefulness as an implementation guide, and remaining steps toward production readiness
- **Method**: every load-bearing codebase claim in the plan was spot-checked against the actual source (results in section 1); all six open review-bot findings were independently re-verified against the plan text

## Verdict

The plan is **accurate, well-researched, and worth merging after fixes**. All 14 codebase claims that were spot-checked are correct, the slice ordering is sensible, and the migration runbook (measure → shadow → backfill → compare → canary → cutover) follows good practice. The document is genuinely useful as an implementation guide.

It is **not yet production-ready as a plan** for four reasons:

1. Six review-bot findings on the proposed schemas are all valid and unresolved (section 3.1).
2. The plan misses several operational surfaces: existing E2E tests, seed data, DB backups, the analytics schema mirror, and login-method telemetry that is a hard prerequisite for sizing the migration (section 3.2).
3. Several product decisions are stated as open ("LTI 1.1 needs a hard decision") but have no owner, no deadline, and no data to decide with (section 5, Phase B).
4. The student-facing UX has two friction points that will generate support load if shipped as written: mandatory recovery-code setup at signup, and lockout of students who today rely on magic-link login (section 2).

Section 5 is the concrete, ordered path to production readiness. Each task says what to change, where, and how to verify it.

## 1. Evidence: plan claims vs. codebase

Every row was verified on 2026-07-06. "OK" means the plan's claim matches the code exactly.

| Plan claim | Evidence | Result |
| --- | --- | --- |
| `Participant.email String?`, `@@unique([email, isSSOAccount])` | `packages/prisma/src/prisma/schema/participant.prisma:53,100` | OK |
| `ParticipantAccount.ssoEmail String?`, `@@unique([participantId, ssoType])` | `participant.prisma:31,44` | OK |
| `ParticipantInvitation.email String`, `@@unique([email, courseId])` | `participant.prisma:9,22` | OK |
| `sendMagicLink` logs in by stored email | `packages/graphql/src/services/accounts.ts:216` | OK |
| `createParticipantAccount` stores email, `isEmailValid=false` for non-LTI | `accounts.ts:804,885` | OK |
| `resolveOrCreateParticipantForLti` writes email + `ssoEmail` | `accounts.ts:587,754-777` | OK |
| LTI 1.3 JWT and `/info` carry email | `apps/lti/src/index.ts:73,166` | OK |
| LTI 1.1 body trusted with open TODO | `apps/frontend-pwa/src/lib/getParticipantToken.ts:80,104` | OK |
| Auth app writes `ssoEmail`, matches invitations on raw email | `apps/auth/src/lib/helpers.ts:188-216,345,352` | OK |
| GraphQL exposes participant/leaderboard/assessment email | `packages/graphql/src/schema/participant.ts:140`, `schema/course.ts:380,415` | OK |
| Push delivery is stubbed (body commented out) | `packages/graphql/src/services/notifications.ts:139-190` | OK |
| Export package has pseudonymize mode but DB keeps source PII | `packages/export/src/pii.ts:3-23` | OK |
| `@simplewebauthn/*` transitive-only, not in any `package.json` | `pnpm-lock.yaml` (6 hits), no manifest declares it | OK |
| Random username prefill via `generate-password` | `apps/frontend-pwa/src/pages/createAccount.tsx:3` | OK |

Conclusion: the "Current Codebase Findings" section of the plan can be trusted as-is. The problems are in what the plan proposes and what it omits, not in what it observed.

## 2. UX review

### 2.1 Student signup: mandatory recovery codes at the worst moment

The target signup flow (plan "Target Flows" step 5) hard-requires a recovery method (passkey or downloaded recovery codes) before the account exists. Klicker signups frequently happen **live in a lecture, seconds before a quiz starts**. Forcing a passkey dialog or a file download at that moment will cause abandonment and lecture disruption.

**Recommendation**: make recovery setup deferrable. Create the account after email challenge + username + password, let the student join the activity, then require recovery setup on the next non-live login (persistent blocking nag, e.g. within 7 days). The plan already has a "continue once" concept for the migration checklist — apply the same pattern to signup. Never block the join-a-running-quiz path.

### 2.2 Students who rely on magic link today will be locked out

Current UX actively steers students toward email login as the password-recovery path: the login error copy says "If you have forgotten your password, please use the 'E-Mail Login' function" (`packages/i18n/messages/en.ts:179`), and the login page offers "Login with E-Mail" (`en.ts:505`). After cutover, a student with a forgotten password and no recovery setup is **permanently locked out** — and the support burden lands on lecturers mid-lecture.

The plan's migration checklist addresses this, but nobody can currently size the problem: login events only write `lastLoginAt` (`accounts.ts:80,763,888`) with **no record of which method was used**. The Slice 0 inventory as written cannot answer "how many active students depend on magic link".

**Recommendation**: ship login-method telemetry first (see Phase C, task C1) and let ≥4 weeks of real data drive the timeline and grace-period decisions. This is a hard prerequisite for the T-8-weeks communication timeline in the plan.

### 2.3 Migration timeline must respect the semester calendar

The timeline template (T-8w … T+8w) is calendar-agnostic. A cutover mid-semester means blocking checklists during running courses and prize/leaderboard changes under lecturers mid-course; a cutover during an assessment window is worse. **Recommendation**: anchor T-day to a semester boundary (early February or early September) and state this constraint in the plan.

### 2.4 Passkeys on shared/lab devices

The plan correctly refuses silent account linking because of shared devices, but does not apply the same thinking to passkeys: a discoverable credential created on a university lab computer is a credential someone else can use. **Recommendation**: add UX copy that warns against creating passkeys on shared devices and steers those users to recovery codes.

### 2.5 What is good and should not be watered down

- User-chosen usernames replacing `generate-password` prefill — directly removes the "random username nobody remembers" failure mode.
- Explicit link/merge ceremony, no auto-link by email, LTI-vs-manual conflict screens — the "Existing LTI Identity Points To Another Participant" flow is exactly right for shared devices.
- Claim-code prize flow — solves lecturer prize contact without reintroducing email; cheap first version.
- Assessment identity kept course-scoped and encrypted rather than pretending assessment can be anonymous.

## 3. Quality findings — defects to fix in the plan document

### 3.1 Open review-bot findings: all six are valid (independently re-verified)

Resolve each with a plan edit, then reply/resolve the PR comment. Line numbers refer to `project/2026-06-16-participant-privacy-auth-plan.md` at `23e3da53e`.

| # | Finding (bot) | Verified | Fix to apply |
| --- | --- | --- | --- |
| B1 | `ParticipantRecoveryCode.codeHash` lacks `@unique` (line 217) | Yes | Add `@unique` to `codeHash`; note codes must be generated with enough entropy that hash collisions are impossible in practice |
| B2 | `matriculationLookupHash` has no key-id field (lines 280, 318) | Yes | Either add `matriculationKeyId` to both models or state that `emailKeyId` governs all lookup hashes in the row and rename it `lookupKeyId` |
| B3 | Recovery file references `participantRecoveryId` that no schema defines (line 233) | Yes | Add a `recoveryFileId String @unique` (or a parent `ParticipantRecovery` model) so a recovery file can be matched to an account without the username |
| B4 | `subjectHash` keyring unspecified (lines 180-182 vs. 295-296) | Yes | State explicitly which keyring `subjectHashKeyId` draws from; recommended: a third keyring so LTI subject hashes and assessment email hashes rotate independently |
| B5 | Internal AI-tooling artifact "Context7 lookup … failed due quota" (line 62) | Yes | Delete the line |
| B6 | Assessment backfill falls back to `Participant.email` without filtering `isEmailValid` (line 772) | Yes | Backfill order: `ssoEmail` → `Participant.email` **where `isEmailValid=true`** → invitation email; route unverified-email-only rows to the "flag missing identity" bucket |

### 3.2 Additional findings from this review

**F1 — `password` is required today; the plan silently assumes it becomes nullable.**
`participant.prisma:56` has `password String` (required). The plan's target model shows `password String? // nullable after passkey-first migration` and signup step 5 marks password "Optional", but no slice contains the migration that makes it nullable, and `loginParticipant` needs null-handling. Add this explicitly to Slice 2 (or a dedicated slice): schema change, bcrypt-compare guard for null, and a decision on whether passkey-only accounts are allowed in v1.

**F2 — No login-method telemetry (see 2.2).** Add to Slice 0 as the first deliverable: record method (`password | magic_link | lti | eduid`) per login, e.g. a `lastLoginMethod` column or a lightweight event log. Without it the inventory cannot size magic-link reliance and the timeline is guesswork.

**F3 — Consent/privacy copy contradicts the target state and is a legal surface.**
The in-app privacy notice tells students that course owners "will be able to see your **e-mail address**" (`packages/i18n/messages/en.ts:582`) and links to the external privacy policy. Slice 6 only mentions login-label i18n. The plan needs a task: revise consent text (en + de), revise the external privacy policy with the DPO, and decide whether changed terms require re-consent on next login.

**F4 — Existing E2E tests and seed data will break and are not mentioned.**
`cypress/cypress/e2e/A-login-workflow.cy.ts:214` ("Sign in into student account with the students email") breaks at Slice 2, and the new Playwright suite mirrors the Cypress cases. Seeded participants (`packages/prisma-data`) carry emails. Add to each slice's definition of done: update Cypress + Playwright specs and seeds in the same PR.

**F5 — Purge is incomplete without backup alignment.**
Nulling email columns does not remove emails from DB backups/dumps. Add to the cutover runbook: document backup retention, and declare the purge complete only after backup rotation exceeds the retention window. Also audit Redis for cached participant payloads before claiming purge.

**F6 — Analytics schema mirror.** Every new Prisma model must be synced to `apps/analytics` (`pnpm run prisma:sync` per repo workflow), and the analytics service should be audited for participant-email reads. Not mentioned in any slice; add to Slice 1.

**F7 — Stale metadata and filename.** Plan header says "Branch/MR: not started" (line 6) — update to PR #5128 / `codex/participant-privacy-auth-plan`. Per repo convention, rename the file to include the PR id (e.g. `2026-06-16-participant-privacy-auth-plan-pr5128.md`) in a separate metadata commit.

**F8 — Referenced enums are never defined.** `ParticipantIdentityProvider`, `ParticipantEmailChallengePurpose`, `AssessmentIdentitySource`, `ParticipantAccountLinkStatus`, `ParticipantMergeStatus` appear in the proposed schemas without definitions. Acceptable in a plan, but add a one-line note so the implementer knows to define them in Slice 1 (Prisma requires it).

**F9 — Student copy is English-only.** The repo ships de + en (`packages/i18n/messages/`); UZH student communication must exist in German. Add DE variants of the three copy templates before any notice is sent.

**F10 — No owners, estimates, or decision log.** The plan says "LTI 1.1 needs a hard decision" and "Keep `ParticipantAccount` as a compatibility facade … or migrate it directly" without an owner or deadline. Add a decision table (decision, options, recommendation, owner, status) — see Phase B below for the concrete list.

## 4. Usefulness assessment

High. The codebase findings are verifiable and correct (section 1), the slices map to real files and functions, the merge/linking section correctly enumerates the uniqueness constraints that make naive merges impossible, and the migrated auth wiki additions are accurate and worth having even independent of this plan. The gaps are additive (missing surfaces, missing decisions), not structural — no re-write needed.

## 5. Path to production readiness

Ordered. Do not start a later phase before the earlier one is done.

### Phase A — finish this PR (docs-only, ~half a day)

1. Apply the six fixes from section 3.1 (B1-B6) to `project/2026-06-16-participant-privacy-auth-plan.md`.
2. Apply F1, F5, F6, F8, F9 as plan-text additions; apply F2 to Slice 0; apply F3 as a new task in Slice 6; apply F4 to the Verification Plan; apply 2.1/2.3/2.4 recommendations to Target Flows and the Timeline Template.
3. Fix metadata (F7): update the header lines; rename the file with the PR id in a **separate** commit.
4. Format and validate: `pnpm install`, then `pnpm exec prettier --write project/*.md` (the PR body notes prettier could not run — fix that validation gap now).
5. Resolve each review-bot comment on the PR with a short reply referencing the fixing commit.
6. Update the PR description Validation section, then mark the PR ready for review.

**Done when**: all bot threads resolved, prettier passes, plan contains the new sections, PR is un-drafted.

### Phase B — decisions before any implementation (needs product owner / DPO; prepare a one-page memo per decision)

| # | Decision | Data to gather first | Recommendation in plan |
| --- | --- | --- | --- |
| D1 | LTI 1.1: verify signatures or retire | `SELECT "ssoType", count(*) FROM "ParticipantAccount" GROUP BY 1;` plus join on `Participant.lastLoginAt > now() - interval '12 months'` | Retire if active LTI 1.1 usage is negligible; otherwise implement signature validation (plan already calls the TODO unacceptable) |
| D2 | Recovery setup: mandatory at signup vs. deferred | Login-method telemetry (C1) + signup funnel data | Deferred (section 2.1) |
| D3 | Cutover date + grace windows | Semester calendar + telemetry | Semester boundary (section 2.3) |
| D4 | Privacy policy / consent re-versioning | DPO consultation | Required before first student notice (F3) |
| D5 | `ParticipantAccount`: facade vs. direct migration | Count of code references to `ParticipantAccount` | Facade during migration, remove in Slice 7 |
| D6 | Retention durations (assessment identity, challenges, claim contacts) | Legal/DPO input | Plan's ranges are placeholders; fix concrete values |

**Done when**: each row has an owner, a written decision, and the plan is updated to remove the corresponding "open decision" language.

### Phase C — first implementation PR (matches the plan's "First Implementation PR", refined)

- **C1 (ship first, tiny)**: login-method telemetry. Add method recording to `loginParticipant`, `sendMagicLink` redemption, and the LTI login path in `packages/graphql/src/services/accounts.ts`. Verify: unit test per method + one seeded-login smoke check.
- **C2**: inventory script following the existing convention `packages/graphql/src/scripts/YYYY-MM-DD_<name>.ts` (see `2024-10-31_cleanup_responses.ts` for shape). Read-only; outputs the counts listed in Slice 0 **plus** login-method distribution once C1 has data. Verify: run against local seeded DB (`pnpm run prisma:setup` first), then staging.
- **C3**: crypto helper (AES-256-GCM + HMAC lookup hashes, key-id keyrings) with vitest coverage per the plan's Verification section; add the two (or three, per B4) env keys to Infisical and `turbo.json` `globalEnv`.
- **C4**: Prisma models from the plan (with B1-B3 fixes and F8 enums), migration via `pnpm run prisma:migrate`, mirror via `pnpm run prisma:sync`, regenerate client + `pnpm --filter @klicker-uzh/graphql generate`. No behavior change, all new code behind `PARTICIPANT_PRIVACY_AUTH_ENABLED=false`.

**Done when**: `pnpm run check` passes, `pnpm --filter @klicker-uzh/graphql test` passes, inventory report from staging is attached to the tracking issue, and no user-facing behavior changed (verify by running the PWA login flow once with `npx agent-browser`).

### Phase D — standing rules for every later slice (2-7)

- Update Cypress **and** Playwright specs and `packages/prisma-data` seeds in the same PR as the behavior change (F4).
- i18n changes always in en + de.
- Any UI-facing slice: verify with `npx agent-browser` (delegated login, seeded credentials) and attach before/after screenshots to the PR.
- Regenerate GraphQL ops after any schema/resolver change.
- Slices 2, 3, 4 as written each span schema + backend + two frontends; split each into a backend PR (flag-gated) and a frontend PR to keep review tractable.

## 6. How to re-verify this review

```bash
# claims table (section 1) — spot-check any row, e.g.:
sed -n '50,56p;100p' packages/prisma/src/prisma/schema/participant.prisma
grep -n "usernameOrEmail\|magicLinkLogin" packages/i18n/messages/en.ts
grep -n "TODO" apps/frontend-pwa/src/lib/getParticipantToken.ts
sed -n '139,160p' packages/graphql/src/services/notifications.ts
grep -n "students email" cypress/cypress/e2e/A-login-workflow.cy.ts
# telemetry gap (F2):
grep -rn "loginMethod\|lastLoginMethod" packages/graphql/src packages/prisma/src  # no hits today
```
