---
type: Change Log
title: Biome Tier 1 Review Fixes
description: Follow-up fixes for behavior regressions and identity issues found by the integrated Biome Tier 1 review.
timestamp: '2026-08-10'
tags:
  - ci
  - graphql
  - accessibility
---

## 2026-08-10

**Update**

- Keep evaluation chart selection stable after a user changes it; reset only when the active evaluation instance or element type changes.
- Restore the chat thread synchronization retry trigger and prevent nested catalog controls from activating their parent rows on keyboard events.
- Give leaderboard profile pagination controls translated accessible names and pressed state.
- Add the source `activityId` to analytics `ActivityProgress` so frontend list keys do not depend on non-unique display names.
- The integrated review also confirmed that browser validation remains blocked by the environment-only DevPod TLS readiness failure recorded in the Biome Tier 1 plan.
