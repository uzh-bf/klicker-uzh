---
type: Change Log
title: Assessment identity boundary and public credential projection
description: Record the agreed course-scoped identity boundary for assessment participants and the minimized public verification projection.
timestamp: '2026-08-20'
tags:
  - assessment
  - auth
  - privacy
---

## 2026-08-20

- **Creation:** Added [assessment identity context](../../CONTEXT.md) defining
  assessment participation identity, invitation roster identity, and public
  credential verification.
- **Creation:** Added [ADR 0008](../adr/0008-assessment-identity-boundary-and-public-projection.md)
  for course-scoped storage, export use, immutable credential versions, and the
  public full-name-only projection.
- **Update:** Recorded the approved edu-ID release attributes and kept linked
  affiliation claims outside this feature's assessment-participation identity
  because no current assessment consumer needs them.
