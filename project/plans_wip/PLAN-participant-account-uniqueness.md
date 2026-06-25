# Participant account email uniqueness + cross-mode merge

## Goal

End up with a single `Participant` row per real person, identified by a normalized email, regardless of whether the account was originally created via manual signup or via SSO (Edu-ID / LTI). Today the database permits one row per `(email, isSSOAccount)` pair, so the same person can hold two parallel accounts. This plan covers both stopping new duplicates and consolidating existing ones.

This is the follow-up to the Phase 1 login fix (`fix(accounts): authenticate against every email candidate`) on branch `email-password-reset` / PR #5069. Phase 1 makes login deterministic when duplicates already exist; Phase 2 removes the conditions that allow them to exist at all.

## Background

### Schema today

`Participant.email` is nullable. Uniqueness is enforced as `@@unique([email, isSSOAccount])`. The combination of `(email = "alice@example.com", isSSOAccount = false)` and `(email = "alice@example.com", isSSOAccount = true)` is therefore allowed and produces two distinct `Participant` rows for the same person.

Ancillary tables that reference `Participant.id` directly (FK constraints): `Participation`, `ParticipantGroup` (m:n), `ParticipantAccount`, `QuestionResponse`, `QuestionResponseDetail`, `LiveQuizResponse`, `LeaderboardEntry`, `Feedback`, `ElementFeedback`, `PushSubscription`, `ChatThread`, `ChatUsageCredits`, `Title`, `AwardEntry`, `ParticipantAchievementInstance`, `GroupActivityClueAssignment`, `GroupAssignmentPoolEntry`, `GroupMessage`, `ParticipantInvitation`, `ParticipantAnalytics`, `ParticipantCourseAnalytics`, `ParticipantActivityPerformance`, `ParticipantPerformance`, `PointCorrection` (twice, via two relations). Any merge has to reassign every one of these.

### Where duplicates come from

| Path | File | Behavior today | Produces duplicate? |
| --- | --- | --- | --- |
| Manual signup (no LTI data) | `packages/graphql/src/services/accounts.ts` (`createParticipantAccount`, no-LTI branch) | Rejects if any participant with that normalized email already exists, regardless of `isSSOAccount`. | No |
| Manual signup with embedded LTI data | `accounts.ts` (`createParticipantAccount`, LTI branch) → `resolveOrCreateParticipantForLti(allowCreate=true)` | If exactly one participant matches by email, links via `ParticipantAccount` and reuses the existing row. If two match, fails closed. New rows get `isSSOAccount = true` but with a **user-supplied password**, so the participant can later log in via the regular email/password form too. | No |
| LTI-driven login (no create) | `accounts.ts` (`loginParticipantWithLti` → `resolveOrCreateParticipantForLti(allowCreate=false)`) | Same matching logic, never creates. | No |
| Edu-ID / OIDC participant flow | `apps/auth/src/lib/helpers.ts` (`createOrLinkParticipant`) | Looks up `email_isSSOAccount = (email, true)` and verified affiliations only. If a manual `(email, false)` row exists, it is invisible — a brand new SSO row gets created. The new row stores a `crypto.randomBytes(32)` hash that the user does not know, so this row cannot ever be used for email/password login. | **Yes, primary source today** |

The Edu-ID flow is the only path that still allows the cross-mode duplicate. This matches the pattern in CLAUDE.md ("Participant email uniqueness across auth modes" learning) — the GraphQL service layer was tightened, the OIDC flow was not.

### Two flavours of "SSO row"

The `isSSOAccount = true` flag does not on its own tell you whether the row has a usable password. Two distinct creation paths produce SSO rows:

| Path | `Participant.password` | Email/password login works? |
| --- | --- | --- |
| LTI account creation (`createParticipantAccount` LTI branch) | bcrypt hash of the password the user typed in the signup form | Yes |
| Edu-ID / OIDC creation (`createOrLinkParticipant`) | bcrypt hash of `crypto.randomBytes(32)` — discarded immediately | No (the user does not know the input) |

