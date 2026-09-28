# Playwright production build parity

## Approval summary

PR #6311 fixes a leaderboard crash caused by two React runtimes. The existing
browser test passed because the main Playwright suite used a different bundler
from production. The user authorized investigating and implementing build parity
on this same PR, in solo mode.

All five Next applications will use their existing production build commands and
`NODE_ENV=production` for the required CI browser suite. Manage, PWA, and Control
therefore retain Webpack; Auth and Chat retain Turbopack. Tests will serve the
standalone server with its generated public assets, including service workers.
A shared test-runtime helper will carry that output inside the existing `.next`
artifact contract, preserving symlinks and avoiding dependence on an unmerged
change to the trusted CI actions. Each shard serves the artifact built once.

Synthetic data, local endpoints, deterministic feature flags, and backend
coverage instrumentation remain test harness concerns. Necessary frontend fixture
configuration will be explicit and limited to the local image source and the
existing feature-flag proxy. Production deployments will not enable it. Local
interactive development remains a fast development loop and is not acceptance
proof; production browser verification and CI provide that proof.

Acceptance requires production builds for all five apps, a relocated standalone
runtime with static and service-worker assets, the completed-quiz leaderboard
interaction, and all eight existing Playwright shards passing without weakened
assertions. Required checks, final self-review, and the repository final AI review
complete delivery on this PR. Merging and deploying remain outside authorization.

## Execution details

### Evidence and decisions

- Target: `v3`, currently `85d03bb4880d7c62de9ffa128f863ad61baea793`.
- Branch: `rs/leaderboard-react-runtime`; existing PR #6311.
- Owner: main session; execution mode solo; approval mode executable batch.
- Existing fix baseline: `662e501c66f36cf747bc2edbebb355048e040829`.
- Five app manifests duplicate their production build command with a
  `NODE_ENV=test next build --turbopack` command.
- Shared Next configuration disables standalone output in test mode. The three
  PWA apps omit their PWA plugin in test mode. Manage additionally proxies the
  synthetic GrowthBook endpoint and shared configuration permits local images.
- Trusted CI archives `.next`, but excludes `.next/standalone`; generated public
  assets are not uploaded. Its immutable actions run from `v3`, so merely editing
  that action on the candidate would not prove the new artifact path in this PR.
- Existing `build:test` orchestration and cache keys include package manifests;
  app script changes invalidate the old output. Keep backend build/start tasks
  and the trusted routing, permissions, runner groups, and status gates intact.
- Backend test mode permits arbitrary GraphQL operations and loads the synthetic
  GrowthBook fixture. Preserve these explicit harness differences; this change
  establishes frontend production build/runtime parity, not production data or
  deployment infrastructure equivalence.
- Next.js documentation recommends running Playwright against production builds:
  <https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/testing/playwright.mdx>.
- No product primitive or public API changes; no schema, dependency, or
  infrastructure change. No ADR required for reuse of the existing build contract.

### Sequence and intended files

1. Add `util/playwright-next-runtime.mjs`, shared by the five frontend app
   manifests. Build invokes the canonical production command. Package the traced
   standalone server, static assets, public assets, and a small receipt under
   `.next/playwright-runtime.tar`, which the existing artifact step preserves.
   Start extracts and serves that artifact with production mode and the app port;
   it rejects missing or inconsistent artifacts and never falls back to dev.
2. Separate the two necessary frontend fixtures from `NODE_ENV` using a scoped
   `KLICKER_PLAYWRIGHT_FIXTURES` setting in shared Next configuration and Manage
   rewrites. Production compilation, PWA plugins, and standalone output stay on.
   Record the setting in Turbo's environment contract. Forward `NEXTAUTH_URL`,
   `AUTH_PWA_HOSTS`, and `APP_ORIGIN_CHAT` explicitly: standalone servers no
   longer load checkout `.env.test` defaults. Keep test-only backend
   behavior unchanged.
