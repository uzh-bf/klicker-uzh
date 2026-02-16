---
name: linear-workflow
description: Use a minimal Linear workspace/team/project mapping for cross-session continuity
user-invocable: false
---

# linear-workflow

Use this skill when a repository enables Linear workflow via devrouter.

## First step: read AGENTS mapping

Check `AGENTS.md` for the managed Linear block:

- `<!-- devrouter-linear-workflow-config:start -->`
- `<!-- devrouter-linear-workflow-config:end -->`

Use that block as source of truth for:

- workspace name
- team name (and optional key)
- project name (and optional id)

## If mapping is missing or placeholder

Ask the user these guided questions and update the AGENTS managed block:

1. Which Linear workspace does this repository belong to?
2. Which Linear team owns this repository? (optional team key)
3. Which Linear project should milestones/issues be created in? (optional project id)

If non-interactive context prevents asking, keep placeholders and request values in the next interactive session.

## Usage rule

- Do not hardcode workspace/team/project assumptions.
- Always resolve them from AGENTS metadata first.

## Required execution hygiene

When working on Linear-tracked issues, this is required:

1. Set issue status at session start and update it at each phase transition.
2. Post progress comments at meaningful checkpoints during implementation.
3. Before ending a session, post a final comment with completed work, remaining work, risks, and next step.
4. Re-check status and comment freshness toward/at session end before stopping.

## Devrouter-specific note

If the repository uses devrouter, read the upstream devrouter release guidance at `https://github.com/rolandhordos/devrouter/blob/main/CHANGELOG.md` before major changes and apply the latest Agent Adaptation Prompt there.