The Phase 1 login fix bcrypt-tests against every candidate row. Both flavours are handled correctly: LTI-created SSO rows authenticate when the user types the password they originally set; Edu-ID rows reject every input that is not the random hex that no one ever saw. This is also why the duplicate problem is more than a rare edge case — when an Edu-ID-created SSO row exists alongside the manual row the user actually uses, the user has no way to consolidate without help, and any future password-reset feature has to pick which row to reset.

### Test coverage

`packages/graphql/test/accountLtiLinking.test.ts` already covers:

- LTI links to existing manual participant on email match.
- LTI fails closed when more than one row shares the email.
- Manual signup rejected when SSO row exists for the same email.

Phase 1 adds `packages/graphql/test/loginParticipant.test.ts` covering the dual-row login case. Edu-ID OIDC has no automated coverage in this repo. Adding it inside Phase 2 is non-trivial because the flow lives in NextAuth callbacks in `apps/auth`; an integration test there would need a different harness than the GraphQL Vitest setup. The realistic option is a focused unit test of `createOrLinkParticipant` once it is restructured to be callable in isolation.

## Strategy

Three workstreams, in order:

1. **Plug the source.** Stop the Edu-ID flow from creating duplicate rows.
2. **Audit and merge existing duplicates.** One-off data migration with a documented merge service that the team can re-run if more cases surface.
3. **Tighten the schema.** Drop `(email, isSSOAccount)` uniqueness and replace it with single-column email uniqueness once the data is clean.

Each step is independently shippable. Step 1 alone stops the bleeding even if step 2 and 3 are deferred. Steps 2 and 3 should land together — the schema change requires the merge to have completed, and the merge is the only safe way to reach a state where the schema change can be applied.

### Step 1 — fix Edu-ID participant resolution

Current order in `createOrLinkParticipant`:

1. Lookup by `ssoId` on `ParticipantAccount`. If found, reuse.
2. Lookup by `(email, isSSOAccount = true)` on `Participant`.
3. Lookup by verified affiliation on `ParticipantAccount`.
4. Otherwise, create a new participant with `isSSOAccount = true` and a random password hash.

Target order, with the additional cross-mode lookup before any create:

1. Lookup by `ssoId` (unchanged).
2. Lookup all participants with the normalized email (drop the `isSSOAccount` filter). Resolve to one of three outcomes:
   - **Exactly one row, regardless of `isSSOAccount`**: reuse it. Promote it via the existing `ParticipantAccount` link, leave `isSSOAccount` as-is on the row itself (the flag becomes informational rather than authoritative; the source of truth for "has SSO" is the linked `ParticipantAccount`).
   - **No rows**: create a new `Participant` (existing behavior).
   - **More than one row**: fail closed and surface a clear "duplicate account" error to the user. This case should be rare after step 2 and a clean schema in step 3 makes it impossible.
3. Verified-affiliation fallback (unchanged) gates only the no-row case so it keeps its current role of recovering accounts where the primary email differs from a previously used affiliation email.

This collapses the "manual exists, SSO does not yet" gap. Existing manual users that log in via Edu-ID get linked instead of duplicated.

`isSSOAccount` on `Participant` becomes ambiguous after this — a participant that was created manually but later linked to SSO will keep `isSSOAccount = false` even though they have an active SSO link. We treat the `ParticipantAccount` row as the authoritative signal for "this account has SSO" and audit current call sites of `Participant.isSSOAccount` to make sure none of them rely on it for authorization decisions. Step 3 of this plan removes the column entirely once the migration is settled.

### Step 2 — audit and merge existing duplicates

#### Audit

Read-only query against production-like data:

| Question | Source |
| --- | --- |
| How many emails appear in more than one `Participant` row, after lowercasing and trimming? | `Participant` |
| For each duplicated email, what are the row counts and the `isSSOAccount` values? | `Participant` |
| For each duplicated pair, which row has activity (responses, leaderboard entries, XP, group memberships, last login)? | All FK tables |
| How many rows have `email = NULL`? Those are out of scope for this merge but should be counted. | `Participant` |

