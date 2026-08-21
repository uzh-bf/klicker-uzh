---
name: klicker-wiki-maintenance
description: Keep the KlickerUZH engineering wiki (docs/) and custom skills (.agents/skills/) accurate and up to date. Use when a change alters behavior or documented behavior, when you discover a non-obvious pattern worth recording, when adding/renaming/removing wiki pages or skills, or when documentation/skills and code disagree.
---

# KlickerUZH Wiki & Skill Maintenance

[docs/](../../../docs/) is an OKF v0.1 bundle and a selective engineering reference, not a prose mirror of the code or a change log. It keeps only durable knowledge that is difficult to recover from the source alone:

- top-level area guides explain non-obvious facts and contracts;
- `docs/adr/` records why significant, hard-to-reverse decisions were made, following `$domain-modeling`;
- `docs/solutions/` captures verified lessons from resolved problems.

User-facing documentation belongs in `apps/docs`, procedures belong in `.agents/skills/`, task plans and reviews belong in `project/`, and change history belongs in Git. OKF root indexes and logs are optional reserved files; this bundle intentionally omits both.

## The same-change-set rule

A PR updates the affected pages in `docs/` and relevant skills in `.agents/skills/` **in the same PR** when it makes existing guidance inaccurate or introduces a durable contract that the code does not explain. A behavior change does not require a ceremonial documentation edit. Find affected pages or skills by grepping both directories for the symbol, command, or path that changed. When documentation or skills disagree with reality, reality wins and the guidance gets fixed.

## Change-type → page map

| You changed…                                        | Update                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| Toolchain, setup, compose services, env bring-up    | `getting-started.md`                                              |
| App/package layout, request flow, middleware        | `architecture-overview.md`                                        |
| Prisma models, enums, gamification rules            | `domain-model.md` (+ `data-and-migrations.md` for ritual/gotchas) |
| Pothos schema, auth scopes/permissions, ops/codegen | `graphql-api-layer.md`                                            |
| Hatchet tasks, workers, response pipeline           | `async-and-workers.md`                                            |
| Login flows, cookies, JWT, LTI                      | `auth-model.md`                                                   |
| Frontend conventions, i18n, design system, CSP      | `frontend-conventions.md` (chat app → `chat-platform.md`)         |
| Test stacks, seeds, CI test matrix                  | `testing.md`                                                      |
| Workflows, image builds, release, helm values       | `ci-and-deployment.md`                                            |
| Feature lifecycle                                   | `developing-a-feature.md`                                         |
| Skill roster or procedure                           | The relevant skill plus `AGENTS.md` when routing changes          |

New durable, non-obvious patterns discovered during a task go to the matching page above — `project/CODEBASE_NOTES.md` is a retired pointer stub; do not add entries there. Procedures belong in a skill, facts in the engineering guides, decisions in ADRs, and resolved failure knowledge in solutions. Skills may link to engineering pages; engineering pages must remain understandable without skill content.

## House conventions

- Concept frontmatter keeps `type` (required), `title`, `description`, optional `timestamp`, and optional `tags`. Preserve existing fields. Update `timestamp` only when the same page receives a meaningful semantic correction.
- ADRs follow `$domain-modeling`: one decision per numbered file. Discover and number them by listing `docs/adr/`; do not maintain a separate ADR index.
- Cite `path:Symbol` (e.g. `apps/backend-docker/src/app.ts:prepareApp`), not line numbers. **Verify against the source before writing — never from memory.**
- Mark commands **verified** (you ran them) or **config-derived** (read from config). Never quote seeded credential values — reference the AGENTS.md test-credentials section.
- Links: relative (`./page.md`, `../apps/...`) so GitHub renders them. Link new pages directly from the closest relevant guide, skill, or `AGENTS.md`; do not create a central inventory. One concept per file, descriptive kebab-case names, no numeric prefixes outside ADRs.
- Each page leads with its single most non-obvious point.

## On every wiki edit

1. Check that the content belongs in `docs/`: it is durable, repository-specific, non-obvious from source, and useful beyond the current task.
2. Update only the affected page and skill. On add/remove/rename, grep the whole repository for inbound links and update the closest direct discovery path. Renames break stable references — avoid them.
3. Validate and format in the development container:

   ```bash
   bash ~/.agents/skills/rs-llm-wiki-okf/scripts/validate.sh docs
   pnpm exec prettier --write <changed-markdown-files>
   ```

4. Verify direct links and citations from the changed files. For substantial rewrites, fact-check load-bearing claims against their cited sources.
