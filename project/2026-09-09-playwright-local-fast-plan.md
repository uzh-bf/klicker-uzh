# Fast local Playwright and ready-only CI

## Approval summary

Make the existing host Playwright command the dependable development loop before
removing expensive browser jobs from draft PRs. Infer the smallest runtime from
selected specs, expose phase timings, and reuse a verified synthetic seed snapshot
when this measurably improves clean resets. Every acceptance run still starts from
a clean baseline. A restored baseline is distinct from preserving mutated data.

Ready PRs retain the full suite, and returning to draft cancels obsolete execution.
Integration-branch push verification remains unchanged. No product behavior,
production data, database role, migration, runner provisioning or repository setting
changes belong to this package.

The user explicitly requested planning followed by execution, a native goal and
actual E2E verification. This authorizes the worktree, synthetic local test runs,
implementation, reviews, commits, ordinary branch push and draft PR delivery.
Marking ready, merging and deployment remain withheld. Host cleanup outside this
worktree needs separate approval; Docker subnet exhaustion currently blocks startup.

Success means measured cold and warm browser runs, either accepted clean snapshot
restore with invalidation/refusal evidence or clean reseeding with the recorded
negative prototype result, and lifecycle policy checks proving
zero draft build/shard jobs and full ready execution. Easy parallelism will be
implemented only if isolation is demonstrated without changing application data
contracts; otherwise record the experiment and keep one worker.

## Execution details

### Context and ownership

- Owner and boundary owner: main session (`self`). Native goal is active.
- Worktree: `trees/rs/playwright-local-fast`; branch: `rs/playwright-local-fast`.
- Target: `v3`, baseline `59162306987dafe816f007fe3750f4f3c06d9c66`.
- Artifacts root: existing `project/`; this plan path stays stable.
- Full-path package. One cohesive PR delivers the local-first browser verification
  policy; slices are commit boundaries, not separate PRs. Native stack support is
  verified, but splitting the small CI policy from its local readiness evidence
  would weaken the package's acceptance story. Reassess if implementation grows
  into distinct independently useful runtime capabilities.
- Explorer owns reset/seed and parallelism mapping. Main owns decisions, runtime,
  database safety, integration and E2E proof. Executor owns settled launcher work;
  a separate bounded executor may own CI after the plan is hardened.
- Open draft #5852 evaluates selective draft CI. Preserve that owner's files and
  branch. This user's ready-only policy supersedes selection for this package.

### Binding behavior

The host launcher remains the only local browser entrypoint. Applications and
services run in the exact worktree's managed runtime. Keep native environment and
Docker identity checks; no arbitrary database URL or privileged role override.

Use `playwright/profiles.json` and the existing manifest parser for explicit spec
selection. Unknown filters, unmatched paths and broad selection fall back to the
maximal `playwright` profile. An explicit `--runtime-profile` remains authoritative.
Preserve Playwright argument semantics. Show elapsed setup/runtime/browser phases
on success and failure without dumping environment values. Avoid repeated browser
installation only after checking the exact required executable, including headed
versus headless mode.

The seed snapshot is local, ignored, and tied to the exact worktree and disposable
`klicker_test` database. Capture all public-schema tables, sequences, constraints and views only after a successful
clean synthetic seed in this task's freshly provisioned environment. Preserve the
known bootstrap reference data as part of that baseline, including achievements
that the existing cleanup intentionally retains. Never capture an arbitrary warm
development database. Compare the actual public-schema fingerprint before reuse;
source hashes are insufficient when local schema state has drifted.
Never import an arbitrary retained database or publish snapshots. Reuse must bind
schema and migration contents, seed implementation/constants, relevant dependency
lockfile, PostgreSQL major version and time-sensitive seed inputs. Cache publication
is atomic; mismatched, incomplete or corrupt entries cannot count as a hit.

Prototype the narrow reset seam before choosing the storage representation.
Prefer native PostgreSQL dump/restore over custom row serialization if it preserves
all constraints and the existing disposable guard. Mutation must verify the actual
connection doing the restore, using the marked database and nonprivileged test
role; a separate preflight alone is insufficient. Restore is transactional and
failure stops tests. Keep an explicit clean reseed escape hatch. Snapshot access requires the validated local host-launcher path and is disabled
when CI or GITHUB_ACTIONS is present. --preserve-database neither captures nor
restores. Snapshot miss may
run the normal seed; a failed restore must not silently continue on partial state.
Do not change Prisma schema, bootstrap roles or migrations for this optimization.

