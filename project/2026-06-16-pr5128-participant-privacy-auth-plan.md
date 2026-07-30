# Participant Privacy Authentication Plan

Goal: remove participant email as a global identifier, keep non-assessment participation pseudonymous, and store assessment identity only where it is legally/functionally required.

Date: 2026-06-16
Last updated: 2026-07-30
Branch/PR: `codex/participant-privacy-auth-plan` / GitHub PR #5128
Target branch: `v3`

## Recommendation

Use this target model:

- **Non-assessment participants**: no persisted email, no persisted email hash, no LTI email, no affiliation email. Login uses passkeys, username/password, LTI, and recovery codes/files. Email may be used only inside short-lived verification challenges, then discarded.
- **Assessment participants**: email is stored per assessment course/participation, encrypted at application layer, with a keyed lookup hash only for matching invitations and verified SSO claims. The global `Participant.email` and `ParticipantAccount.ssoEmail` stay empty.
- **LTI participants**: trust the signed LTI launch. Persist a keyed hash of the external subject, not the email. If an LTI-origin account later sets a password, password reset must happen after a fresh LTI launch or with recovery codes/passkeys, not by email.
- **Existing participants**: run a time-boxed migration. Keep legacy email login/claim only long enough to help users who do not remember usernames, then purge legacy emails.

Important caveat: this makes participant data pseudonymous, not mathematically anonymous. Responses, usernames, course participation, IP/proxy logs, and stable login identifiers can still link activity over time. The concrete improvement is removing email as a global identifier and making assessment identity course-scoped, encrypted, and access-controlled.

## Consolidated Review Status

This is the single source-of-truth plan for PR #5128. The former standalone review note (`project/2026-07-06-pr5128-review-participant-privacy-plan.md`) has been folded into this document and should not be maintained separately.