The output of this audit is a single CSV: one line per duplicate cluster, with both `Participant.id` values, both `isSSOAccount` values, both `lastLoginAt` values, and aggregated activity counts per row. The team eyeballs the CSV before merge to pick a tie-breaker rule and to decide whether anything looks anomalous (e.g. clusters of three+ rows, rows with very different XP that should not be combined silently).

#### Merge service

A service-layer function (not a one-shot script) that takes a "victim" and "canonical" participant id and reassigns everything from victim to canonical inside a single transaction, then deletes the victim. Lives in `packages/graphql/src/services/accountMerge.ts` so it can be reused by the migration runner, by support tooling, and by any future user-facing "I have two accounts, please merge" flow.

Decisions the function takes as inputs (not hard-coded):

| Decision | Default proposal |
| --- | --- |
| Which row is canonical | The one with the more recent `lastLoginAt`. Ties go to the row with a linked `ParticipantAccount`. |
| `email`, `username`, `avatar`, `avatarSettings`, `locale`, `isProfilePublic`, `isActive` | Take from canonical; victim's username is freed by the delete. |
| `password` | Take from canonical. If the canonical is an Edu-ID row (random hash) and the victim is a manual or LTI row with a user-set password, prefer the victim's `password` so the merged participant retains a working email/password login. Detect "random hash" pragmatically: any participant row that has a linked `ParticipantAccount` of type `EDUID` and was created in the same transaction as that account is treated as having a random password unless we know otherwise. |
| `xp`, `LeaderboardEntry.score` | Sum across both rows. Already-aggregated leaderboard rows for the same `(type, courseId)` or `(type, liveQuizId)` get their scores added; only one row survives per unique constraint. |
| `Participation` for the same course | Merge into one. If both have `courseLeaderboardId`, sum scores; keep the canonical's id. Concatenate `completedMicroLearnings` and `bookmarkedElementStacks` arrays with dedup. |
| `ParticipantGroup` membership | Union. If both rows are in the same group, the duplicate membership is dropped silently. |
| `QuestionResponse`, `QuestionResponseDetail`, `LiveQuizResponse` | Reassign by `participantId`. Some of these have `(participantId, instanceId)` uniqueness — if both rows responded to the same instance, keep the canonical's response and discard the victim's, log the discard for transparency. |
| `Feedback`, `ElementFeedback`, `ChatThread`, `ChatMessage`, `ChatUsageCredits`, `Title`, `Award`, `Achievement`, `GroupAssignmentPoolEntry`, `GroupActivityClueAssignment`, `GroupMessage`, `PushSubscription`, `ParticipantInvitation`, `PointCorrection` (both relations), all `Participant*Analytics`, `ParticipantPerformance` | Reassign by `participantId`. Where unique constraints overlap, prefer canonical and discard victim. |
| `ParticipantAccount` rows | Reassign by `participantId`; the `(participantId, ssoType)` unique key may collide if both rows had an LTI account on the same SSO type, in which case keep the canonical's and delete the victim's (extremely unlikely in practice — the duplicate exists precisely because the SSO row was created without finding the manual one). |

The function refuses to run if either id has `email IS NULL`, if the two rows have different non-null normalized emails, or if any FK reassignment would violate a non-mergeable invariant (e.g. group membership with conflicting roles, if any). Failure aborts the transaction and surfaces a structured error.

Output is a JSON receipt per merge: canonical id, victim id, counts of rows reassigned per relation, counts of rows discarded due to overlap, and the time taken. Stored in a new `ParticipantMergeAudit` table or, if the team prefers no schema additions, written to structured logs and shipped to the existing logging pipeline. The CLAUDE.md "no env files / Infisical only" pattern suggests we should not introduce new secrets for this; logging is fine.

#### Migration runner

A standalone TypeScript task (in `packages/prisma-data/` next to the seed scripts) that:

1. Re-runs the audit query.
2. For each cluster, applies the canonical-selection rule and calls the merge service.
3. Writes the receipt log.
4. Does not touch clusters with more than two rows; those are escalated for manual review.

