---
type: Change Log
title: Course Duplication Async Status
description: Notes on the Redis-backed course duplication job id and frontend polling flow.
timestamp: '2026-08-20'
tags:
  - backend
  - frontend
  - hatchet
  - redis
---

# Course Duplication Async Status

Large course duplications no longer need the browser request to stay open until the full transaction finishes. The manage frontend starts duplication with `startCourseDuplication`, receives a job id, stores that id in `localStorage`, and polls `courseDuplicationStatuses` every few seconds. Active jobs are shown in the course-duplication notification dropdown; completed jobs trigger a success toast, refresh the course list, and navigate to the copied course.

The backend stores job state in Redis with a 24-hour TTL and uses a per-user/source-course lock to avoid duplicate submissions for the same source course. The Hatchet general worker processes `process-course-duplication` with retries disabled, calls the existing atomic `duplicateCourse` implementation, then marks the job `COMPLETED` or `FAILED`. Polling also marks non-terminal jobs as failed after the stale timeout so abandoned jobs disappear from the frontend instead of lingering forever.