The 2026-07-06 review verdict was: the observed codebase facts are accurate and the migration sequence is directionally sound, but behavior-changing implementation must wait until the product/DPO decisions in [Risks and Decisions](#risks-and-decisions) are assigned and closed. The review findings are represented here as follows:

- schema issues are incorporated in [Target Data Model](#target-data-model), including unique recovery-code hashes, recovery file public ids, lookup-hash key ids, and separate keyrings for assessment lookup hashes and external identities;
- UX concerns are incorporated in [Target Flows](#target-flows), especially deferred recovery setup during live lectures, no random username prefill, shared-device passkey warnings, and no email reset once email is not retained;
- operational gaps are incorporated in [Migration Plan](#migration-plan) and [Verification Plan](#verification-plan), including login-method telemetry first, Cypress/Playwright and seed updates, analytics schema sync, DPO/privacy-copy work, and backup/cache purge alignment;
- unresolved choices are kept explicit in the open decision table rather than hidden inside slice text.

Production-readiness gate: do not start behavior-changing implementation until Slice 0 telemetry/inventory is planned and the open decision table has owners, target dates, and decision records. The first implementation PR may still be behavior-neutral telemetry/inventory work.

## External Guidance Checked

- NIST SP 800-63B draft/current docs: recovery codes are an accepted recovery authenticator pattern when issued and managed carefully. Source: https://pages.nist.gov/800-63-4/sp800-63b.html
- OWASP Forgot Password Cheat Sheet: reset flows must avoid account enumeration, use single-use expiring tokens, avoid sending passwords by email, and notify users after reset. Source: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- FIDO Alliance passkeys guidance: passkeys are phishing-resistant credentials; multiple authenticators reduce account-recovery dependence. Sources: https://fidoalliance.org/passkeys/ and https://fidoalliance.org/white-paper-multiple-authenticators-for-reducing-account-recovery-needs-for-fido-enabled-consumer-accounts/
- W3C WebAuthn Level 3: browser API for scoped public-key credentials. Source: https://www.w3.org/TR/webauthn-3/
- GDPR Articles 25 and 32: data protection by design/default, pseudonymisation, and encryption are explicitly relevant controls. Sources: https://gdpr-info.eu/art-25-gdpr/ and https://gdpr-info.eu/art-32-gdpr/

## Research Addendum

### Privacy Positioning

The product language should change from "truly anonymous account data" to a more precise claim:

- **Non-assessment account profile**: no stored email or direct contact identifier.
- **Learning activity data**: pseudonymous because it remains tied to a stable participant id, username, course participation, groups, points, and responses.
- **Assessment data**: identified, but purpose-limited and encrypted because lecturers need a real identity to administer assessments.
- **Anonymous participation**: still only applies to temporary/no-account flows or participation modes where no persistent account/course history is linked.

Why this matters:

- EDPB pseudonymisation guidance treats pseudonymisation as a safeguard, not anonymisation, when re-identification is still possible with additional information. Source: https://www.edpb.europa.eu/system/files/2025-01/edpb_guidelines_202501_pseudonymisation_en.pdf
- ICO anonymisation guidance frames anonymisation as reducing identifiability to a sufficiently remote level; stable per-user account data normally does not meet that bar. Source: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/anonymisation/how-do-we-ensure-anonymisation-is-effective/
- Swiss FADP purpose/proportionality framing means the design should avoid collecting email where it is not necessary, and keep the assessment exception narrow. Official law source: https://www.fedlex.admin.ch/eli/cc/2022/491/en
- GDPR transparency rules require communication that is concise, intelligible, and specific about what changes for students. Source: https://gdpr-info.eu/art-12-gdpr/
- EDPB data-protection-by-design guidance supports making privacy the default, not an optional advanced setting. Source: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-42019-article-25-data-protection-design-and_en

### Authentication and Recovery

Research conclusion: if non-assessment email is not persisted, email cannot remain a normal password-reset factor. A future "enter your email and reset password" flow would require either a participant-linked email, a participant-linked email hash, or a separate identity provider. All three reintroduce a durable contact identifier.

Recommended recovery hierarchy:

1. **Passkey** as the best user experience and strongest recovery/authenticator option. Use discoverable credentials so students do not need to remember a generated username.
2. **Recovery codes/file** as mandatory fallback for non-LTI manual accounts. Store only code hashes. Show/download once.
3. **Active session** can add/rotate passkeys, password, and recovery codes.
4. **Fresh LTI launch** can recover an LTI-origin account because the external platform is the trusted verifier.
5. **Legacy email claim** only during migration, not as steady-state recovery.

Implementation notes:

- `@simplewebauthn/browser` and `@simplewebauthn/server` are present in `pnpm-lock.yaml` as transitive dependencies but are not declared in package manifests. Add direct pinned dependencies in the app/package that owns passkeys before implementation. Official docs: https://simplewebauthn.dev/docs/packages/server and https://simplewebauthn.dev/docs/advanced/passkeys

### Communication Surfaces in Current Code

Current broad communication channels are weaker than the product goal implies:

- Existing participant email templates can send one-time migration notices while legacy emails still exist.
- PWA login/profile/create-account screens already have i18n privacy text and can show blocking setup steps.
- Course docs and lecturer communication can explain course-level changes.
- `PushSubscription` exists, but `handleSendPushNotifications` currently returns `true` with delivery code commented out; push is not a reliable migration channel today.
- `GroupMessage` exists only inside participant groups, not as a course-wide participant inbox.
- There is no general participant notification/inbox model in Prisma.

Product implication: build a small in-app migration notice/checklist surface or notification table before relying on in-app notices for existing students.

## Current Codebase Findings

The original review spot-checked the load-bearing codebase claims on 2026-07-06 against `v3` (`d6c7772f8`). Re-verify before implementation because the codebase has moved since then; the table records why this plan was accepted as a credible starting point, not a permanent proof.

| Claim area | Evidence path | Review result |
| --- | --- | --- |
| Participant email fields and uniqueness | `packages/prisma/src/prisma/schema/participant.prisma` | Current schema stores participant email and validates email state globally |
| Participant SSO account email | `packages/prisma/src/prisma/schema/participant.prisma` | Current schema stores `ParticipantAccount.ssoEmail` |
| Participant invitations | `packages/prisma/src/prisma/schema/participant.prisma` | Current invitations store raw email and matriculation values |
| Magic-link login | `packages/graphql/src/services/accounts.ts` | Current magic-link login depends on stored participant email |
| Participant signup | `packages/graphql/src/services/accounts.ts` | Current account creation requires and stores email |
| LTI participant linking | `packages/graphql/src/services/accounts.ts` | Current LTI path writes email and `ssoEmail` and links by email fallback |
| LTI launch payloads | `apps/lti/src/index.ts`, `apps/frontend-pwa/src/lib/getParticipantToken.ts` | Current LTI paths carry email; LTI 1.1 still has a verification TODO |
| Assessment Edu-ID linking | `apps/auth/src/lib/helpers.ts` | Current assessment auth writes global email fields and matches invitations by raw email |
| GraphQL email exposure | `packages/graphql/src/schema/participant.ts`, `packages/graphql/src/schema/course.ts`, `packages/graphql/src/schema/assessment.ts` | Current API exposes participant/leaderboard/assessment emails |
| Push communication | `packages/graphql/src/services/notifications.ts` | Push delivery is not a reliable migration channel today |
| Export PII | `packages/export/src` | Export can pseudonymize artifacts, but source PII remains in the database |
| Passkey dependencies | `pnpm-lock.yaml`, package manifests | SimpleWebAuthn appears transitively only; implementation needs direct pinned dependencies |
| Username generation | `apps/frontend-pwa/src/pages/createAccount.tsx` | Current create-account flow can prefill random usernames |

### Data Model

- `packages/prisma/src/prisma/schema/participant.prisma`
  - `Participant.email String?`, `isEmailValid Boolean`, `@@unique([email, isSSOAccount])`.
  - `ParticipantAccount.ssoEmail String?`.
  - `ParticipantInvitation.email String`, `matriculationNumber String?`, `@@unique([email, courseId])`.
- `packages/prisma/src/prisma/schema/course.prisma`
  - `Course.authType` is `SSO | PIN`.
  - `Course.isAssessmentEnabled` gates assessment behavior.

### LTI

- `apps/lti/src/index.ts`
  - LTI 1.3 launch creates `lti-token` JWT with `sub`, `email: token.userInfo.email`, and `scope`.
  - `/info` exposes token `email` if present.
- `apps/frontend-pwa/src/lib/getParticipantToken.ts`
  - Verifies `lti-token` and sends `signedLtiData` to `loginParticipantWithLti`.
  - LTI 1.1 path signs `lis_person_contact_email_primary`.
  - LTI 1.1 has a TODO to verify the body is valid.
- `apps/frontend-pwa/src/pages/createAccount.tsx`
  - Reads LTI token email and pre-fills `CreateAccountForm`.
  - Generates a random username with `generate-password`.

### Participant Account Service

- `packages/graphql/src/services/accounts.ts`
  - `loginParticipant` accepts username or email.
  - `sendMagicLink` finds participants by username or email and sends login email to stored `Participant.email`.
  - `createParticipantAccount` requires email, stores it, sends activation email, and marks non-LTI accounts `isEmailValid=false`.
  - `resolveOrCreateParticipantForLti` links by `ssoId`, then by normalized email, creates new participants with `email`, `isEmailValid=true`, `isSSOAccount=true`, and stores `ssoEmail`.
  - `loginParticipantWithLti` refuses assessment courses and handles only non-assessment LTI.
- `packages/graphql/src/services/participants.ts`
  - `getSelf` exposes `email` and `institutionalEmail` from `ParticipantAccount.ssoEmail`.
  - `updateParticipantProfile` validates and writes `email`.

### Assessment Auth

- `apps/auth/src/pages/api/auth/[...nextauth].ts`
  - Participant Edu-ID requests `email` and affiliation mail claims.
  - JWT callback stores `token.email`.
- `apps/auth/src/lib/helpers.ts`
  - `createOrLinkParticipant` stores `profile.email` into `Participant.email` and `ParticipantAccount.ssoEmail`.
  - Affiliation emails are stored in `ParticipantAccount.ssoEmail`.
  - `autoAcceptInvitations` matches raw invitation emails and participant emails.
- `apps/backend-docker/src/app.ts`
  - In assessment mode, backend accepts `next-auth.participant-session-token` from assessment origin.

### Email Exposure

- `packages/graphql/src/schema/participant.ts`
  - `Participant.email` and `institutionalEmail` are public GraphQL fields.
- `packages/graphql/src/schema/course.ts`
  - `LeaderboardEntry.email` and `AssessmentParticipant.email` are exposed.
- `packages/graphql/src/schema/assessment.ts`
  - `participantEmail` is exposed in assessment result rows.
- `packages/graphql/src/services/courses.ts`
  - Assessment result aggregation reads `accounts[0].ssoEmail ?? participant.email`.
  - `getAssessmentCourseParticipants` returns email.
  - Course leaderboard returns participant email for lecturer views.
- `packages/export/src/*`
  - Export package writes participant email, SSO id/email, invitation email, matriculation number, and correction email. It supports pseudonymization in the export artifact, but the database still stores the source PII.

## Target Data Model

### Global Participant

Keep global participant identity free of direct contact identifiers:

```prisma
model Participant {
  id String @id @default(uuid()) @db.Uuid

  username String @unique
  password String? // nullable after passkey-first migration
  avatar String?
  xp Int @default(0)
  isActive Boolean @default(true)
  isProfilePublic Boolean @default(true)
  locale Locale @default(en)
  lastLoginAt DateTime?

  // legacy during migration only; remove in final cleanup migration
  email String?
  isEmailValid Boolean @default(false)
}
```

Implementation note: do not drop fields in the first migration. Make writes stop first, backfill/read from new tables, then drop after the legacy claim window.

### External Login Identity

Replace raw SSO/LTI identifiers with keyed subject hashes for matching:

```prisma
model ParticipantExternalIdentity {
  id String @id @default(uuid()) @db.Uuid
  participantId String @db.Uuid
  provider ParticipantIdentityProvider // LTI13, LTI11, EDUID, ...
  issuer String?
  clientId String?
  deploymentId String?
  subjectHash String @unique // HMAC(provider|issuer|clientId|deploymentId|sub)
  subjectHashKeyId String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  participant Participant @relation(fields: [participantId], references: [id], onDelete: Cascade)
}
```

`subjectHash` must use `PARTICIPANT_EXTERNAL_IDENTITY_HMAC_KEYS_JSON`, not the assessment lookup-hash keyring. This keeps external login identifiers and assessment contact lookup hashes independently rotatable.

Keep `ParticipantAccount` as a compatibility facade during migration, or migrate it directly if the blast radius is manageable.

### Non-Assessment Email Challenge

Use email only transiently:

```prisma
model ParticipantEmailChallenge {
  id String @id @default(uuid()) @db.Uuid
  purpose ParticipantEmailChallengePurpose // SIGNUP, ACCOUNT_CLAIM_NOTICE
  tokenHash String @unique
  emailRateLimitHash String // HMAC(normalizedEmail), no lookup after expiry
  consumedAt DateTime?
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([emailRateLimitHash, purpose, createdAt])
}
```

Do not store raw email. Do not store a long-lived email hash on non-assessment participants. Send the email immediately after creating the challenge token; the callback only proves possession of the mailbox for that one action.

### Recovery Codes / Recovery File

```prisma
model ParticipantRecoveryFile {
  id String @id @default(uuid()) @db.Uuid
  participantId String @db.Uuid
  publicId String @unique
  createdAt DateTime @default(now())
  revokedAt DateTime?

  participant Participant @relation(fields: [participantId], references: [id], onDelete: Cascade)
  codes ParticipantRecoveryCode[]

  @@index([participantId])
}

model ParticipantRecoveryCode {
  id String @id @default(uuid()) @db.Uuid
  participantId String @db.Uuid
  recoveryFileId String @db.Uuid
  codeHash String @unique
  label String?
  usedAt DateTime?
  createdAt DateTime @default(now())

  participant Participant @relation(fields: [participantId], references: [id], onDelete: Cascade)
  recoveryFile ParticipantRecoveryFile @relation(fields: [recoveryFileId], references: [id], onDelete: Cascade)

  @@index([participantId])
  @@index([recoveryFileId])
}
```

Recovery file contents:

```json
{
  "type": "klicker-participant-recovery",
  "version": 1,
  "username": "chosen-name",
  "recoveryFilePublicId": "public-random-id",
  "codes": ["single-use-code-1", "..."]
}
```

Store only hashes. Show/download once. `ParticipantRecoveryFile.publicId` is a high-entropy public lookup id shared by all codes in one downloaded file, so a recovery attempt can find the right account without username or email. Recovery codes still need enough entropy that hash collisions are practically impossible. Require recovery code or passkey to reset password if the user is outside LTI.

### Passkeys

```prisma
model ParticipantPasskeyCredential {
  id String @id @default(uuid()) @db.Uuid
  participantId String @db.Uuid
  credentialId String @unique
  credentialPublicKey Bytes
  counter BigInt
  transports String[]
  backedUp Boolean?
  deviceType String?
  createdAt DateTime @default(now())
  lastUsedAt DateTime?

  participant Participant @relation(fields: [participantId], references: [id], onDelete: Cascade)
}
```

Use discoverable credentials so users can sign in with passkey without remembering a username.

### Assessment Identity

Store assessment identity per course/participation, not globally:

```prisma
model AssessmentParticipantIdentity {
  id String @id @default(uuid()) @db.Uuid
  courseId String @db.Uuid
  participantId String @db.Uuid

  emailCiphertext Bytes
  emailNonce Bytes
  emailTag Bytes
  emailLookupHash String // HMAC(normalizedEmail), keyed separately from encryption
  emailKeyId String

  matriculationCiphertext Bytes?
  matriculationNonce Bytes?
  matriculationTag Bytes?
  matriculationLookupHash String?
  matriculationLookupHashKeyId String?

  source AssessmentIdentitySource // EDUID_PRIMARY, EDUID_AFFILIATION, LTI, INVITATION
  verifiedAt DateTime
  retentionUntil DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([courseId, participantId])
  @@unique([courseId, emailLookupHash])
}
```

Use Node `crypto` AES-256-GCM for app-layer encryption unless there is an existing internal crypto helper. Keys come from Infisical:

- `PARTICIPANT_PII_ENCRYPTION_KEYS_JSON`: keyring with active key id.
- `PARTICIPANT_PII_LOOKUP_HMAC_KEYS_JSON`: separate keyring for lookup hashes.
- `PARTICIPANT_EXTERNAL_IDENTITY_HMAC_KEYS_JSON`: separate keyring for LTI/Edu-ID `subjectHash` values.
- Add all three to `turbo.json` `globalEnv`.

Implementation note: define all referenced Prisma enums in Slice 1, including `ParticipantIdentityProvider`, `ParticipantEmailChallengePurpose`, `AssessmentIdentitySource`, `ParticipantAccountLinkStatus`, and `ParticipantMergeStatus`.

### Assessment Invitations

Migrate `ParticipantInvitation.email` and `matriculationNumber` to encrypted + lookup-hash columns. Keep GraphQL/export fields named `email` only as resolver/output fields for authorized assessment course managers.

```prisma
model ParticipantInvitation {
  id Int @id @default(autoincrement())
  courseId String @db.Uuid
  participantId String? @db.Uuid
  status InvitationStatus @default(PENDING)

  emailCiphertext Bytes
  emailNonce Bytes
  emailTag Bytes
  emailLookupHash String
  emailKeyId String

  matriculationCiphertext Bytes?
  matriculationNonce Bytes?
  matriculationTag Bytes?
  matriculationLookupHash String?
  matriculationLookupHashKeyId String?

  invitedAt DateTime @default(now())
  acceptedAt DateTime?

  @@unique([emailLookupHash, courseId])
  @@index([emailLookupHash])
}
```

## Target Flows

### Non-Assessment Manual Signup

1. User enters email only on a verification screen.
2. Backend creates `ParticipantEmailChallenge` with token hash and short expiry, sends link, stores no raw email.
3. Link opens account creation.
4. User chooses username manually. Do not pre-fill random username.
5. User creates a password or passkey.
6. Create `Participant` with no email.
7. Let the participant join a running live activity immediately. Do not block a lecture-start signup on passkey dialogs or file downloads.
8. Require a durable recovery method on the next non-live login, or after a short grace window:
   - Preferred: passkey.
   - Required fallback: downloadable recovery codes.
   - Shared-device warning: do not create passkeys on lab/shared computers; use recovery codes instead.
9. Delete/consume challenge.

Why no email reset: without storing at least an email hash linked to the participant, email cannot prove ownership of an existing account. Email can verify a mailbox for signup, but not recover an account later. The recovery contract must be passkey/recovery file/LTI.

### Non-Assessment Password Login

- Login accepts username + password only.
- Remove email from `usernameOrEmail` labels and GraphQL arg names.
- If password reset is needed:
  - passkey-authenticated session can set new password;
  - recovery code can set new password and rotates remaining codes;
  - LTI-origin account can reset only after fresh LTI launch;
  - no email-only reset.

### Non-Assessment Passkey Login

- Add passkey button on login page.
- Use discoverable credential flow so username is optional.
- On successful assertion, map credential to participant and issue existing `participant_token`.

### LTI Non-Assessment Login

1. `apps/lti` verifies LTI launch through ltijs.
2. JWT contains `sub`, `scope`, `issuer`, `clientId`, `deploymentId`, and target metadata. It does not contain email.
3. PWA sends `signedLtiData` to GraphQL.
4. GraphQL hashes external subject and finds/creates `ParticipantExternalIdentity`.
5. If no account exists:
   - create participant with generated internal username only if username is not required for login;
   - prompt user to choose public username before using social/profile features;
   - do not prefill email.
6. If user sets password from an LTI session, mark password recovery policy as `LTI_OR_RECOVERY_ONLY`.

LTI 1.1 needs a hard decision:

- Preferred: route all LTI 1.1 launches through a verifier equivalent to `apps/lti` or retire LTI 1.1 account creation.
- Minimum acceptable: implement signature validation before trusting `lis_person_sourcedid`. Current TODO is not acceptable for the new trust model.

### Assessment Login

1. Assessment auth continues through Edu-ID / trusted SSO.
2. `createOrLinkParticipant` links by external subject hash, not by email.
3. Email/affiliation mail from Edu-ID is used only to:
   - match `ParticipantInvitation.emailLookupHash`;
   - populate/update `AssessmentParticipantIdentity` for the matched assessment course.
4. `Participant.email` and `ParticipantAccount.ssoEmail` remain empty.
5. Assessment GraphQL resolvers decrypt email only for authorized lecturers/managers of that assessment course and only for assessment queries/exports.
6. Student self view can display masked email from decrypted assessment identity only inside assessment context if needed.

### Non-Assessment Leaderboard Prizes

Remove email from non-assessment leaderboard APIs and exports. Add privacy-preserving prize workflows instead:

- **Winner announcement**: lecturer selects leaderboard entries and sends in-app notification with free text, e.g. "Contact prizes@example.uzh.ch with claim code".
- **Claim code**: system generates course-scoped one-time code visible to participant and lecturer verification UI. Participant contacts lecturer externally and provides the code. Klicker stores no email.
- **Optional encrypted claim contact**: if product wants in-app claim submission, store contact email in `CoursePrizeClaimContact` encrypted with retention (e.g. 30-90 days), scoped to a course/prize, never on `Participant`.

Recommendation: implement claim code first. It solves prize verification without reintroducing global email.

## Account Linking and Data Merge

### Product Rule

Do not auto-link participant accounts by email, username, display name, or similar-looking profile data. Once email is removed as a durable identifier, a link must prove control of both sides:

- an active manual account session plus password/passkey/recovery re-auth;
- a fresh signed LTI launch;
- an active passkey/recovery-code login;
- for assessment, a verified Edu-ID assessment session plus stricter course rules.

This means a manual account and a later LTI-created account can only be combined through an explicit account-link ceremony. The ceremony should say "link login methods" for identity-only cases and "merge account data" only when stored course activity must be reconciled.

### Identity Model

Treat `Participant` as the profile and data owner. Login methods attach to one participant:

- username/password;
- passkeys;
- recovery codes/files;
- LTI external identities;
- assessment Edu-ID external identities;
- legacy email claim only during migration.

Future schema should allow more than one external identity of the same provider type per participant. Current `ParticipantAccount` has `@@unique([participantId, ssoType])`, which blocks a participant from linking multiple LTI identities with the same `ssoType`. The `ParticipantExternalIdentity` replacement should instead make the external subject hash unique, not the participant/provider pair.

Recommended additional tables:

```prisma
model ParticipantAccountLinkIntent {
  id String @id @default(uuid()) @db.Uuid
  initiatorParticipantId String @db.Uuid
  targetParticipantId String? @db.Uuid
  provider ParticipantIdentityProvider?
  subjectHash String?
  courseId String? @db.Uuid
  stateHash String @unique
  status ParticipantAccountLinkStatus @default(PENDING)
  expiresAt DateTime
  consumedAt DateTime?
  createdAt DateTime @default(now())
}

model ParticipantMerge {
  id String @id @default(uuid()) @db.Uuid
  primaryParticipantId String @db.Uuid
  secondaryParticipantId String @db.Uuid
  status ParticipantMergeStatus @default(PLANNED)
  plannedAt DateTime @default(now())
  executedAt DateTime?
  rowCounts Json
  decisions Json
}
```

Keep audit data minimal: participant ids, course ids, selected side, row counts, timestamps, and executor. Do not store email in merge/link logs.

### Link Flows

#### Manual Account, Then LTI Launch

When a participant is logged in manually and arrives through a signed LTI launch:

1. Verify LTI signature and derive the external subject hash.
2. If subject hash is already linked to the same participant, continue and ensure course participation.
3. If subject hash is unlinked, show an explicit choice:
   - link this LMS login to the current Klicker account;
   - continue with a separate LMS account.
4. Require recent manual re-auth before linking.
5. Create `ParticipantExternalIdentity` for the current participant and ensure course participation.

Default should not silently link. Shared devices and lab computers make "current browser session" an unsafe signal by itself.

#### LTI Account, Then Manual Account

When a participant is in an LTI-authenticated session and wants to use an existing manual account:

1. Start "I already have a Klicker account" from the LTI landing/login page.
2. Authenticate the manual account with username + password/passkey/recovery code.
3. If the manual participant has no conflicting course data, attach the LTI identity to the manual participant.
4. If both participants have stored data, open the merge preview.

If the LTI participant has no meaningful data yet, prefer identity linking and delete the empty LTI participant after moving the external identity.

#### Existing LTI Identity Points To Another Participant

If a signed LTI launch resolves to participant B while the browser is logged in as participant A:

1. Do not silently switch or link.
2. Show "This LMS login is already linked to another Klicker account."
3. Offer:
   - switch to the linked LTI account;
   - merge accounts after proving control of both accounts;
   - cancel.

This catches accidental shared-device states and duplicate account creation.

#### Account Settings

Add a participant account settings area:

- linked login methods;
- add passkey;
- add recovery codes/file;
- link LMS account;
- merge another account;
- unlink login method only if another recovery/auth method remains.

The steady-state UX should steer users to "one account, multiple login methods" before duplicate data exists.

### Merge Trigger

Run a merge planner whenever two proved participant accounts need to become one:

- manual account exists, LTI account already has data;
- two LTI identities belong to same human and both have course data;
- migration discovers a legacy email match but cannot auto-link safely;
- support/admin resolves a duplicate-account request.

The planner should be dry-run first and return:

- profile differences;
- linked login methods to move;
- courses only present on one side;
- courses present on both sides;
- assessment-course blockers;
- row counts by table;
- irreversible deletes needed after user choice.

### Primary Account Choice

User chooses one primary participant profile:

- username/display identity;
- avatar/settings/profile visibility;
- locale;
- password/passkeys/recovery credentials to keep;
- public profile id after merge.

Login methods from both accounts move to the primary participant, subject to uniqueness checks. Secondary sessions are revoked after merge. A fresh participant token is issued for the primary account.

Global `Participant.xp` should not be summed directly. Recompute it from kept course data and achievements where possible; otherwise preserve the selected primary profile value and enqueue a gamification rebuild.

### Course Data Rules

Use the course as the conflict unit. This matches the product question: if both accounts are in the same course, the participant chooses which course data to keep.

#### Course Exists On One Side Only

Move the whole course participation to the primary participant:

- `Participation`;
- course leaderboard entry;
- practice quiz and microlearning responses/details;
- live quiz responses and applied point corrections;
- timeline entries;
- bookmarks and completed microlearnings;
- push subscriptions;
- group assignment pool entry;
- group membership and group messages;
- group activity clue assignments;
- participant achievements, titles, awards for that course;
- feedback and element feedback;
- course-scoped chat threads/usage records.

Then invalidate analytics and leaderboard caches for the course.

#### Course Exists On Both Sides

Show a course conflict card with:

- course name and assessment flag;
- usernames/accounts involved;
- points, XP, response count, last activity;
- group memberships;
- assessment/result warning if applicable;
- "keep manual account data" / "keep LMS account data" selection.

On execute:

1. Keep the selected participation and all selected course-scoped rows.
2. Delete or archive the unselected duplicate participation rows for that course.
3. Move the selected rows to the primary participant if they were attached to the secondary participant.
4. Recompute course leaderboard, timeline, gamification, and analytics from kept rows.

Do not offer "combine best scores" or "sum both accounts" for gamified courses. That would let users inflate points by answering from two accounts. For non-gamified practice data, a later enhancement could offer per-activity merge, but the first version should be course-level and deterministic.

#### Assessment Course Conflict

Assessment overlap must not be self-service:

- If only one side has assessment identity/results, keep that side and link login methods only after verified re-auth.
- If both sides have assessment attempts/results in the same course, block automatic merge and create an admin/support review item.
- Never combine assessment responses or choose best scores.
- Keep both records until course/legal retention policy allows cleanup.
- Lecturer/admin review decides which participant record is official and how duplicate attempts are handled.

Assessment identity encryption stays course-scoped. Merge audit for assessment must avoid raw email; use participant ids, course id, and encrypted identity references.

### Table-Level Merge Notes

Rows that can usually be reassigned when no unique conflict exists:

- `ParticipantAccount` / future `ParticipantExternalIdentity`;
- `ParticipantInvitation.participantId`;
- `QuestionResponseDetail`;
- `Feedback`;
- `GroupMessage`;
- `ChatThread`;
- `PointCorrection.participantId` and many-to-many participant correction links when no assessment blocker exists.

Rows with uniqueness conflicts that need selected-side or recompute logic:

- `Participation @@unique([courseId, participantId])`;
- `QuestionResponse @@unique([participantId, elementInstanceId])`;
- `LiveQuizResponse @@unique([instanceId, elementBlockExecution, participantId])`;
- `LeaderboardEntry @@unique([type, participantId, courseId])` and `@@unique([type, participantId, liveQuizId])`;
- `ElementFeedback @@unique([participantId, elementInstanceId])`;
- `ParticipantAnalytics @@unique([type, courseId, participantId, timestamp])`;
- `ParticipantCourseAnalytics @@unique([courseId, participantId])`;
- `ParticipantPerformance @@unique([participantId, courseId])`;
- `ParticipantActivityPerformance @@unique([participantId, practiceQuizId])` / `@@unique([participantId, microLearningId])`;
- `ParticipantAchievementInstance @@unique([participantId, achievementId])`;
- `GroupAssignmentPoolEntry @@unique([courseId, participantId])`;
- `PushSubscription @@unique([participantId, courseId, endpoint])`;
- `ChatUsageCredits @@id([participantId, chatbotId])`.

Derived rows should be deleted and recomputed instead of merged where possible:

- participant analytics;
- course analytics;
- participant performance;
- activity performance;
- timeline summaries if recomputable from responses;
- leaderboard entries.

Source-of-truth rows should follow selected-side semantics:

- question responses;
- live quiz responses;
- applied point corrections through selected live quiz responses;
- assessment responses/results;
- group membership and clue assignments in conflict courses;
- manually submitted feedback/messages if the user chooses to discard the duplicate course side.

### Execution Strategy

Use a two-phase executor:

1. `previewParticipantMerge(primaryId, secondaryId)` builds a deterministic merge plan and row counts.
2. `executeParticipantMerge(planId, courseDecisions)` locks both participant ids, verifies the plan is still current, blocks new writes for both accounts, applies changes, invalidates caches, revokes secondary sessions, and issues a new primary token.

Implementation details:

- Use a stable lock order for participant ids to avoid deadlocks.
- Add a `MERGING` state or short-lived Redis/db lock so response writes cannot race with reassignment.
- Keep small merges in one transaction; large merges can use a job with checkpoints but must block both accounts until done.
- Mark affected courses `areAnalyticsValid=false`.
- Emit cache invalidations for participant, participation, leaderboard, and course views.
- Keep the secondary participant only as a tombstone if needed for audit or rollback, with no login methods and no email. Otherwise delete it after all rows move/delete.

### Privacy and Security Controls

- Require recent authentication for both accounts.
- Require explicit confirmation for every course conflict.
- Use short-lived, single-use link intents with CSRF/state binding.
- Rate-limit link and merge attempts.
- Show provider/course context, but do not show email for non-assessment accounts.
- Do not expose whether a username or LTI subject exists beyond authenticated flows.
- Log participant ids and event ids, not raw identifiers.
- Notify both active sessions after merge; for no-email accounts, use in-app notice/session banner.

### Implementation Slices

1. Add external identity schema that supports multiple LTI identities per participant.
2. Add account link intents and a "linked login methods" read model.
3. Implement identity-only linking for manual session plus fresh LTI launch.
4. Build merge planner dry-run with row counts and course overlap detection.
5. Implement no-overlap merge executor.
6. Implement same-course conflict UI and selected-side executor for non-assessment courses.
7. Add assessment conflict blocker/admin review workflow.
8. Add rebuild/invalidation jobs for analytics, leaderboards, gamification, and sessions.
9. Add browser/e2e tests for manual-to-LTI, LTI-to-manual, duplicate course conflict, and assessment blocker.

## Migration Plan

### Slice 0 - Inventory, Flags, and Policy

- Add login-method telemetry before choosing cutover dates:
  - record `password | magic_link | lti | eduid | passkey | recovery_code` for each participant login;
  - expose aggregate counts by active-in-last 6/12/24 months;
  - use at least four weeks of production data to size magic-link dependence.
- Add metrics script:
  - participants with `email`;
  - participants with `isEmailValid=false`;
  - participants with `ParticipantAccount.ssoEmail`;
  - participants in assessment courses missing any email source;
  - duplicate emails across `isSSOAccount`;
  - accounts with random-looking usernames from prior generation.
- Add flags:
  - `PARTICIPANT_PRIVACY_AUTH_ENABLED=false`;
  - `PARTICIPANT_LEGACY_EMAIL_LOGIN_ENABLED=true`;
  - `PARTICIPANT_LEGACY_EMAIL_LOGIN_UNTIL=<date>`.
- Define retention:
  - email challenges: 15-60 minutes;
  - legacy claim contacts: fixed cutover window;
  - assessment identity: course/legal retention.
- Add `ParticipantPrivacyMigrationState` or equivalent:
  - `participantId`;
  - `legacyEmailNoticeSentAt`;
  - `legacyEmailNoticeBouncedAt`;
  - `migrationPromptDismissedAt`;
  - `usernameConfirmedAt`;
  - `passkeyRegisteredAt`;
  - `recoveryCodesIssuedAt`;
  - `legacyEmailPurgedAt`;
  - `blockedUntilSetup` boolean for staged enforcement.

### Slice 1 - Schema Foundations

- Add `ParticipantEmailChallenge`, `ParticipantRecoveryFile`, `ParticipantRecoveryCode`, `ParticipantPasskeyCredential`, `ParticipantExternalIdentity`.
- Add `AssessmentParticipantIdentity`.
- Add encrypted/hash columns to `ParticipantInvitation`.
- Add crypto helper with key id, AES-GCM encrypt/decrypt, HMAC lookup hash, and tests.
- Define all referenced enums in Prisma and sync the schema mirror into `apps/analytics` with `pnpm run prisma:sync`.
- Audit `apps/analytics` for participant-email reads before adding new identity models.
- Do not remove old fields yet.

### Slice 2 - Stop New Non-Assessment Email Writes

- Make `Participant.password` nullable only if passkey-only accounts are approved for v1.
- Add null-safe password comparison in `loginParticipant`.
- Change `createParticipantAccount` mutation:
  - replace required email argument with challenge token;
  - create participant with `email=null`;
  - require user-chosen username;
  - issue recovery codes.
- Change `UpdateAccountInfoForm` and mutation:
  - remove email field for non-assessment participants;
  - keep password/profile/username only.
- Change login:
  - username/password only;
  - passkey entry point;
  - recovery-code reset flow.
- Regenerate GraphQL operations.

### Slice 3 - LTI Email Removal

- `apps/lti/src/index.ts`: remove `email` from signed LTI 1.3 JWT and `/info` unless explicitly in assessment debug/admin-only path.
- `apps/frontend-pwa/src/lib/getParticipantToken.ts`: update signed LTI data type to no email.
- `apps/frontend-pwa/src/pages/createAccount.tsx`: no LTI email prefill; no random username prefill for user-facing username.
- `packages/graphql/src/services/accounts.ts`:
  - resolve LTI by subject hash;
  - remove link-by-email logic for new launches;
  - create/link `ParticipantExternalIdentity`;
  - do not write `Participant.email` or `ParticipantAccount.ssoEmail`.
- Decide and implement LTI 1.1 validation/retirement.

### Slice 4 - Assessment Identity Encryption

- `apps/auth/src/lib/helpers.ts`:
  - create/link participant by Edu-ID subject hash;
  - no global email writes;
  - collect Edu-ID emails only in memory for invitation matching.
- `packages/graphql/src/services/participantInvitations.ts`:
  - import invitations to encrypted/hash columns;
  - match on HMAC lookup hash;
  - auto-accept without raw DB email.
- `packages/graphql/src/services/courses.ts` and assessment schema:
  - resolve assessment email by decrypting `AssessmentParticipantIdentity`;
  - fail closed for non-assessment courses.
- `packages/export/src/*`:
  - assessment exports decrypt through explicit PII access path;
  - non-assessment exports omit email.

### Slice 5 - Legacy Migration

Backfill:

1. For each assessment participation:
   - pick best source: `ParticipantAccount.ssoEmail` preferred, else `Participant.email` only if `isEmailValid=true`, else invitation email;
   - skip and flag participants where only an unverified `Participant.email` is available;
   - create `AssessmentParticipantIdentity`;
   - flag missing identity rows.
2. For each `ParticipantInvitation`:
   - encrypt email/matriculation;
   - populate lookup hashes.
3. For each `ParticipantAccount`:
   - create `ParticipantExternalIdentity` from raw `ssoId`;
   - leave old row for compatibility until reads switch.

Legacy claim window:

- Keep old `Participant.email` available only to a dedicated legacy login/claim flow.
- Existing unverified emails are risky, but current system already permits magic link to them. Use the legacy flow only for migration and show minimal account data before user confirms/rotates recovery.
- On successful legacy email magic link or password login:
  - require choosing a memorable username if generated/random-looking;
  - require passkey or recovery file;
  - set `Participant.email=null`;
  - clear `ParticipantAccount.ssoEmail` if no assessment identity needs it.
- Before cutover, optionally send one-time migration notices to stored emails. After cutover, purge unclaimed legacy emails.

Cutover:

- Disable legacy email login.
- Null all remaining non-assessment `Participant.email` and `ParticipantAccount.ssoEmail`.
- Keep encrypted assessment identity only for assessment participations.
- Drop old unique constraint and eventually drop columns in a later migration.

Clean migration runbook:

1. **Measure**: run inventory script in production read-only mode. Produce counts by auth type, course type, active in last 6/12/24 months, email-valid flag, LTI/Edu-ID/manual, and assessment participation.
2. **Shadow**: add new tables and start shadow-writing new identities/recovery state without changing login behavior.
3. **Backfill**: populate `ParticipantExternalIdentity`, `AssessmentParticipantIdentity`, and encrypted invitations. Keep old reads live.
4. **Compare**: run consistency reports:
   - LTI subject hash resolves same participant as old `ssoId`;
   - assessment decrypted identity matches legacy email source for sampled rows;
   - invitation hash matching accepts same users as raw email matching;
   - no new non-assessment account creation writes `Participant.email`.
5. **Canary**: enable privacy auth for internal/test courses and a small opt-in set of non-assessment courses.
6. **Notify**: send first legacy email notice and show in-app checklist on login.
7. **Require setup**: for active non-assessment manual accounts, require passkey or recovery-code setup before continuing after a grace period.
8. **Stop new email login**: hide email login for new accounts, keep legacy claim link in a separate "Recover old account" path.
9. **Purge eligible rows**: null legacy email fields for migrated accounts; preserve only encrypted assessment identity.
10. **Backup/cache alignment**: document database backup retention, wait until backup rotation exceeds the retention window before declaring raw-email purge complete, and audit Redis/caches for participant payloads.
11. **Final cutoff**: disable legacy email claim after the announced date, purge remaining non-assessment emails, and remove old code paths.

Rollback rule: until step 11, old email fields remain available behind feature flags, but no rollback should re-enable new non-assessment email writes.

### Slice 6 - Remove Non-Assessment Email Outputs

- Remove `email` from `LeaderboardEntry` for non-assessment contexts or always return null unless `course.isAssessmentEnabled`.
- Update manage leaderboard UI export/downloads.
- Update group assignment views and point correction participant pickers:
  - non-assessment uses username/avatar/id;
  - assessment uses decrypted assessment email.
- Add prize claim code workflow.
- Update i18n from "Username / E-mail" to "Username" or "Passkey".
- Update privacy/consent copy in English and German, including the current statement that course owners can see email addresses.
- Coordinate external privacy policy changes with the DPO and decide whether changed terms require re-consent on next login.

### Slice 7 - Cleanup and Hardening

- Remove `sendMagicLink` as general participant login.
- Remove `activateParticipantAccount` email-token semantics after challenge migration.
- Remove `isEmailValid` from active code.
- Add audit logs for assessment identity decrypt/export.
- Add admin script for key rotation.
- Update privacy policy/help docs.

## Existing Student Communication Plan

### Audiences

- **Manual non-assessment account, active**: needs action. They must set up passkey or recovery codes and confirm/choose a memorable username.
- **Manual non-assessment account, inactive**: send one notice if email exists; keep legacy claim until cutoff; purge after cutoff.
- **LTI-origin non-assessment account**: low action if they always enter through LTI. If they set a password, explain that recovery happens through LTI/passkey/recovery codes, not email.
- **Assessment participant**: explain exception clearly: assessment courses still store email because course staff need verified identity, but it is course-scoped and encrypted.
- **Lecturers**: explain non-assessment leaderboard email export removal and prize claim-code replacement.

### Channels

Use multiple channels because no single channel reaches everyone:

1. **One-time email to legacy stored email** before purging it. This is the only way to reach students who do not remember username and are not currently logged in.
2. **In-app migration checklist** on next login. This should be the authoritative setup flow.
3. **Login page "Recover old account" path** during grace period.
4. **Course/lecturer announcement template** for OLAT/LMS/course email.
5. **Assessment login banner** for assessment-specific identity explanation.

Do not rely on push notifications until push delivery is implemented and verified.

### Timeline Template

Use exact dates in production copy:

- Pick **T day** at a semester boundary, preferably early February or early September. Do not cut over in the middle of an active teaching or assessment period.
- **T-8 weeks**: first notice. Explain why email login is being removed, what actions are required, and cutoff date.
- **T-4 weeks**: second notice to accounts not migrated.
- **T-2 weeks**: in-app checklist becomes blocking for active manual accounts except "continue once" grace.
- **T day**: email login disabled except dedicated legacy claim endpoint if policy keeps short emergency extension.
- **T+4 weeks**: purge remaining non-assessment legacy emails.
- **T+8 weeks**: remove legacy claim endpoint and old email fields from active code.

### Student Copy - Short Email

Subject: `KlickerUZH account privacy update: action required`

Body:

```text
KlickerUZH is changing participant accounts so that non-assessment accounts no longer store email addresses.

What changes:
- Your email address will no longer be stored on your regular KlickerUZH participant account.
- Email login and email password reset will end on <DATE>.
- To keep access, sign in once before <DATE> and set up a passkey or download recovery codes.
- If you use KlickerUZH through OLAT/LTI, you can still access your account through OLAT/LTI.

Assessment courses are different: if a course uses assessment mode, KlickerUZH still needs your verified email for course administration. That email will be stored only for that assessment context and protected separately.

Open KlickerUZH: <LINK>
```

### Student Copy - In-App Checklist

Title: `Keep access to your account`

```text
We are removing stored email addresses from regular participant accounts.

Complete these steps:
1. Confirm your username.
2. Add a passkey or download recovery codes.
3. Save your changes.

After <DATE>, you cannot recover this regular account by email. Assessment courses may still use your verified email for assessment administration.
```

### Legacy Recovery Page Copy

Title: `Recover an old account`

```text
Use this page only if you created a KlickerUZH account before <DATE> and do not remember your username.

If an account exists for this email address, we will send a one-time link. After signing in, you must set up a passkey or recovery codes. KlickerUZH will then remove the email address from your regular participant account.
```

### Lecturer Copy

```text
KlickerUZH is reducing participant personal data in regular courses. Participant email addresses will no longer be stored or exported for non-assessment course leaderboards.

For prizes or follow-up, use the new claim-code workflow: select winners in KlickerUZH, send them an in-app instruction, and ask them to contact you with their claim code. Assessment courses are unaffected where verified identity is required.
```

### German Student Copy

Subject: `KlickerUZH-Datenschutzupdate: Handlung erforderlich`

Body:

```text
KlickerUZH passt Teilnehmendenkonten so an, dass bei regulären Konten keine E-Mail-Adressen mehr gespeichert werden.

Was ändert sich:
- Deine E-Mail-Adresse wird nicht mehr auf deinem regulären KlickerUZH-Teilnehmendenkonto gespeichert.
- E-Mail-Login und Passwort-Zurücksetzen per E-Mail enden am <DATE>.
- Damit du den Zugriff behältst, melde dich einmal vor dem <DATE> an und richte einen Passkey ein oder lade Wiederherstellungscodes herunter.
- Wenn du KlickerUZH über OLAT/LTI verwendest, kannst du weiterhin über OLAT/LTI auf dein Konto zugreifen.

Prüfungskurse sind anders: Wenn ein Kurs den Prüfungsmodus verwendet, benötigt KlickerUZH weiterhin deine verifizierte E-Mail-Adresse für die Kursadministration. Diese E-Mail-Adresse wird nur für diesen Prüfungskontext gespeichert und separat geschützt.

KlickerUZH öffnen: <LINK>
```

In-app checklist:

```text
Wir entfernen gespeicherte E-Mail-Adressen aus regulären Teilnehmendenkonten.

Schliesse diese Schritte ab:
1. Bestätige deinen Benutzernamen.
2. Richte einen Passkey ein oder lade Wiederherstellungscodes herunter.
3. Speichere deine Änderungen.

Nach dem <DATE> kannst du dieses reguläre Konto nicht mehr per E-Mail wiederherstellen. Prüfungskurse können deine verifizierte E-Mail-Adresse weiterhin für die Prüfungsadministration verwenden.
```

Legacy recovery page:

```text
Verwende diese Seite nur, wenn du vor dem <DATE> ein KlickerUZH-Konto erstellt hast und deinen Benutzernamen nicht mehr weisst.

Falls ein Konto für diese E-Mail-Adresse existiert, senden wir dir einen einmaligen Link. Nach der Anmeldung musst du einen Passkey oder Wiederherstellungscodes einrichten. Danach entfernt KlickerUZH die E-Mail-Adresse aus deinem regulären Teilnehmendenkonto.
```

## Verification Plan

### Unit / Service

- Crypto helper: decrypt roundtrip, wrong key/tag failure, HMAC stability by key id.
- Challenge flow: no raw email persisted, token single-use, expiry enforced, enumeration-safe responses.
- Recovery codes: single-use, hashed storage, reset rotates/invalidates as designed.
- LTI: signed token no email, subject hash matches same launch and differs by issuer/client/deployment.
- Assessment invitation matching: same normalized email matches via hash; no raw email selected in Prisma queries outside encryption module.

### Integration

- Manual signup creates participant with `email=null`.
- Manual login cannot use email.
- Password reset succeeds with recovery code and passkey; fails with email alone.
- LTI login creates/links participant with no email or ssoEmail.
- LTI password reset requires fresh LTI session or recovery code.
- Assessment Edu-ID login creates encrypted assessment identity and no global email.
- Assessment result views still show authorized emails.
- Non-assessment leaderboard API/export returns no emails.

### Browser / E2E

- PWA signup/login/recovery in non-assessment mode.
- LTI launch to non-assessment course through local verifier.
- Assessment login through auth app and assessment PWA.
- Lecturer assessment roster/results export.
- Lecturer non-assessment leaderboard and prize claim code flow.
- Update Cypress and Playwright login/account specs in the same slice that changes login behavior.
- Update `packages/prisma-data` seeds in the same slice that removes seeded participant emails or email-login assumptions.

Use `npx agent-browser` for UI validation per repo rules.

### Data Safety

- Pre-migration dry run counts.
- Backfill dry run with sample encrypted identity counts.
- Rollback path: old columns remain until final cleanup.
- Post-migration DB assertion:
  - no non-assessment participant has `Participant.email`;
  - no non-assessment account has `ssoEmail`;
  - all assessment participations that require identity have `AssessmentParticipantIdentity`;
  - raw email columns are unused or dropped.

## Risks and Decisions

### Open Decision Table

These decisions must be closed with product owner / DPO input before behavior-changing implementation starts:

| Decision | Data Needed | Recommendation | Owner | Status |
| --- | --- | --- | --- | --- |
| LTI 1.1 verification vs retirement | Count active `ParticipantAccount.ssoType` values and last-login usage over 12 months | Retire LTI 1.1 if usage is negligible; otherwise implement signature validation before email removal | Product + Engineering | Open |
| Recovery setup timing | Four weeks of login-method telemetry and signup funnel drop-off | Defer recovery setup during running live activities; require it on next non-live login or after grace period | Product | Open |
| Cutover date and grace windows | Semester calendar, assessment windows, login-method telemetry | Use a semester boundary; avoid mid-semester and assessment windows | Product + Support | Open |
| Privacy policy and re-consent | DPO review of changed data categories and retention | Update policy before first notice; re-consent if DPO requires it | DPO + Product | Open |
| `ParticipantAccount` migration shape | Count references and code paths depending on `ParticipantAccount` | Keep facade during migration, remove in cleanup slice | Engineering | Open |
| Retention durations | Legal/DPO input for assessment identity, challenges, claim contacts, backups | Replace placeholder ranges with concrete values before rollout | DPO + Product | Open |

### Decision: Email Reset Without Storing Email

Email-only reset is incompatible with "email not saved" because the service cannot know which account the mailbox should recover. Recommended decision: do not offer email-only reset for non-assessment participants. Use passkeys, recovery files/codes, active sessions, or fresh LTI.

### Decision: Existing Unverified Emails

Existing unverified emails are already used for magic-link login. For migration, keep that behavior only in a time-boxed legacy claim flow. Do not keep unverified emails indefinitely.

### Decision: Username

Do not prefill random usernames for manual accounts. If an account has LTI/passkey-only login, a generated internal username is acceptable only as an internal/display placeholder, not as the expected recovery handle. Prompt for a user-chosen public username when needed.

### Risk: Hashes Are Still Personal Data in Assessment

Assessment lookup hashes are derived from email and must be treated as personal data. Keep them course-scoped, keyed, and access-controlled. Rotate keys with a planned rehash job.

### Risk: Cross-Course Linkability

Global participant ids still link behavior across courses. If "anonymous" later means unlinkability across courses, this plan is not enough; that would require per-course participant identities or a privacy-preserving account/participation split.

### Risk: LTI Subject Quality

If an LTI platform sends stable subjects across contexts, Klicker can link a participant across LTI courses. If per-course unlinkability is desired, include context/course in the subject hash. That would trade off account continuity.

## First Implementation PR

Recommended first PR:

1. Add login-method telemetry for password, magic link, LTI, Edu-ID, passkey, and recovery-code paths.
2. Add inventory script and dry-run report.
3. Add crypto helper with tests for AES-GCM, lookup HMACs, and key ids.
4. Add schema foundations behind flags after telemetry is available.
5. No user-facing behavior change yet.

This gives a safe foundation and real data counts before touching user-facing login.
