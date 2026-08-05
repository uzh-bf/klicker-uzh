---
type: Agent Configuration
title: Work Tracking
description: ClickUp task tracking and repository planning-artifact conventions for engineering skills.
timestamp: '2026-08-05'
tags:
  - agents
  - workflow
  - planning
---

# Work tracking: ClickUp and repository plans

## Source of truth

ClickUp is the source of truth for tasks, ownership, priority, and workflow status. GitHub Issues are not actively used.

When available, connect branches, pull requests, and repository plans to their corresponding ClickUp task.

## Repository planning artifacts

Implementation plans and supporting artifacts are committed under `project/`:

- Active plans: `project/plans_wip/PLAN-<slug>.md`
- Future or deferred plans: `project/plans_future/`
- Historical or completed plans: `project/plans_archive/`
- Reviews, research, handoffs, and related artifacts: use the appropriate existing location under `project/`

The engineering wiki under `docs/` contains durable facts about the codebase. Do not use `project/` plans as a replacement for updating affected wiki pages when behavior changes.

## When a skill says “publish to the issue tracker”

Create or update the corresponding ClickUp task. Do not create a GitHub issue as a fallback.

If ClickUp access is unavailable, prepare a ready-to-paste task title and body and ask the user to publish it or provide the destination.

## When a skill says “write a plan”

Write an active implementation plan under `project/plans_wip/`, following nearby plans and repository-specific planning skills.

Cross-link the plan and ClickUp task when a task reference is available.

## When a skill says “fetch the relevant ticket”

Read the referenced ClickUp task, including its description, status, comments, relationships, and acceptance criteria.

If no task reference or ClickUp access is available, ask the user for the task URL, task ID, or relevant content.

## Triage operations

Apply the labels from `docs/agents/triage-labels.md` using corresponding ClickUp tags or workflow fields. Do not mirror triage state into GitHub Issues.
