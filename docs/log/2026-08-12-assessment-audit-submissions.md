---
type: Change Log
title: Assessment audit submission materialization
description: Stable submission receipts, Hatchet-derived evidence, and atomic response scoring.
timestamp: '2026-08-12'
tags:
  - audit
  - assessment
  - hatchet
---

# Assessment audit submission materialization

Layer 5 connects assessment participant submissions to the provider-neutral
evidence outbox. The PWA now sends one stable UUID per submit action and retries
the same action with that ID. The response API validates participant and quiz
scope, awaits the existing Hatchet command receipt, returns its event ID, and
uses a retryable `503` instead of acknowledging a failed push.

The response processor resolves the real triggering Hatchet event, materializes
accepted/validated/terminal evidence, and commits persisted/scored evidence in
the same transaction as `LiveQuizResponse`. An optional unique
`LiveQuizResponse.submissionId` makes command retries and duplicate transports
unambiguous. Transient failures and later recovery are append-only. The legacy
free-form `create-audit-log-entry` task and its remaining call sites are gone.
Uncovered quizzes skip the audit-provenance lookup and keep the prior teaching
path. A composite outbox index keeps per-submission correlation bounded as a
quiz's evidence history grows.

Focused Response API and processor Vitest suites cover receipt semantics,
sensitive-log exclusion, all supported validation families, transactional
response/evidence persistence, late and missing-participation rejection,
changed-answer submission-ID reuse, retries and recovery, duplicate commands,
rollback, terminal cardinality, and append-sink outage/backlog drain. The
production-like assessment-browser, staging Azure export/conformance, and
2,000-submissions-per-minute RSS/SLO checks remain explicit draft exit gates;
the local tests do not claim those operational results.
