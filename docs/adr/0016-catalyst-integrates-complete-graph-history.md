---
type: Decision Record
title: Catalyst integrates the complete graph-runtime history
description: Preserve the existing Catalyst stack and Patrick's graph history before refactoring.
timestamp: '2026-08-15'
tags:
  - backend
  - knowledge-base
---

# 16. Catalyst integrates the complete graph-runtime history

Status: Accepted (2026-08-10)

Catalyst pull requests 2 and 3 have been merged, and `main` contains later
merged work as well. The graph-runtime migration therefore starts from the
latest fetched Catalyst `main` and integrates the complete
`kg-content-generation` Git history without squashing or rewriting either
ancestry. It is delivered as an ordinary pull request; no native stack
relationship is required. Whether that pull request needs an internal split is
decided only after the W1 history inventory and size review. Patrick's
authorship, dates, and graph assets remain reachable. Production-oriented
refactoring happens only in later Catalyst commits.

This preserves provenance on both sides and avoids replacing the active
Catalyst `main` with a clean graph snapshot. It requires an explicit integration
commit and may carry research history that later refactoring removes from the
working tree. The source repository and selected Catalyst base remain intact
until history and file coverage are verified.