3. Add behavioral helper tests in `util/playwright-next-runtime.test.mjs` and wire
   them into `check:playwright-ci`. Test a synthetic relocatable server and build
   subprocess, not implementation text or incidental content. Verify all five
   scripts select this helper and production build command reuse through the
   execution contract. Extend existing browser coverage only for a consequential
   missing acceptance condition found during production execution.
4. Verify the local isolated runtime, then push the coherent change and run the
   complete existing CI suite on this PR. Update `docs/testing.md`, the two
   Klicker testing skills, and the leaderboard solution's remaining-gap account.
   Update the PR title/body once before the final CI/review cycle to avoid
   metadata-triggered cancellations.

### Test portfolio

| Risk | Obligation and primary seam | Acceptance |
| --- | --- | --- |
| Bundler or framework mode diverges again | New shared helper behavioral tests | Canonical build invoked with production mode; start also overrides inherited test mode |
| CI drops dependencies or worker assets | Relocated synthetic archive test and real production browser proof | Server runs outside checkout with static, public and worker assets |
| Missing artifact silently selects dev | New failure-path helper test | Startup exits nonzero before launching a server |
| Production plugins change browser behavior | Existing full Playwright suite, assertions preserved | All eight shards pass |
| Duplicate React leaderboard crash returns | Existing PR regression guard and completed quiz browser interaction | Hook guard and populated leaderboard pass |
| Ordinary deployments inherit fixtures | Focused Next config comparison | Fixture routes and local image exceptions absent without explicit opt-in |

### Verification and boundaries

Use the task worktree's existing Devrouter runtime only. Build/type/format checks
run inside it; local browser automation remains on the host. Stop the owned dev
process before producing production Next output. Do not mix `.next/dev` route
types with the acceptance build. Use synthetic data only. Stop and verify the
runtime after the final runtime-dependent check.

CI continues using its trusted artifact archive and startup commands; the helper
and app scripts are candidate application code within the existing contract.
No permission or runner-policy change is needed. The full suite must exercise
the new runtime on the PR before merge; an unchanged green old run is insufficient.
Production service workers may expose fixture interception or stale-cache issues;
resolve test isolation with fresh browser contexts instead of disabling the plugin.

Acceptance does not claim that the CI machine, backend fixture services, public
origins, or container image digest equal production. Exact deployment-image E2E
would be a distinct extension. Production compilation and standalone frontend
serving are the required boundary here.

Authority includes edits, local tests, commits, ordinary pushes, PR updates, and
final AI review. Pause only for a material scope or security change, unavailable
required verification, or separately gated merge/deployment actions. Main-session
simplification and final review cover the complete diff; self-review is not
independent evidence.

## Progress

- Planning: repository investigation complete; self-reviewed in solo mode.
- Implementation: shared production build/start helper and five app entrypoints complete.
- Local verification: 21/21 build tasks, all five production runtime archives;
  35/35 type/build checks, 7/7 lint tasks, other repository checks passed;
  39 host launcher tests and 83 CI contract tests passed.
- Browser verification: delegated login and completed-quiz leaderboard passed,
  including reload, five synthetic rows, and no page errors. Served build ID:
  `AGB918BqayIuyojtWwvFs`. Worker assets return 200 for all three PWA apps.
  Manage worker activation remains unverified: its generated precache includes
  `/_next/dynamic-css-manifest.json`, which the standalone server returns as 404
  despite the file being present. No PWA configuration was weakened.
- Simplification/self-review: shared helper replaces five divergent commands;
  traced dependencies and worker assets survive relocation; no test assertions
  removed or weakened. Approximate substantive delta: 350 lines, excluding plan.
- First production CI run: artifact build and five browser shards passed;
  answer-submission failures exposed an implicit `.env.test` response API URL.
  Export `NEXT_PUBLIC_ADD_RESPONSE_URL` through the existing local-origin wrapper
  and protect that subprocess contract. Repeat the full suite on the correction.
  Final AI review was clean on the first parity commit.
- Required delivery: updated PR #6311 with exact-head passing CI and final review.
- Runtime: isolated workspace `rs-leaderboard-react-runtime`; stop after checks.
