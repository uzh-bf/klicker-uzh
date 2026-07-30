---
type: Architecture Decision
title: Purge pre-control learning analytics results
description: Establish a clean optional-LA boundary by deleting only dedicated derived results created before the controls.
timestamp: '2026-07-30'
tags:
  - analytics
  - privacy
---

# ADR 0003: Purge pre-control learning analytics results

## Status

Accepted

## Context

Dedicated learning-analytics results created before the course and participant controls cannot be proven to satisfy the new eligibility boundaries. Keeping or attempting to classify those derived rows would risk exposing results computed from students who never received the new choice.

## Decision

Before enabling the rollout, run a one-time guarded cleanup that deletes every dedicated learning-analytics result row and preserves normal course, participation, response, feedback, grading, gamification, and research-consent data. The cleanup is dry-run by default, binds write approval to the hash of the aggregate-only snapshot and exact cleanup contract, verifies operational counts inside one serialized transaction, and writes a durable replay-blocking database receipt in that transaction.

## Consequences

Historical dashboards must be recomputed under the new controls where permitted. The deletion is irreversible, so production execution requires separate operational approval after the reviewed dry run; the application rollout remains disabled until the cleanup and recorded UZH legal approval are complete.
