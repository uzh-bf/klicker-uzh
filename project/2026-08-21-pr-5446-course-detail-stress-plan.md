# PR #5446 follow-up: course detail route and stress fixture

## Goal

Keep the async course-duplication implementation usable in the manage app by
fixing the missing course-detail route and add an opt-in local fixture with a
large, deterministic activity set for manual stress testing.

## Authority and boundaries

- The user authorized this implementation with “proceed” and previously asked
  to push the branch. Push only `origin/fix/course-duplication-timeout` after
  the checks below; do not merge, deploy, or change production data.
- The existing workspace runtime must remain running for the user's manual
  verification. Runtime-only route registration is out of source scope.
- Do not update the production-readiness report, add logs, or change unrelated
  docs. This plan is the single active execution artifact for the PR.

## Evidence and design

- The running Manage dev server has `src/pages/courses/[id]/index.tsx`, but its
  Turbopack pages manifest omits `/courses/[id]` and requests log
  `PageNotFoundError: Cannot find module for page: /courses/<id>`.
- First test a route relocation from `[id]/index.tsx` to `[id].tsx`; preserve the
  nested assessment routes and adjust only imports made relative to the moved
  file. Keep the change only if both the manifest and runtime prove discovery.
- Add a development-only `seed:course-duplication-stress` script. It upserts one
  fixed course owned by the seeded lecturer and 200 fixed-ID, empty, DRAFT live
  quizzes. The fixture is intentionally not part of `seed:raw`; rerunning it
  must leave exactly the same course and activity counts.

## Slice list and acceptance

1. **S0 — Baseline and plan (complete).** Merge current `origin/v3` normally
   (without rewriting history) and record the fresh branch state.
2. **S1 — Route discovery.** Record the failing manifest, relocate the page if
   the A/B check confirms the fix, run the Manage package check, and verify the
   detail route plus both assessment child routes are discoverable.
3. **S2 — Stress seed.** Add the script and package command with an
   `ENV=development` guard, upsert the fixed course and 200 activities, run one
   course-level derived-permission recomputation, and run the seed twice. Verify
   one fixture course, exactly 200 expected quiz IDs, zero blocks, ownership and
   course linkage, readable derived permissions, and unchanged counts on rerun.
4. **S3 — Integrated verification.** Run repository-native checks in the
   container. Use the authenticated browser path to open `/courses`, the stress
   course detail, all 200 activities, and the duplication modal without
   submitting a job. Keep screenshots and review artifacts under ignored
   `project/_local/`; if delegated authentication remains blocked by the known
   Auth asset 400, report that gap separately and stop before claiming readiness.
5. **S4 — Publish.** Run the required simplifier, risk-selected slice review,
   and final package review. Inspect the staged diff for secrets and personal
   data, commit conventional messages, push normally to the named branch, and
   read back the remote SHA. Leave the runtime running.

## Review and test portfolio

- No duplicate end-to-end test is added: the existing course suite already
  covers navigation and duplication behavior. The seed's two-run database
  assertions are the new fixture-specific acceptance check.
- The route slice receives a simplifier pass after its commit. The seed slice
  receives a simplifier and data-integrity review. A final reviewer checks the
  integrated committed range before publication.

## Progress

- 2026-08-21: Confirmed the 404 is Next route discovery, not a missing course;
  the source exists while the runtime manifest omits the dynamic page.
- 2026-08-21: Rebased the branch by a normal merge of current `origin/v3`.
- 2026-08-21: Relocated the detail page to `courses/[id].tsx`, adjusted its
  relative imports, and proved Manage and both assessment child routes return
  HTTP 200. The focused Manage typecheck and route simplifier passed.
- 2026-08-21: Added the opt-in stress seed with a local-database target guard,
  fixed UUIDv5 activity IDs, and course plus live-quiz OWNER permission checks.
  The container typecheck passed and two consecutive runs produced exactly 200
  empty DRAFT live quizzes.
- 2026-08-21: Diagnosed Hatchet as an environment and worker-runner issue,
  not a Hatchet service outage. The managed workers now compile with Rollup,
  run under nodemon, and both worker types connect and remain alive.
- 2026-08-21: Removed the generated PR documentation, readiness report, and
  screenshots per request; this plan remains the only active project artifact.
- Next: complete the authenticated browser check, final review, and normal
  push to `origin/fix/course-duplication-timeout`.
