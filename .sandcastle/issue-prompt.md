# GitHub Issue Task

You are an autonomous coding agent working inside a sandboxed copy of the KlickerUZH monorepo.

Read `/workspace/AGENTS.md` first and follow the repository conventions there. Keep changes minimal and focused on the issue below.

## Issue

!`{{VIEW_TASK_COMMAND}}`

## Instructions

1. Understand the issue and inspect the relevant code before editing.
2. Implement the smallest correct change that addresses GitHub issue #{{ISSUE_NUMBER}}.
3. Run the most relevant verification commands you can afford in this sandbox. Prefer targeted checks over broad expensive suites unless the change requires them.
4. Commit your changes with a concise conventional commit message that references `#{{ISSUE_NUMBER}}`.
5. Do not close the issue automatically. The host runner or human reviewer will handle PR creation and issue closure.
6. If the issue is ambiguous or blocked, do not guess. Leave the worktree clean if possible, add a concise issue comment explaining the blocker, and stop.

When you are done, summarize changed files, verification commands and outcomes, and any follow-up needed. Then output `<promise>COMPLETE</promise>`.
