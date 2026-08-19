---
type: Change Log
title: Assessment results gate no longer depends on the leaderboard opt-in
description: Decouple assessment course access and report issuance from the course-leaderboard participation flag.
timestamp: '2026-08-19'
tags:
  - backend
  - graphql
  - assessment
---

## 2026-08-19

- **Fix:** Participant access to assessment course results
  (`getStudentAssessmentResults`) and assessment report issuance
  (`buildAssessmentReportSnapshotV1`) no longer require
  `Participation.isActive`. Both gates now rely on the accepted course
  invitation plus an active participant account. The leaderboard opt-in flag
  keeps its original meaning and is untouched elsewhere.
- **Fix:** `calculateAssessmentCourseScores` no longer filters by
  `participantScope`; report snapshots and the lecturer overview now score
  all course participants consistently.
- **Docs:** `docs/domain-model.md` now states explicitly that
  `Participation.isActive` is the leaderboard opt-in, not an enrollment
  flag, and that assessment access is invitation-backed.
