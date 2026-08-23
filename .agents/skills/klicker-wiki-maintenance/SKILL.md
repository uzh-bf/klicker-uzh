---
name: klicker-wiki-maintenance
description: Keep the KlickerUZH engineering wiki (docs/) and custom skills (.agents/skills/) accurate and up to date. Use when a change alters behavior or documented behavior, when you discover a non-obvious pattern worth recording, when adding/renaming/removing wiki pages or skills, or when documentation/skills and code disagree.
---

# KlickerUZH Wiki & Skill Maintenance

The wiki is an OKF v0.1 bundle at [docs/](../../../docs/) (root [index.md](../../../docs/index.md)). House rules on top of the generic `llm-wiki-okf` fundamentals:

## The same-change-set rule

Any PR that changes behavior or documented behavior must update both the affected wiki pages (in `docs/`) and the relevant skills (in `.agents/skills/`) **in the same PR**. Find affected pages or skills by grepping `docs/` and `.agents/skills/` for the symbol, command, or path that changed. When documentation/skills and reality disagree, reality wins and the docs/skills get fixed.

## Change-type → page map

| You changed…                                        | Update                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| Toolchain, setup, compose services, env bring-up    | `getting-started.md`                                                |
| App/package layout, request flow, middleware        | `architecture-overview.md`                                          |
| Prisma models, enums, gamification rules            | `domain-model.md` (+ `data-and-migrations.md` for ritual/gotchas)   |
| Pothos schema, auth scopes/permissions, ops/codegen | `graphql-api-layer.md`                                              |
| Hatchet tasks, workers, response pipeline           | `async-and-workers.md`                                              |
| Login flows, cookies, JWT, LTI                      | `auth-model.md`                                                     |
| Frontend conventions, i18n, design system, CSP      | `frontend-conventions.md` (chat app → `chat-platform.md`)           |
| Test stacks, seeds, CI test matrix                  | `testing.md`                                                        |
| Workflows, image builds, release, helm values       | `ci-and-deployment.md`                                              |
| Feature lifecycle, skill roster                     | `developing-a-feature.md` + the Skill routing section in `index.md` |

New non-obvious patterns discovered during a task go to the matching page above — `project/CODEBASE_NOTES.md` is a retired pointer stub; do not add entries there. Procedures belong in a skill (`.agents/skills/`), facts in the wiki; skills link to wiki pages, wiki pages never depend on skill content.

## House conventions

- Frontmatter: `type` (required), `title`, `description` (index reuses it verbatim), `timestamp` (bump on every meaningful change), optional `tags`.
- Cite `path:Symbol` (e.g. `apps/backend-docker/src/app.ts:prepareApp`), not line numbers. **Verify against the source before writing — never from memory.**
- Mark commands **verified** (you ran them) or **config-derived** (read from config). Never quote seeded credential values — reference the AGENTS.md test-credentials section.
- Links: relative (`./page.md`, `../apps/...`) so GitHub renders them. One concept per file, kebab-case names, no numeric prefixes.
- Each page leads with its single most non-obvious point.

## On every wiki edit

1. Bump the page `timestamp`. Git history is the change log — the wiki carries no log file.
2. On add/remove/rename: update `index.md`; grep the whole repo for inbound links (other pages, skills, README, AGENTS.md). Renames break concept IDs — avoid them.
3. Validate + format:

   ```bash
   bash ~/.agents/skills/rs-llm-wiki-okf/scripts/validate.sh docs   # no trailing slash
   pnpm exec prettier --write docs/
   ```

   (Prettier is the repo gate and runs in the pre-commit hook regardless.)

4. For substantial rewrites, fact-check load-bearing claims against their cited sources before committing.
