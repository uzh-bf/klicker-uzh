# 28. AI releases ship from a short-lived qualified RC branch with a clean-schema gate

## Status

Accepted — 2026-08-29

## Context

`v3` is the production mainline and currently ships `3.4.0-alpha.N`
continuously. `v3-ai` has
accumulated a large body of AI work, including exploratory migrations that
shared staging has already applied. Shared staging follows a floating branch
selected by `STG_SOURCE_BRANCH`; the promoter accepts only Docker-tag-safe
branch names, and the staging image workflows build only `v3` and `v3*`
branches. The AI capabilities must reach production without freezing either
line, without shipping exploratory schema, and without a database
down-migration story that PostgreSQL cannot honestly provide.

## Decision

The 3.4.0 AI release is cut as the short-lived release-candidate branch
`v3.4.0-ai-rc` (pattern `v3*`, Docker-safe — both constraints are load-bearing)
from a normalized `v3-ai` commit. Future AI releases substitute their version
in the `v<release>-ai-rc` branch and `v<release>-rc.N` tag patterns. Published
3.4.0 candidates use the existing `v3.4.0-rc.N` tag sequence; a stable `v3.4.0`
release remains a later, separately accepted step. Shared staging is repointed
to the RC (repository variable and ArgoCD `targetRevision` together), reset
destructively, and qualifies that exact tree. After qualification the RC merges
into `v3`, the resulting tree is tagged and deployed dark, and feature trains
continue on `v3-ai` throughout.

Three rules bound the release:

- **Ship clean or park.** Every model, enum, constraint, and migration in the
  RC tree is an accepted production shape. Feature flags gate exposure; they
  never excuse schema debt.
- **Merge hold with path-scoped equality.** From RC cut to dark deploy, `v3`
  accepts only critical production and security fixes, each forward-ported to
  the RC and `v3-ai`. Release equality is proven by an empty
  `git diff RC..merged-v3 -- apps packages` plus an audited residue list for
  deploy, workflow, and version files — not by tree-SHA identity, which
  release commits make impossible.
- **Forward-only rollback.** Application images and flags roll back; a faulty
  migration is repaired by a compensating forward migration. Database
  down-migrations are not promised and not written.

## Consequences

- Staging promotion pauses from the first migration-tail rewrite until the RC
  is promoted, and the last pre-cut staging deployment stays frozen in that
  window.
- The RC lives for roughly two weeks; a maintained automation PR back-merges
  every RC fix into `v3-ai`.
- One branch ruleset covers `v3`, `v3-ai`, and the RC. With a single code
  owner, required approvals stay at zero and always-reporting status checks
  carry the entire gate; the staging promoter identity is a named bypass
  actor.
- The pattern repeats for future AI releases until `v3-ai` retires into `v3`.
