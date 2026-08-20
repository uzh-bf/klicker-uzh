---
type: Triage Labels
title: Triage Labels
description: Maps the five canonical triage roles the skills speak in to the label strings that exist on this repo.
timestamp: '2026-07-31'
tags:
  - agents
  - process
---

# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

All five exist on `uzh-bf/klicker-uzh`. `wontfix` predates this setup and is reused rather than duplicated; the other four were created for it.

The repo also carries `wayfinder:map` and `wayfinder:research` / `prototype` / `grilling` / `task`, which are not triage roles — see `issue-tracker.md`.

Edit the right-hand column to match whatever vocabulary you actually use.
