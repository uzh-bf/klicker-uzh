---
type: Decision Record
title: Catalyst imports the complete graph-runtime history
description: Preserve Patrick's authorship and visualizations before refactoring the graph runtime.
timestamp: '2026-08-10'
tags:
  - backend
  - knowledge-base
---

# 4. Catalyst imports the complete graph-runtime history

Status: Superseded by ADR 0008 (2026-08-10)

The empty Catalyst repository starts by importing the complete
`kg-content-generation` Git history after that history passes a secrets and
private-data audit. The migration preserves commit authors, dates, ancestry,
and Patrick's visualizations. Production-oriented refactoring happens only in
new Catalyst commits after the import; the migration is not a clean snapshot
or a squashed rewrite.

This keeps attribution and design context inspectable and makes a later GitHub
to GitLab move portable. It accepts inherited research history and the need for
later cleanup. The source repository and its current branch remain intact until
Catalyst proves the expected history and files are reachable.
