---
type: Solution
title: Prevent duplicate Chat turn charges across assistant IDs
description: Make one normal user turn claimable once while preserving intentional reload branches.
module: chat
date: 2026-09-01
problem_type: data
severity: high
symptoms:
  - 'Concurrent requests for one user turn could both reach the model provider.'
  - 'Different client-generated assistant IDs bypassed ID-only duplicate protection.'
  - 'Both completed answers could increment account usage for the same turn.'
root_cause: 'Writer-off claims created no durable marker, and finalization deduplicated only the client assistant message ID.'
tags:
  - chat
  - account-usage
  - idempotency
  - concurrency
  - postgres
---

# Chat turns charged twice when concurrent requests used different IDs

## Problem

The Chat client generates a new assistant message ID for each request. The
initial writer-off lifecycle path validated the thread and then let provider
work start without recording a claim. Its completed-message insert could
deduplicate retries that reused the same assistant ID, but it could not
deduplicate two requests for one user message that chose different IDs.

## Symptoms

Two overlapping requests for one user message could both call the provider and
stream different answers. If both completed, each assistant row was distinct,
so each completion could charge the owner's usage account. The issue was a
data-integrity failure even though the participant-facing history could show
two answers rather than an obvious error.

## What Didn't Work

Using the client assistant ID as the only idempotency key was insufficient: the
client intentionally generates a fresh ID for every request. Making
`parentId` globally unique would also break intentional conversation branches,
including reloads. Keeping only an in-memory lock would not coordinate multiple
Chat instances or survive a process restart.

## Solution

`claimChatTurn` creates a durable `IN_PROGRESS` assistant marker before
provider work. In R1 the marker keeps a null lifecycle attempt token, so the
existing complete-only history readers do not expose it; failed and empty R1
attempts remove it. A PostgreSQL transaction advisory lock keyed by the thread
and user-message parent serializes normal claims. A completed or in-progress
sibling therefore blocks a second normal provider attempt.

`finalizeChatTurn` completes the claimed marker, applies the account-usage
mutation, and debits participant credits in one transaction. A participant
credit failure therefore rolls back the completed message and owner charge,
and a duplicate finalization returns the stored amount without debiting again.
R2 attempt tokens remain available for reclaim and late-callback protection. A
failed sibling's old attempt token is invalidated before a different normal
retry can claim the parent. The reload path in `useThreadManagement.onReload`
opts into an explicit regeneration branch, so intentional sibling answers
remain possible. No migration is required because the existing `ChatMessage`
lifecycle columns already store the marker and attempt token.

## Why This Works

The claim lock covers the decision that determines whether provider work may
start, not only the later database write. The marker survives the short claim
transaction and is visible to the finalizer, while complete-only readers keep
the empty intermediate state out of participant history. The charging boundary
therefore has one normal winner, while explicit regeneration remains a clear
separate user action.

## Prevention

- Keep the Chat history and thread-list readers restricted to
  `lifecycleStatus: 'COMPLETED'` while hidden markers are enabled.
- Treat pre-lifecycle unfiltered readers as incompatible with the R1 rollout;
  prove every Chat pod uses the complete-only reader before activation.
- Retain PostgreSQL integration coverage for concurrent distinct-ID claims,
  duplicate finalization, failed retries, stale callbacks, empty completion,
  explicit regeneration, and one-time participant credit debiting.
- Do not replace the parent-scoped claim with a global parent uniqueness rule;
  reload and edit branches intentionally create sibling answers.