Run order:

1. Apply step 1 to staging. Monitor for a few days that no new duplicates appear. The Edu-ID flow's logging ("event=eduid_linked_existing", "event=eduid_created_new") needs an additional event for the cross-mode link case so we can verify the new path is exercised.
2. Run the audit on staging. Run the migration runner on staging. Verify users can still log in.
3. Repeat on production during a low-traffic window. Take a fresh DB backup immediately before.

### Step 3 — schema change

Once production reports zero duplicates from a fresh audit, drop `@@unique([email, isSSOAccount])` and add `@@unique([email])` (with the partial-index workaround for nullable email — Prisma's behavior is that nullable unique columns allow multiple nulls, which is what we want for the legacy null-email rows we are keeping).

`isSSOAccount` becomes redundant with `ParticipantAccount.type = 'sso'`. Two options:

| Option | Pro | Con |
| --- | --- | --- |
| Drop the column | Removes ambiguity, smaller schema. | Touches a lot of files; need to audit every read site. |
| Keep the column, mark deprecated, stop writing it | Smaller diff, lower risk. | Code stays confusing. |

Recommendation: keep for one release, then remove in a follow-up. The first option is the right end state but does not need to land with the uniqueness change.

The Phase 1 login code already iterates over all candidates, so it transparently handles the post-migration case where each email maps to one row.

## Risks and open questions

- **What is the canonical row when both rows have activity in the same course?** The merge service's "sum scores" rule is the safe default but loses ranking history. Acceptable for a one-time migration; not acceptable as ongoing behavior. The right answer is to make the migration rare via step 1 and to escalate large activity gaps for manual review.
- **What about users who never had a manual account but expect their email/password to "just work" because they reset their password somewhere outside this codebase?** Two existing entry points already give SSO rows a usable password: the LTI account-creation form, which captures one at signup time, and (eventually) password reset, which the branch name signals is the next feature. Both write directly to `Participant.password`; the Phase 1 bcrypt loop in `loginParticipant` finds whichever row holds the matching hash. The only rows that remain "password-locked" are Edu-ID-created rows that were never linked to anything else — Phase 2 step 1 stops creating those when a manual or LTI row already exists, and step 2's merge consolidates the legacy ones onto the row with the working password.
- **Locale and email-validity flags differ across rows.** The merge takes canonical's values. If the SSO row is canonical (more recent login), we get `isEmailValid = true` for free; if the manual row is canonical, we trust its existing flag.
- **Cypress coverage.** The dual-account scenario does not currently have a Cypress flow. The audit query and merge service should at minimum get a unit test in `packages/graphql/test/`. A manual end-to-end check on staging covers the rest.
- **Anonymous / temporary participants.** Out of scope. They never carry a real email and are not affected by the uniqueness change.
- **`Participant.email` nullability.** Stays nullable. Some legacy rows have null emails; we are not changing them.

## Sequencing summary

| Order | Change | Where | Reversible? |
| --- | --- | --- | --- |
| 1 | Edu-ID flow looks up participants by email regardless of `isSSOAccount` and links rather than creates | `apps/auth/src/lib/helpers.ts` | Yes — revert restores prior behavior, no data migration needed |
| 2a | Audit query | New script under `packages/prisma-data/` | Read-only |
| 2b | Merge service + receipt log | `packages/graphql/src/services/accountMerge.ts` (+ tests) | Reversible only via DB backup; the merge deletes victim rows |
| 2c | Migration runner | `packages/prisma-data/` | Reversible only via DB backup |
| 3a | Replace `@@unique([email, isSSOAccount])` with `@@unique([email])` | `packages/prisma/src/prisma/schema/participant.prisma` + Prisma migration | Yes, schema-level |
| 3b | Drop `Participant.isSSOAccount` column (follow-up release) | Same | Yes, but requires call-site cleanup first |

Step 1 should be a small PR off `v3` that does not block the Phase 1 login fix from merging. Steps 2 and 3 should be a single coordinated change with explicit team review and a staging dry run.
