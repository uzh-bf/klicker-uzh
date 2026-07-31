---
type: Issue Tracker
title: Issue Tracker
description: Where agent-facing issues live for this repo, the gh commands the engineering skills use, and how wayfinder maps express tickets, blocking, and the frontier.
timestamp: '2026-07-31'
tags:
  - agents
  - process
---

# Issue tracker: GitHub

Agent-facing issues for this repo live as GitHub issues on `uzh-bf/klicker-uzh`. Use the `gh` CLI for all operations; it infers the repo from `git remote -v` when run inside a clone.

## What belongs here, and what does not

**ClickUp remains the product source of truth** for roadmap items, releases, and anything the wider team plans against. PR and MR descriptions keep linking their ClickUp task.

GitHub Issues is the tracker for **agent-facing engineering work**: wayfinder maps and their tickets, triage queues, and specs produced by `/to-spec` and `/to-tickets`. If a human would look for it in a sprint board, it belongs in ClickUp; if a skill needs to read or write it programmatically, it belongs here.

Nothing forbids a link between the two — a wayfinder map governing a roadmap item should name its ClickUp task, and vice versa.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body-file -`, piping the body on stdin. Heredocs work too, but stdin avoids shell-quoting damage in long bodies.
- **Read an issue**: `gh issue view <number> --comments`
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`, with `--label` and `--state` filters as needed.
- **Comment**: `gh issue comment <number> --body-file -`
- **Labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

This repository is **public**. Everything written to an issue is permanent public history — the same data-hygiene rule that governs commits governs issue bodies and comments. No participant data, no credentials, and no vulnerability mechanism or reproduction detail; severity statements are fine.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

GitHub shares one number space across issues and PRs, so a bare `#42` may be either — resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue; its tickets are GitHub sub-issues of it. Both the sub-issue and the dependency APIs are enabled on this repo and verified working — use them rather than the body-text fallbacks.

- **Map**: `gh issue create --label wayfinder:map`, carrying the Destination / Notes / Decisions-so-far / Not-yet-specified / Out-of-scope body. Open tickets are deliberately not listed in the body; the sub-issue list renders them.
- **Child ticket**: created normally, then attached with
  `gh api --method POST repos/uzh-bf/klicker-uzh/issues/<map>/sub_issues -F sub_issue_id=<child-db-id>`.
  Label it `wayfinder:<type>` — one of `research`, `prototype`, `grilling`, `task`. Put `Part of #<map>` at the top of the body so the link survives in plain text.
- **Database ids**: the sub-issue and dependency endpoints take the numeric **database id**, not the `#number` and not the `node_id`. Get it with `gh api repos/uzh-bf/klicker-uzh/issues/<n> --jq .id`. Passing the issue number silently targets the wrong issue, so resolve it every time.
- **Blocking**: GitHub's native issue dependencies, which render in the UI.
  `gh api --method POST repos/uzh-bf/klicker-uzh/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`.
  GitHub then reports `issue_dependencies_summary.blocked_by`, counting **open** blockers only, so it is a live gate rather than a static list.
- **Frontier query**: open children with no open blocker and no assignee.

  ```bash
  gh api repos/uzh-bf/klicker-uzh/issues/<map>/sub_issues --paginate \
    --jq '.[] | select(.state == "open" and (.issue_dependencies_summary.blocked_by // 0) == 0 and (.assignees | length) == 0) | [.number, .title] | @tsv'
  ```

- **Claim**: `gh issue edit <n> --add-assignee @me` — the session's first write, before any work, so concurrent sessions skip it.
- **Resolve**: comment the answer, close the issue, then append a one-line gist plus link to the map's Decisions-so-far. Never resolve more than one ticket per session.

### Active maps

| Map                                                                                         | Governs                                                                                                                                                  |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Participant Privacy & Auth — Readiness](https://github.com/uzh-bf/klicker-uzh/issues/5269) | Making [the PR #5128 participant privacy/auth plan](../../project/2026-06-16-pr5128-participant-privacy-auth-plan.md) decision- and implementation-ready |
