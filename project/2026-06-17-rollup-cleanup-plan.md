# Rollup Cleanup Plan

Goal:
- Remove Rollup from plain intermediary packages already converted to `tsc`.
- Keep package `dist` boundary for Node/runtime consumers.
- Keep GraphQL, app bundles, and Office add-in Rollup untouched.

Non-goals:
- No source-import migration.
- No app/worker bundler migration.
- No dependency upgrades.
- No frontend behavior changes.

Identity:
- Plan path: `project/2026-06-17-rollup-cleanup-plan.md`
- Branch: `codex/manage-assistant-mcp-v3-ai`
- Target branch: `v3`
- MR/PR: none known

Research:
- Context7: unavailable; quota exceeded.
- Local evidence: old Rollup emits then hangs for `util`, `markdown`, `hatchet`, `prisma`; focused `build` and `check` pass with `tsc`.
- Local evidence: `grading` old Rollup exits, but keeping same plain-package build model reduces mixed paths.
- Local evidence: `shared-components` already exposes `src`, but these packages are used by Node services with `main`/`exports` pointing to `dist`.

Decisions:
- Keep building `dist` for `grading`, `hatchet`, `markdown`, `prisma`, `util`.
- Remove only package-local Rollup deps/config from those five packages.
- Add explicit `build:clean` where Rollup previously cleaned or where stale `dist` could hide missing emit.
- Keep explicit `build:copy` for `markdown` styles.
- Ignore local `.agents/` and `.devcontainer/*.env`; do not stage token-like local env file.

Risks:
- Lockfile importer drift if package deps change without `pnpm install`.
- Clean command portability: use existing Node/npm script deps, avoid new deps.
- Stale `dist` no longer masks missing files after clean scripts.

Progress:
- 2026-06-17: Plan active. Next: Slice 1 package dependency/config cleanup.
- 2026-06-17: Slice 1 active. Removing package-local Rollup deps/config from converted plain packages.
- 2026-06-17: Slice 1 verified. `rg` found no Rollup refs in converted packages. Focused package `build` and `check` passed for `grading`, `hatchet`, `markdown`, `prisma`, `util`; GraphQL `build` and `check` passed with Rollup override. Subagent review skipped because tool policy only allows subagents when user explicitly asks delegation; local review found no slice issues.
- 2026-06-17: Slice 2 active. Adding explicit clean scripts and local ignore rules for untracked agent/devcontainer artifacts.
- 2026-06-17: Slice 2 verified. Focused package `build` passed with `build:clean`; sequential focused `check` passed. Initial parallel build/check caused a transient `@klicker-uzh/prisma` resolution race while `dist` was being cleaned, so verification order must be build then check. Local simplification review kept per-package `build:clean` scripts instead of a shared abstraction.
- 2026-06-17: Slice 3 verified. Focused `build` passed for `grading`, `hatchet`, `markdown`, `prisma`, `util`, and `graphql`. Full `pnpm run check:all` passed. Branch diff secret-pattern scan found no `TOKEN`, `SECRET`, `PASSWORD`, `BEGIN`, or `sk-` matches outside lockfile; `.agents/` and `.devcontainer/` are ignored. Security review result: no high-confidence findings.

Slices:

1. Package Rollup Removal
- Files: five package `package.json`; five `rollup.config.js`.
- Do: remove Rollup deps/plugins; delete unused configs.
- Check: package JSON still valid; no Rollup refs in converted packages.
- Commit: `chore(build): remove rollup from plain packages`

2. Build Guardrails
- Files: same package scripts, `.gitignore`, lockfile after install.
- Do: add/keep clean/copy scripts; ignore local agent/devcontainer artifacts.
- Check: `pnpm install` lockfile sync; focused build.
- Commit: `chore(build): keep tsc package outputs clean`

3. Verification And Review
- Files: plan progress, maybe `AGENTS.md` learning if still accurate.
- Do: run focused `check`; final status; security review for secrets/config risk.
- Check: no staged secret/local agent docs; focused build/check pass.
- Commit: `docs(project): finish rollup cleanup plan` if plan progress changed after slice commits.

Next Steps:
- Optional follow-up: separately assess Rollup migration for Node apps/workers (`backend-docker`, `response-api`, `olat-api`, `lti`, workers`) and keep Office add-in bundled.