Cover the global setup and shared per-spec cleanup reset seam. Existing explicit
cleanup/seed task pairs may remain the conservative path unless measured evidence
requires consolidation. Preserve activity-specific fixture creation and existing
Redis/Hatchet semantics. Determine whether quiescence or additional reset actions
are required before accepting the snapshot experiment. Do not claim whole-runtime
snapshot isolation from a PostgreSQL-only restore.

Keep one worker per shared runtime. Evaluate two complete specs in separate
already-isolated worktree runtimes only if host capacity and ownership permit it.
A useful parallel feature must isolate app database connections, Redis, Hatchet,
URLs and reports; database cloning alone is insufficient. If that requires broader
runtime orchestration, retain serial local execution and document separate-worktree
sharding as the supported option rather than adding unsafe `workers > 1`.

CI skips the reusable execution job on draft events, before prepare/build/shards.
Keep opened, synchronize, reopened, ready_for_review, converted_to_draft and closed
coverage. The no-op cancellation path joins the exact existing PR concurrency group
on conversion/closure. The status reports a draft skip explicitly and rejects an
unexpected skipped, cancelled or failed execution for ready PRs. A cancelled
run never proves success without verified supersession. The ready reporter requires
full mode, should_run=true, a valid route and the complete eight-shard matrix.
Exercise its executable decision logic, not only YAML string matching. Queue telemetry stays a best-effort step of the status job for every non-cancelled report, including drafts.
Preserve push behavior, trusted reusable workflow provenance, runner restrictions,
permissions and the required status name. Do not introduce pull_request_target.

### Research and experiment

Current source proves the host runner defaults to full, the manifest already maps
specs to profiles, and global setup cleans and seeds again through cleanupTest.
Current GitHub evidence shows draft #5862 ran a build and eight shards in about
52 minutes including queueing. The draft selector opt-in is unset.

Official Playwright 1.58.2 documentation requires isolated server state for parallel
workers and supports whole-file sharding without fullyParallel. PostgreSQL native
dumps provide reusable restore artifacts; verify PostgreSQL 15-specific behavior
against the actual installed service before relying on restore details.

Experiment question: can the exact synthetic clean baseline be restored faster
than normal cleanup/seed while preserving disposable identity and successful browser
journeys? Inputs are this task's fresh synthetic database only. Success requires an extra test-owned synthetic Achievement row to disappear after restore and a
mutated sequence to return to its captured state, the same browser assertions to pass,
and measured seed/restore times. Inconclusive means startup unavailable, unsafe
identity, activity races, schema mismatch or non-equivalent behavior. If restore is unsafe, cannot preserve baseline equivalence, or does not improve
comparable clean-reset timings, retain normal seeding and record the negative result.
The launcher and CI work can still complete; snapshot shipment is conditional on
that experiment, not an unconditional terminal requirement. Prototype
artifacts remain under project/_local/evidence and never become production code by
copying them wholesale.

No product primitive changes. No ADR: this is bounded local verification tooling
using existing disposable identity and runtime contracts. A proposal to change
those contracts, database roles or application routing reopens the design decision.

### Test portfolio

| Risk | Obligation and primary seam | Distinct failure |
| --- | --- | --- |
| Wrong local runtime or argument handling | Extend existing host launcher tests | Focused selection omits a dependency or swallows a Playwright flag |
| Unsafe or stale snapshot | Add focused snapshot integration/contract tests | Restore reaches an unmarked DB, accepts stale/corrupt data, or leaves mutation behind |
| Draft/ready lifecycle | Extend existing workflow policy and status behavior tests | Draft allocates runners; ready skip passes; conversion fails to cancel |
| Broken real local workflow | Existing browser specs plus measured run evidence | Source checks pass but startup/login/app queries or restored fixtures fail |
| Unsafe parallelism | Bounded experiment, no new maintained test unless implemented | One run resets another run's data or shared services |

### Delegation map

| Slice | Accountable owner | Owned paths/subtask | Dependency and acceptance |
| --- | --- | --- | --- |
| 1 | Main | plan, runtime baseline; explorer returns mapping | no dependency; reviewed plan and producing run |
| 2 | Main | executor: util/run-playwright-host.mjs and host tests, new local selection helper only | slice 1; profile/argument contracts and real focused run |
| 3 | Main | snapshot helper and global setup integration | slice 1 baseline; measured equivalence, mutation/sequence restoration and refusals |
| 4 | Main | executor: CI caller and validator/status tests; main: docs and integrated proof | local readiness from slices 2/3; ready/draft contracts and actual E2E |

### Slices and verification

1. **Plan and baseline.** Harden this draft with native planner and one optional
   opposing-provider challenge. Commit the reviewed plan separately. Complete
   a current-source focused browser run and timing baseline once Docker permits it.
