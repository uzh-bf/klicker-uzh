# Authenticated local Doc Query acceptance

## Approved outcome and authority

Restore the seeded Benibot's local `doc_query` integration through the unchanged
Chat bearer and ES256 scope-signing path. The user approved local fixture changes,
guarded repair of the isolated synthetic seed, browser acceptance, local commits,
and required reviews. This does not authorize staging or production writes,
deployment, or publication.
The existing citation-origin changes remain in scope and must be preserved.

No dependencies, production auth changes, or database migrations are planned.
Local deterministic retrieval proves the Chat integration, not staging indexing
or retrieval quality. Synthetic content may use the already-approved OpenRouter
runtime. Keep all plaintext credentials in process memory/environment only.

## Execution contract

The main session owns coupled authentication, local database ownership checks,
runtime coordination, and browser proof. Test work may be delegated once the
exported seams settle. Coupling and secret handling keep bootstrap work in the
main session.

1. Add a local verifier that authenticates transport and scoped JWTs before MCP
   parsing. Check ES256, type, key ID, issuer, audience, lifetime, session and
   request identifiers, and the exact synthetic chatbot and knowledge base.
   A request identifier remains reusable during its token lifetime.
2. Opt in through the managed MCP profile only. Require the canonical container
   root, bootstrap marker and local database host. Stop both owned process groups
   before generating a fresh ephemeral transport token and signing pair.
3. Lock and validate the global KB server and every consumer in a serializable
   transaction. Accept only the untouched legacy seed or the exact previously
   authenticated fixture. Require the seeded chatbot owner/course and exactly
   Tutor and Explainer consumers. Conflicts produce zero writes. Store only the
   encrypted bearer and exact singleton scope configuration in the local DB.
4. Pass ephemeral credentials to a child post-start process, with a nonsecret
   generation in both process fingerprints and fixture health. On interruption
   or failed startup, stop both owned groups. Never print raw exceptions.
5. Verify focused auth and ownership contracts, credential rotation, repeated
   startup, fixture loss, profile drop/re-add, and cleanup. Run the unchanged Chat
   signer through a real browser canary, then reload and inspect desktop/mobile.
   Require the completed tool call, marker, final answer and synthetic source.
6. Stop the exact runtime with its matching injection and prove Stopped with zero
   routes. Report any unexecuted checks separately from passing evidence.

## Review and evidence

Native planner Arendt (`01a07ac4-f28f-7fa1-91e8-9ea128e6260f`) approved the
second plan pass. The revision addresses environment delivery, coordinated
rotation and cleanup, exclusive seed ownership and atomicity, and strict JWT
validation with reusable request identifiers. No additional approval gate.

Baseline: `27f2474547df045cc11302c7d9e195798ec66870`, branch
`rs/citation-acceptance-clean`, no upstream, zero ahead and one behind `origin/v3`
at resumption. No integration is assumed.

## Progress

- Prior focused citation tests: 45 passed on this worktree.
- Prior browser canary: HTTP 503 before model execution. Seed scope parameters
  were empty and the KB server used unauthenticated transport.
- Runtime was stopped with zero routes after that failed canary.
- Implemented a guarded local bootstrap and verifier without modifying the
  production signer, scoped client, or scope resolver. No seed reset or migration.
- First startup and a repeated startup both report managed runtime ready, with
  Chat and the authenticated fixture running. The second startup rotates both.
- Focused citation, MCP policy, signer and scoped-client checks: 82 tests pass.
  New synthetic verifier/ownership checks: 14 tests pass. Biome check passes after
  formatting, and shell/Node syntax plus diff whitespace checks pass.
- Real GPT-4.1 browser canary completes in synthetic conversation
  `627f439c-8105-4e04-88e9-62c598f9de6a`. Explicit Auto Mode canary also completes
  in `adbb6666-e3f7-475f-8fdf-d4f4dd055c13`. Both show the completed course-material
  search, exact marker, nonempty answer, inline citation and synthetic source.
  Reload preserves the result. Desktop source tooltip and 390px mobile card were
  inspected. Screenshots are `/tmp/citation-local-reloaded.png`,
  `/tmp/citation-local-mobile.png`, and `/tmp/citation-auto-reloaded.png`.
- This fixture has no public origin URL. Preservation of website/PDF origin URLs
  is covered by the focused normalizer tests, not a live linked-source canary.
- Full Chat suite: 583 passed, 21 skipped, across 54 passing files and one skipped
  file. Chat `check` (route type generation and TypeScript) passes.
