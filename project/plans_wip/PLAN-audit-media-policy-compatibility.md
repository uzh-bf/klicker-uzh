# Audit media policy compatibility

## Goal

Make immutable audit media capture, replay and retention renewal recognize
Azure's lowercase lock-policy response. Resolve copied media source-account
handling explicitly rather than skipping owned evidence or weakening the
source allowlist.

## Scope and boundaries

- Domain: assessment LiveQuiz baseline, published ElementInstance media,
  immutable Blob version and retention policy.
- Initial slice: audit Azure adapters, provider fakes, regression tests and
  engineering documentation.
- No API schema, database, frontend, i18n, grading or leaderboard changes.
- Preserve workload identity, hash/length/MIME checks, source validation and
  retention horizons. Do not modify existing evidence or coverage records.
- Explicit secondary source accounts preserve full capture for copied media.
  Defaults remain primary-only; staging config adds the known legacy image
  account. No wildcard, arbitrary-host, anonymous-read or evidence-skipping
  fallback. Source read permission remains a deployment prerequisite.
- GraphQL dependency wiring, Helm configuration and Turbo environment tracking
  are included; no GraphQL schema or operation changes.
- No cloud role changes or deployment. Publish a draft PR after verification.

## Verification

- Realistic lowercase fake responses reproduced 18 failures before the fix.
- Current audit suite: 139 passing tests, excluding the two previously guarded
  PostgreSQL integration suites. Package typecheck and build passed.
- Added locked/capitalized compatibility and unlocked-policy rejection tests.
- GraphQL baseline/media-reference tests: 8 passed; GraphQL typecheck passed.
- Staging Helm rendering confirms the additional account reaches the backend.
- Live source probe blocked by unavailable staging API tunnel. Existing role
  assignments have no legacy-account Reader grant; verify/grant exact required
  read scope before deployment.
- Independent review found no new image/source-boundary issue. Its manifest
  post-write lock verification finding predates this change and is deferred to
  F1 sealing; media already re-reads and verifies the version policy.
- External executor/simplifier roles were not used because this worktree has no
  external-model opt-in. The main agent implemented and inspected the diff;
  native subagent review checked the integrated changes.