2. **Fast focused launcher.** Executor changes only launcher/profile selection,
   phase timing, browser reuse and focused host tests. Main runs narrow and fallback
   commands on the exact runtime. Commit, simplify, and review any runtime seam risk.
3. **Repeatable clean seed restore.** Main evaluates the prototype, settles the
   representation, then, only after successful prototype acceptance, implements the smallest safe cache at the reset seam with
   guarded restore and invalidation tests. Run first miss, repeat hit, post-mutation
   restore (including removal of an extra synthetic Achievement and exact sequence
   restoration), schema/seed-key invalidation and refusal checks. If the prototype
   is rejected, retain clean reseeding and record the negative result instead. Commit and run simplifier
   plus data-integrity slice review. Record the parallelism ruling from evidence.
4. **Ready-only CI and integrated proof.** Bounded executor updates caller policy,
   cancellation, reporter and existing validation tests. Main integrates, runs
   repository-native checks and representative auth, manage/PWA, chat and live-quiz
   browser coverage with clean restore when the snapshot is accepted, otherwise
   normal clean reseeding. Run the full Chromium suite if runtime
   capacity permits; unresolved failures remain delivery blockers, not ignored flakes.
   Update docs/testing.md, playwright/README.md, docs/ci-and-deployment.md and the
   Klicker Playwright skill where these contracts change. No UI change: screenshots
   are unnecessary; browser reports and producing-run evidence are required.

Commit each implementation slice only after applicable checks and staged data/secret
inspection. Dedicated simplifier and risk reviewer cover immutable substantive
slices; Claude CLI final reviewer covers the integrated committed package. Reuse
unchanged evidence. Container-dependent builds/checks execute in the container;
host-only Playwright and forge/Git run on the host. Record absent/split hook limits.

### Delivery and terminal condition

Publish one coherent draft PR, with complete branch description and measured
results. Verify hosted draft skip at the candidate head. Exercise ready and
conversion predicates locally; live ready-for-review transitions remain withheld
unless the user explicitly authorizes them. This limitation is not claimed as live
GitHub lifecycle proof. Keep applicable non-Playwright CI and configured final review
visible and resolve in-scope failures. No setting changes or merge.

Stop the exact runtime after final dependent verification and prove no routes and
provider stopped state. Preserve worktree, volumes and snapshots. Terminal: reviewed
implementation delivered as a draft with passing relevant checks and actual E2E
receipts, measured results and explicit parallelism decision. Pause only for an
unresolved authority/material design boundary, unavailable required review, or an
external capability that prevents further safe progress; finish independent work.

## Progress

Planning in progress. Native goal created. Docker startup failed before containers
were created because the default address pools are exhausted. Exact unused-network
removal approval requested asynchronously; no network has been removed. Existing
primary-checkout changes remain untouched. Native planner round 1 returned REVISE. All five findings accepted: complete
snapshot scope and live-schema identity; local-only/preserve boundaries; strict ready
status behavior; explicit slice ownership; negative-prototype terminal branch.
Optional AGY challenge was rejected by automatic approval review for external
payload egress and was not run. Native planner round 2 requested consistent conditional snapshot language and
explicit Achievement/sequence checks. Both accepted; round 3 APPROVED. Execution proceeds within existing user authority.


### Execution checkpoint

- Continuation session: CI slice corrected and verified (6 validator tests).
- Launcher slice completed in main session: spec-file profile inference through
  the shared manifest parser, explicit `--runtime-profile` precedence, maximal
  `playwright` fallback, and success/failure phase timings. 38 launcher tests
  pass, including inference, precedence, and timing assertions.
- Seed snapshot slice implemented: `util/playwright-seed-snapshot.mjs` capture
  and transactional restore with in-transaction identity guard, backend
  termination, schema drop/recreate, dump filtering (SET/CREATE SCHEMA/meta
  lines), schema-fingerprint validation, and an atomic key-bound cache under
  git-ignored `playwright/.cache/`. Global setup restores on miss-free hits,
  seeds and captures otherwise, and fails closed on restore errors. 7 snapshot
  tests pass; `@klicker-uzh/playwright` typecheck passes.
- Host install completed for 30 of 31 workspace projects (docs excluded; its
  sharp@0.32.6 native build fails under the sandbox linker and it owns no
  check/lint/build tasks). `turbo run check` passes 35/35 tasks; syncpack,
  agents-md, git-identity, removed-doc-artifacts, prisma-sync, playwright-ci,
  playwright-host, biome format, prettier, and analytics ruff (with sandbox
  cache redirection) all pass individually. `run-p`/`lint-staged` cannot run
  in the sandbox (process inspection and `.git/worktrees` writes are denied).
