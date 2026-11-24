---
type: Solution
title: Lecturer approval links for lecture video sources
description: How a lecture video source gets approved per teaching period through emailed per-recipient links that grant for 14 days and revoke forever, with edu-ID identity, admin final approval and a hash-chained audit log.
module: graphql
date: 2026-11-24
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
that can read every recording of the institution. Kaltura does not limit it
to approved courses, so Klicker must prove that each processed recording was
in scope and approved. A `KBVideoSource` binds one admin-confirmed Kaltura
category (with a cut mode), the recordings link and a course directory link
to a knowledge base. Nothing is fetched for a source until it is approved for
a period.

Klicker is institution-neutral. Everything institution-specific (which links
are valid, what kind they are, the course directory, the periods, who
approves, which recording collection belongs to a course run) comes from a
course-sources provider over HTTP. The contract is
`packages/graphql/src/services/courseSources.CONTRACT.md`; the client is
`courseSources.ts` (`COURSE_SOURCES_URL`, bearer `COURSE_SOURCES_TOKEN`). The
UZH provider runs outside this repository. Klicker never holds the Kaltura
token and never calls the ingestion gateway for lookups: the provider does,
and the gateway audits each Kaltura call. Klicker appends
`KALTURA_LOOKUP_REQUESTED` with the actor and the links before every
`resolve`.

Without a configured provider the flow still works by hand: the source kind
is `MANUAL`, and the admin enters the course title, the period label and end,
the recipients and the category id.

Code: `packages/graphql/src/services/videoSourceApproval.ts` (database flow),
`videoSourceApprovalCore.ts` (pure rules), `courseSources.ts` (provider
client), `packages/prisma/src/prisma/schema/videoSource.prisma`,
`apps/frontend-manage/src/components/admin/VideoSourceSetup.tsx`,
`apps/frontend-manage/src/pages/video-approval.tsx`, email templates
`VideoSourceApprovalRequested` and `VideoSourceApprovalGranted` in
`packages/transactional`.

## Flow

1. An admin opens Admin > Lecture video sources in Manage and pastes the
   recordings link and the course directory link. With a provider, Look up
   calls `resolveVideoSource`, which asks the provider's `resolve`: the link
   kind, the period, the directory entry with the recipients who will be
   emailed, and the candidate collections with entry counts, recordings in
   the period, sample names and one proposal. Each half carries its own error.
   The admin confirms a category against the samples and creates the source
   (`createVideoSource`). That calls the provider's `source-link`, stores the
   returned kind and reference, and rejects a category id that differs from a
   non-null `fixedCollectionId` (a channel link names its category).
2. `requestVideoSourceApproval` calls the provider's `directory` at request
   time, stores the snapshot with its SHA-256 plus the course title, short
   name, canonical link, period label and period end on the request, and
   emails every listed recipient their own link. Excluding or adding
   recipients needs a reason. Without a provider the admin's recipients are
   the list. The requester's name and email are copied onto the request and
   shown in the email and on the page.
3. The link opens `/video-approval?token=…` in Manage. The lecturer signs in;
   approving and revoking need an edu-ID account (`Account.provider` equal to
   `NEXT_PUBLIC_EDUID_ID`). A signed-in email that differs from the
   recipient's directory email is recorded as `identityMatched = false`, not
   blocked, because edu-ID often carries a private address.
4. The first approval moves the request to `APPROVED`; other recipients get a
   notice and their links can no longer approve.
5. `adminApproveVideoSourceRequest` makes the request `ACTIVE` and sets the
   source to `APPROVED` with `validUntil` = the request's period end. The
   gateway may act only while `isVideoSourceApprovedAt(source, now)` holds.

## Link semantics

- Token: 32 random bytes (base64url), only in the email; the database stores
  `sha256(token)` (`KBVideoApprovalRecipient.tokenSha256`). Unknown and
  malformed tokens get the same error.
- Grant window: 14 days from sending (`grantExpiresAt`). After it, the link
  can still decline.
- Revoke: possible while the request is `OPEN`, `APPROVED` or `ACTIVE`,
  including after the grant window and after the period ended. Revoking is
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
- The backend needs egress to the course-sources provider only
  (`COURSE_SOURCES_URL`, `COURSE_SOURCES_TOKEN`). Provider errors with HTTP
  422 are shown to the admin as written; other failures show a generic
  message. Without the two variables the admin page switches to manual entry.
- Local stacks set `VIDEO_APPROVAL_ALLOW_NON_EDUID=true` because delegated
  logins have no edu-ID. Never set it in staging or production.
- Changing `VIDEO_APPROVAL_CONSENT_TEXT` requires a new
  `VIDEO_APPROVAL_CONSENT_VERSION`; open pages then refuse to approve until
  reloaded.
