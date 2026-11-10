---
type: Decision Record
title: Regeneration inputs live in the database
description: Each element generation build keeps a slot specification per slot in PostgreSQL so a slot can be reworked after blob artifacts are purged.
timestamp: '2026-11-09'
tags:
  - backend
  - knowledge-base
---

# 57. Regeneration inputs live in the database

Status: Proposed (2026-11-09)

A revision request reworks one slot of an element generation build, possibly
long after the build ran. The build's working files (start manifest, design,
plan, bank and the pinned graph bundle) live on blob storage and are purged
with the knowledge base, so a revision that depends on them fails exactly when
it is most likely to be needed. We therefore store a self-contained slot
specification for each slot with its build when the build completes:
the slot's design entry with its graph selection as ids, and the text of the
evidence the question cites. A revision is a one-slot child build that starts from the slot
specification, the previous question and the lecturer's note; blob artifacts
are a cache that may refresh evidence while it exists. Evidence text follows
its knowledge base: deleting or purging the knowledge base removes it, and a
later revision proceeds without fresh evidence. Builds that predate this
record are backfilled while their files exist and otherwise revised from the
stored slot summary.

## Considered options

- Keep blob artifacts as the source and refuse revision after a purge:
  rejected because revision would become unreliable over a semester.
- Keep evidence text for the lifetime of the build: rejected because deleting
  a knowledge base must still delete its course material text.

## Consequences

- The kg worker gains a slot-revision entry point that starts from a slot
  specification instead of the build's start manifest, and emits slot
  specifications with each completed build.
- The kg pool store records the same slot specification per slot with its
  generation builds, so its drafts can be reworked without uncommitted run
  folders.