- New blockers: escalated `devrouter ensure` was auto-rejected by the account
  usage limit (valid until Sep 15), so E2E runs need user-side runtime start or
  explicit approval; worktree git index writes are sandbox-denied, so commits
  need escalation or user-side execution.
- Review gates: OpenAI subagents are quota-blocked until Sep 15 and the Claude
  CLI is session-limited until 23:00 Europe/Zurich. A source-level slice
  review record is persisted at
  `project/_local/reviews/2026-09-09-playwright-local-fast-slices.md`; the
  independent final review reruns when a reviewer route is available.
- Plan hardened APPROVED in round 3. Commit attempted with staged Gitleaks clean;
  full pre-commit failed because host has only browser dependencies and container
  startup is blocked. No hooks bypassed; preserve plan as the first separate commit
  once exact-container checks pass. Source preparation proceeds independently.
- Baseline: 36 host/workflow contract tests and 28 selector/route/metadata tests
  passed. Host Playwright installation reused 784 packages, no downloads (4.5s).
- Runtime owner rs-playwright-local-fast exists; initial ensure failed at network
  creation with all predefined address pools fully subnetted. Exact network cleanup
  approval pending. Source-path listing confirms zero routes. No E2E executed.
- Explorer mapping repeatedly reread and expanded source after one convergence
  request. Native task evidence confirmed nonconvergence; child closed. Main owns
  remaining snapshot decisions using verified reset seams and planner findings.
- Active bounded implementation owners: Laplace (launcher), Dalton (CI). Parent
  retains commits, integration, snapshot prototype, real runs and delivery.

### Execution checkpoint 2 (2026-09-09 evening, ZCode takeover)

- Took over from the codex handoff at 22:19 CEST. Verified the recorded state
  (tree, tests, commit script, review record), re-ran the three focused suites
  (fail 0), and committed the four planned slices with full hooks
  (gitleaks + check:all 35/35). The codex-sandbox git/escalation blockers do
  not exist on this host session.
- Rebased onto origin/v3 (one non-overlapping manage commit, d3a1853565).
- Started the worktree runtime: `devrouter ensure --profile manage,chat` is
  ready (api, auth, chat, manage, pwa; Postgres/Hatchet/Redis healthy). The
  earlier subnet exhaustion is gone.
- Cold E2E A-login 16/16 with launcher phase timings and first capture. Found
  a real bug: the snapshot never hit — pg_dump (PG 15 security backport)
  emits `\restrict <random-token>` lines, so every schema fingerprint differed.
  Fixed `normalizeSchemaDump` to strip them (mirroring the restore filter) and
  added a regression test; commit `0e3cff9359`.
- Snapshot acceptance passed: synthetic Achievement id 99999 and a mutated
  `CatalogCollectionAssignment_id_seq` (4321→7) are both wiped by a restore,
  15 bootstrap achievements retained, 16/16 browser assertions pass.
- Timing verdict (honest): restore median ~1046ms (778–1320) vs cleanup+seed
  median ~947ms (676–1087) on this host — restore is NOT faster. Per the
  plan's negative branch, reseeding stays the default; the accepted snapshot
  implementation is retained behind `KLICKER_PLAYWRIGHT_SEED_SNAPSHOT=1`
  (commit `23fe303b10`, docs/skill updated). Default-mode E2E re-verified:
  zero snapshot activity, 16/16.
- Independent final review dispatched via the Claude CLI final-reviewer route
  (route reopened after 23:00) over the frozen range
  d3a1853565..23fe303b10; result pending. An opt-in-gate E2E receipt and the
  Y-chat / MA-elements runs were queued behind host-wide devrouter provider
  contention from concurrent agent sessions at the time of writing.
- Receipts after the queue drained: opt-in gate verified live (key-mismatch
  miss → reseed → recapture → restore, 16/16); Y-chat 95/95 (5.5 min);
  MA-elements 81/82 with one dev-mode `<nextjs-portal>` overlay click flake in
  a cleanup test, then 82/82 on immediate rerun — flake, not regression; the
  branch touches no app code.
- Final review returned 7 findings (no blockers). Disposition: five fixed in
  `251512822f` (snapshot tests wired into `check:playwright-host`; same-role
  backend termination in the restore; COPY-aware dump-meta filtering; cache
  key bound to the seed's local year; stale launcher test title), one was
  already satisfied by the post-gate receipt, and the profile-narrowing
  teardown was accepted as the approved inference design and documented in
  README/testing.md. Post-fix opt-in rerun: both restores hit with the new
  SQL (1187/1093 ms), 16/16.
- Delivered: branch pushed non-force to origin and published as a draft PR
  against v3 with the measured results in the body. Mark-ready remains
  withheld; live GitHub draft/ready transitions are not exercised.