- Dropping MCP reports its owned process stopped while Chat remains running.
  Re-adding MCP reports both processes running and no runtime drift. A fresh Auto
  Mode tool call for bond pricing succeeds after that cycle, returning the marker
  and a page-3 synthetic source. Evidence: `/tmp/citation-post-rotation-mobile.png`.
- At the initial acceptance checkpoint, interruption/fault injection and
  transactional conflict integration tests had not run. The resumed run below
  adds that evidence.
- Bounded source reviewer Franklin (`01a07ad1-4d1b-7cc1-ab4d-cf9fa9f873ee`)
  completed with no confirmed blockers. Credentials remain visible to local apps
  in the shared process-group environment; each startup deliberately restarts
  both owned groups. Publication remains unapproved.
- Final runtime release is verified: the exact `rs-citation-acceptance-clean`
  workspace reports `Stopped`, route count is zero, and hosts is empty. The
  synthetic conversations and worktree are preserved. No staging proof claimed.
- Resumption on 2026-09-07: refreshed refs show this baseline zero ahead and two
  behind `origin/v3`, with no upstream. No integration or source edits performed.
  Fresh shell/Node syntax and `git diff --check` pass. The MCP-only startup and
  its one permitted retry both failed before execution because the automatic
  permission approval review exceeded its deadline. Failure-path testing remains
  blocked on host execution. A fresh provider read reports `Stopped`; fresh
  route verification failed with `could not determine process identity for host
  route update lock`, so zero routes is prior evidence, not a refreshed result.
  Resume startup interruption/cleanup and synthetic transaction conflict/rollback
  verification when host execution is available. Commits remain withheld.
- Host execution subsequently resumed. Refreshed refs now show zero ahead and
  three behind `origin/v3`; no upstream integration. Extracted the unchanged
  transaction into `apps/chat/scripts/local-mcp-seed.mjs` for direct SQL testing.
  Executor Kierkegaard supplied `apps/chat/scripts/test-local-mcp-seed.mjs`;
  main-session inspection and runtime execution verified it. The script sets
  `search_path` to `pg_temp` and uses only temporary synthetic tables. Successful
  repair and repeat decrypted-token rotation, extra-consumer rejection with an
  unchanged snapshot, rollback after the second UPDATE fails, and interruption
  before writing all pass. No persistent schema or test-data changes.
- `apps/chat/scripts/test-local-mcp-startup.mjs` passes against the real local
  bootstrap and managed helper. It confirms the fixture actually starts before
  an injected post-start failure, then verifies both owned groups stopped. It
  also sends SIGTERM while bootstrap waits for a deliberately held local KB row
  lock and verifies normal failure exit plus both groups stopped. Its initial
  observation loop failed because PostgreSQL cached the activity snapshot inside
  the observer transaction; clearing that snapshot fixed the test observation.
  No bootstrap defect was demonstrated by that initial failure.
- Reproduction commands, inside the exact container with its committed local
  environment loaded: `LOCAL_MCP_SEED_TEST=1 node apps/chat/scripts/test-local-mcp-seed.mjs`
  and `LOCAL_MCP_STARTUP_TEST=1 node apps/chat/scripts/test-local-mcp-startup.mjs`.
  Both exit zero. The startup test intentionally rotates the isolated fixture
  credential and stops both owned groups; it is not a read-only health probe.
- Fresh full Chat suite again passes 583 tests with 21 skipped. Chat `check`
  passes. Repository Biome checked the four extracted/bootstrap/acceptance
  scripts and formatted three; Node syntax and `git diff --check` pass. Earlier
  browser evidence is retained, not rerun. No model requests, staging proof, or
  live website/PDF origin-link proof in this run.
- At the failure-test checkpoint, delivery was uncommitted and required
  committed-scope reviews were pending. The earlier bounded source review
  predates this extraction and these acceptance scripts. The user approved
  local commits and reviews; the former agent-authored commit gate is removed.
  Publication and deployment remain withheld.
- Resumed-run shutdown is verified by exact source path: provider reports
  `Stopped`, route count is zero, hosts is empty. A plain stop rejected the
  retained LiteLLM Compose configuration; stopping with the existing approved
  `klicker-dev` OpenRouter mapping succeeded. No data or worktree was deleted.
- Local commits and required reviews are authorized. Staging/host-check commands
  and their permitted retry failed before execution because the automatic
  permission approval service exceeded its deadline. No commit or review ran;
  the index remains empty and provider state is freshly confirmed `Stopped`.
  Resume repository-native pre-commit checks, local commits, and required
  committed-scope reviews when host execution is restored, without another
  permission question. The global commit/review guidance was clarified; a
  concurrent writer subsequently expanded those same global paragraphs, so
  their broader edits were preserved and not committed by this task.
