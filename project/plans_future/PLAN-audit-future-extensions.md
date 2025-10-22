# Audit Logging – Future Extensions (Assessment Context)

This document lists pragmatic next steps and larger ideas beyond the current, sufficient assessment baseline. It focuses on assessment-only context and avoids conflating non-assessment flows.

## 1) Manual Invitation Lifecycle
- Manual accept/revoke in management UI/API
  - Actions: `PARTICIPANT_INVITATION_ACCEPTED`, `PARTICIPANT_INVITATION_FAILED` (reason: revoked, expired), optional `participant.invitation.revoked`
  - Subject: `user:{adminId}` and/or `participant:{id}` when known
  - Attributes: `courseId`, `invitationId`, `method: 'manual'`, `reason`, `ip`, `userAgent`
- Bulk operations
  - Import/export mutations emit per-row auditing with aggregate summaries
  - Consider correlationId for batch linkage

## 2) Content Authoring (Assessment Quizzes)
- Elements/Blocks Create/Update/Delete
  - Emit internal actions on assessment-enabled quizzes only
  - Attributes: minimal diffs (e.g., `choicesChanged`, `solutionToggled`, `timeLimitChanged`), counts (before/after), affected IDs
  - Avoid large payloads; do not include full content
- Template & Catalog actions
  - `quiz.template.applied`, `quiz.duplicated`, `quiz.imported`
  - Attributes: templateId, source quiz, item counts

## 3) Session and Access Context
- Live session join/leave (internal)
  - For assessment: capture lecturer-side start/stop and aggregate participant counts
  - Keep student public telemetry as-is to avoid volume spikes
- Extended PIN telemetry (optional)
  - Reason codes: quiz not published, throttled attempts, blocked IP

## 4) Privacy & Redaction
- Response previews
  - Replace preview with hashed summaries for high-stakes exams (configurable)
  - Keep length/diff-only metrics for integrity monitoring
- PII minimization
  - Hash emails/IP when not operationally required; consistently use `hashSensitiveData`

## 5) Performance & Volume Control
- Throttle autosave updates more aggressively per instance (e.g., 1 event/minute when unchanged)
- Enforce attribute size caps at hook boundaries; early-drop oversize fields
- Optional sampling for `CLIENT_ERROR` bursts

## 6) Reliability
- Buffered fire-and-forget in Auth/PWA (bounded in-memory queue)
- Retry/backoff with jitter; short circuit when audit unavailable
- Correlation IDs across critical paths (start quiz -> block -> responses)

## 7) Observability & Ops
- Dashboards/queries
  - Lecturer control timeline per quiz
  - PIN failure rates; client error trends; invitation flows (accepted/failed)
- Alerting
  - Elevated `CLIENT_ERROR` rate, PIN spike, ingestion failures

## 8) Testing & Rollout
- E2E coverage for manual invitations and content edits
- Staging shadow traffic validation with counters for dropped/oversize events
- Gradual feature flags for redaction/sampling knobs

## 9) Data Retention & Governance
- Define TTLs per action category (e.g., errors shorter than control events)
- Periodic compaction/archival jobs

## Notes
- Keep assessment scope strict: success login events remain EduID-only via Auth.
- Revisit public allow-list if new public events are introduced; prefer internal for most authoring actions.
