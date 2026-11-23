---
type: Solution
title: Lecturer approval links for lecture video sources
description: How a lecture video source gets approved per semester through emailed per-recipient links that grant for 14 days and revoke forever, with edu-ID identity, admin final approval and a hash-chained audit log.
module: graphql
date: 2026-11-23
problem_type: integration
severity: high
tags:
  - video-ingestion
  - kaltura
  - approval
  - audit
  - personal-data
---

# Lecturer approval links for lecture video sources

## Context

Lecture recordings reach course chatbots from SWITCH Kaltura through a token
that can read every UZH recording. Kaltura does not limit it to approved
courses, so Klicker must prove that each processed recording was in scope and
approved. A `KBVideoSource` binds one admin-confirmed Kaltura category (with a
cut mode) and a courses.uzh.ch link to a knowledge base. Nothing is fetched for
a source until it is approved for the current semester.

Code: `packages/graphql/src/services/videoSourceApproval.ts` (database flow),
`videoSourceApprovalCore.ts` (pure rules), `packages/prisma/src/prisma/schema/videoSource.prisma`,
`apps/frontend-manage/src/pages/video-approval.tsx`, email templates
`VideoSourceApprovalRequested` and `VideoSourceApprovalGranted` in
`packages/transactional`.

## Flow

1. An admin creates the source (`createVideoSource`) after confirming the
   resolved category against sample entries.
2. `requestVideoSourceApproval` takes a fresh catalogue snapshot for the
   semester (`getModuleContacts`, see
   [uzh-course-catalog-contacts.md](uzh-course-catalog-contacts.md)), stores it
   with its SHA-256, and emails every RESPONSIBLE or LECTURER contact with an
   address their own link. The requester's name and email are copied onto the
   request and shown in the email and on the page.
3. The link opens `/video-approval?token=…` in Manage. The lecturer signs in;
   approving and revoking need an edu-ID account (`Account.provider` equal to
   `NEXT_PUBLIC_EDUID_ID`). A signed-in email that differs from the
   recipient's catalogue email is recorded as `identityMatched = false`, not
   blocked, because edu-ID often carries a private address.
4. The first approval moves the request to `APPROVED`; other recipients get a
   notice and their links can no longer approve.
5. `adminApproveVideoSourceRequest` makes the request `ACTIVE` and sets the
   source to `APPROVED` with `validUntil` = semester end. The gateway may act
   only while `isVideoSourceApprovedAt(source, now)` holds.

## Link semantics

- Token: 32 random bytes (base64url), only in the email; the database stores
  `sha256(token)` (`KBVideoApprovalRecipient.tokenSha256`). Unknown and
  malformed tokens get the same error.
- Grant window: 14 days from sending (`grantExpiresAt`). After it, the link
  can still decline.
- Revoke: possible while the request is `OPEN`, `APPROVED` or `ACTIVE`,
  including after the grant window and after the semester ended. Revoking is
  final; a new approval needs a new request.
- A new request supersedes `OPEN` and `APPROVED` requests of the source. A
  superseded link forwards to the same person's place in the newest request,
  for revoking only.
- Revoking the request a source runs on sets the source to `REVOKED` at once
  and appends `REVOCATION_PURGE_REQUESTED`. The discovery worker must remove
  everything ingested under that request; recordings therefore need to record
  the request they were ingested under.

## Audit log

`KBVideoAuditEvent` is append-only: a trigger rejects `UPDATE` and `DELETE`,
and each row stores `sha256(prevHash + canonical JSON of the row)`.
`appendVideoAuditEvent` takes a transaction-scoped advisory lock so the chain
has one order; `findAuditChainBreak` verifies it. Decisions are also kept in
`KBVideoApprovalDecision` with edu-ID subject, consent version and consent
text hash.

## Operations

- Email templates live in the `EmailTemplate` table. After deploying, run the
  transactional `update-templates` script for the target environment, or the
  request fails to send (the request row and audit entry still exist and the
  result lists the unsent recipients).
- The calling service needs egress to `studentservices.uzh.ch`.
- Local stacks set `VIDEO_APPROVAL_ALLOW_NON_EDUID=true` because delegated
  logins have no edu-ID. Never set it in staging or production.
- Changing `VIDEO_APPROVAL_CONSENT_TEXT` requires a new
  `VIDEO_APPROVAL_CONSENT_VERSION`; open pages then refuse to approve until
  reloaded.
