# Issue tracker: ClickUp

Issues, specs, and task tracking for this repository live in **ClickUp**, not in
GitHub Issues. GitHub Issues are not actively used; do not create them, and do
not treat an absent GitHub issue as an absent ticket.

Reach ClickUp through the ClickUp MCP tools (`clickup_*`). If those tools are
not available in the current session, say so and stop rather than falling back
to GitHub Issues or to local files.

## Conventions

- **Create a ticket**: `clickup_create_task` with a `listName` or `listId`. Ask
  which list when the target is not obvious from the conversation — this
  workspace has many, and a task in the wrong list is effectively lost.
- **Read a ticket**: `clickup_get_task`. Add `clickup_get_task_comments` when
  the discussion matters, which it usually does for anything already triaged.
- **Find a ticket**: `clickup_search` for free text; `clickup_filter_tasks` when
  you know the list, status, assignee, or tag you are filtering on.
- **Comment**: `clickup_create_task_comment`.
- **Update status, assignee, priority, or fields**: `clickup_update_task`.
- **Tags**: `clickup_add_tag_to_task` / `clickup_remove_tag_from_task` — this is
  how the triage vocabulary in `triage-labels.md` is applied.
- **Orient in an unfamiliar space**: `clickup_get_workspace_hierarchy`.

## Pull requests as a request surface

**PRs as a request surface: no.** Pull requests on GitHub are the review surface
for changes, not an intake queue for feature requests.

## When a skill says "publish to the issue tracker"

Create a ClickUp task with `clickup_create_task`, and report the task URL back.

## When a skill says "fetch the relevant ticket"

Resolve it with `clickup_get_task` (by id) or `clickup_search` (by description),
and read its comments before acting on it.

## Referencing work in Git

Commits and pull request descriptions reference ClickUp tasks by URL or task id.
Because this repository is public, keep those references to identifiers and
titles — never paste ticket contents that carry personal data.
