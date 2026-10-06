# Backend image dependency security backport

## Approval summary

Backport the dependency corrections from [source PR #6400](https://github.com/uzh-bf/klicker-uzh/pull/6400) into `v3-ai`. The source package addresses backend image findings for GraphQL Tools utilities, proxy-addr and source-map-js. Preserve the target branch's dependency graph while upgrading those packages to the source package's reviewed versions. GraphQL Tools crosses older major versions, so compatibility requires runtime evidence as well as a valid lockfile.

The user approved an executable batch: scoped definitions, an exact release-age exception, regenerated lockfile, validation, local commits, ordinary task-branch push and a draft PR. Application behavior, deployment values, migrations and production data are outside this package. Merge, marking ready, release publication and rollout require separate authority. The exact age exception preserves the general fourteen-day policy.

Completion means a draft PR containing the scoped backport, this plan, compatibility evidence and honest outstanding checks. Hosted checks may remain pending. Trivy scan legs that skip drafts remain an explicit readiness gap; a green skipped build does not prove image security. A failed compatibility check is corrected within scope or reported as a concrete blocker before delivery is called validated.

## Execution details

### Evidence and binding contracts

- Source: squash `a8cd46435f799dab76308db96866b95a7db13d30`, target `v3-adaptive-learning`; no wholesale branch integration.
- Baseline: `v3-ai` at `d4fcdf8edaf23e905305c5b2781d5e7611b37d2d`, including the newly merged GPT-6 fixture/docs correction.
- Owned definitions: `.syncpackrc.mjs`, `packages/graphql/package.json`, `pnpm-workspace.yaml`; generated artifact: `pnpm-lock.yaml`.
- Pin utilities to `12.0.1` directly and through a selector below the fix. Refresh proxy-addr to `2.0.8` and source-map-js to `1.2.2` without unnecessary overrides. Add only `source-map-js@1.2.2` to the release-age exclusions.
- Use the repository's Node 24.21.0 and pnpm 11.5.0 in isolated containers. Preserve retained runtimes, caches and other worktrees. Host Git and forge CLIs own delivery.
- Registry metadata checked on October 6: Yoga `3.9.1` requires utilities `^9.2.1`; even latest Yoga `5.24.2` requires `^11.2.0`. Upgrading the consumer therefore does not remove the need for the reviewed `12.0.1` security override. A broader consumer migration is outside this backport. Supporting investigation is in the source PR.

### Ownership and sequence

Execution mode: standard. Ceremony: full path because dependency security and cross-major compatibility are involved. Packaging-floor exemption: resolves an image CI blocker.

Delegation map: main owns this single slice, verification, commits and draft delivery. Route: main. Execution-tier skip reason: unhealthy route; the configured OpenCodex executor proxy reports stopped/unreachable. Do not repair provider configuration within this package. The three definition edits are mechanical and remaining work is coupled to container ownership and compatibility checks. Acceptance: intended source definitions, scoped regenerated graph and the checks below.

One implementation slice: install the approved definitions, incrementally regenerate the target lockfile, validate all three patched resolutions, then verify GraphQL/Yoga compatibility and repository checks. Commit definitions and lockfile together. Run one security/correctness slice review and integrated final review. Generated graph and mechanical pins do not require a separate simplification pass.

### Test portfolio and acceptance

| Risk | Obligation | Acceptance seam |
| --- | --- | --- |
| Vulnerable versions retained or graph drift | No new test | Locked versions, override audit with manifests available, zero importer mismatches, frozen install and scoped diff inspection |
| Cross-major GraphQL incompatibility | Extend existing verification only | `pnpm --filter @klicker-uzh/graphql generate`, `check:ts`, `build:ts`; `pnpm --filter @klicker-uzh/backend-docker check` and `build`; existing `packages/graphql/test/elementGenerationSchema.test.ts`; backend-resolved Yoga query smoke below |
| Repository tooling drift | No new test | Existing formatting, syncpack and `check:all`; build or hosted equivalent with explicit limitations |
| Image advisory remains | No new test | Actual ready-head Trivy receipt is a later readiness gate; source PR evidence is supporting evidence only |

Do not run database-mutating tests against retained or production data. Use disposable marked test resources if full database tests are necessary. Record unrelated baseline failures separately rather than broadening the fix.

Yoga smoke: in a disposable container, create a Node `createRequire` anchored to `apps/backend-docker/package.json`, resolve/import `graphql-yoga` through it, and assert that its resolved utilities package is `12.0.1`. Instantiate `createYoga` with a synthetic `Query.health: String!` schema and resolver returning `ok`. Execute a JSON POST query `{ health }` through `yoga.fetch`; require HTTP 200, `data.health === 'ok'` and no GraphQL errors. This needs neither a database nor a managed application runtime.

Required local compatibility checks must pass before calling the draft validated. If prerequisite workspace outputs are missing, build their packages in dependency order. Hosted full checks and Trivy remain separately reported when local tooling or draft policy prevents their completion.

### Working context

Repository: `/Users/rschlae/Git/klicker/klicker-uzh`. Worktree: `trees/backend-image-security-backport`. Branch: `fix/backend-image-security-backport`. Target: `v3-ai`. Artifacts root: existing `project/`. Agent-document structure follows `writing-for-agents`.

## Progress

- Approval: executable batch approved in this chat; no additional generic approval needed.
- Plan review: native planner approved after one correction; optional AGY opinion unavailable because headless command permission was denied. Implementation: pending. Tests added/changed/removed: 0/0/0.
- Slice review and final review: pending. Draft PR: none yet.
- Next action: harden this frozen plan, commit it, then implement the dependency correction.
