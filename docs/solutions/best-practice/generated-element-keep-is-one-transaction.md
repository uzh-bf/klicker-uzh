---
type: Solution
title: Keep Generated Elements in One Transaction
description: Persist the reviewed draft and ordinary Element together so retries cannot duplicate or lose lecturer edits.
module: element-generation
date: 2026-08-29
problem_type: best_practice
severity: medium
symptoms:
  - 'The review UI must update a generated draft, accept it, and create an Element'
  - 'A network failure between separate mutations can lose edits or create duplicates'
root_cause: 'A workflow draft and an ordinary Element have different lifecycles, but Keep is one lecturer intent'
tags:
  - knowledge-base
  - element-generation
  - transactions
  - idempotency
---

# Keep Generated Elements in One Transaction

## Problem

The generated-element review screen originally exposed three separate steps: save draft edits, accept the draft, and save all accepted drafts as Elements. A lecturer understood **Keep** as one action, but a connection failure between those mutations could leave an accepted draft without its edited Element or invite a duplicate retry.

## Solution

Treat Keep as one server transaction. Send the draft revision and the visible canonical Element editor payload together. Under the build lock, verify ownership, terminal workflow state, unchanged element type, and the expected revision. Then validate the draft representation, create exactly one ordinary Element, and update the draft with the edited payload, `ACCEPTED` decision, `savedElementId`, and the next revision.

A retry carrying the consumed revision returns the existing linked draft without creating another Element. Any other stale revision fails. The old build-wide save remains only for accepted-but-unsaved rows created by the earlier two-step flow.

## Why This Works

The transaction makes the database reflect one user intent: either both the Element and draft link commit, or neither does. The revision protects concurrent edits, the build lock serializes persistence for the build, and the linked Element id provides a durable retry fence.

## Prevention

When one UI action changes a workflow ledger and creates a durable domain object, do not expose the intermediate workflow decision as the primary persistence path. Keep the user-facing action atomic and reserve batch repair endpoints for legacy recovery.
