# Production readiness — PR #5224 (QR scan authoring and print workflow)

Date: 2026-08-23 | Scope head: `codex/escape-room-qr` @ `75438561ba42ea688e810974934d7537b6a065e6` | Base: `v3` (merge-base `7812fa71ce`, 2026-07-31)
Working material: `project/_local/reviews/2026-08-23-pr5224-qr-scan-readiness-brief.md`

## Verdict

**ready-with-conditions** — No dimension found any candidate blocker; wave-two verification was vacuous (zero candidates). The change is architecturally sound for its stated purpose: an inert question-type foundation with owner-gated print data, participant-invisible by construction (union member omits the code; placement guards fail closed across all four activity services plus templates, and the residual guard hole provably crashes before persistence rather than bypassing). The conditions exist because the branch cannot merge cleanly today (125 commits of drift, 18 conflicts), because the decisive deployment fact (where/how `migrate deploy` runs, hence whether the CONCURRENTLY index migration survives) is unverifiable from the repository, and because two small defects in this PR's own error channels should ride the merge window. Merge after the conditions below are discharged on a rebased branch; do not merge this head as-is.

### Conditions

1. **Rebase onto current v3 and resolve deliberately** — 18 conflicted paths (re-verified at verdict time; `origin/v3` advanced again during the audit). Recipe from the audit: service files take the v3 skeleton with PR hunks spliced (`elements.ts`, `groups.ts` — keep the PR's *post-validation* clue deletion, not v3's early deletion); generated artifacts (`ops.ts`, `ops.schema.json`, `public/{schema.graphql,client.json,server.json}`) are resolved by regenerating via `pnpm --filter @klicker-uzh/graphql generate`; **delete `docs/log.md`** (v3 policy forbids it; the PR's log entry is redundant). Re-run `pnpm run check:all` after resolution.
2. **Pin the production migration path**: confirm where `prisma migrate deploy` actually runs (ArgoCD PreSync `job-migrate.yaml` exists; `deploy/env-uzh-prd/values.yaml` says migrator enabled while `docs/data-and-migrations.md` narrates it as bootstrap-only — reconcile), confirm migration 2 executes non-transactionally there, and record the answer in-repo.
3. **Add the failed-index recovery runbook** (five lines: INVALID `Element_qrScanCode_key` signature → `DROP INDEX CONCURRENTLY` → `pnpm --filter @klicker-uzh/prisma prisma:resolve:{prod,qa} -- --rolled-back <name>`) to `docs/data-and-migrations.md`.
4. **Fix the two error-channel defects introduced/load-bearing here**: (a) the tautological completeness check in `splitActivityInstances` (`packages/graphql/src/services/liveQuizzes.ts:152-156`) — compare against requested ids so the QR guard rejects with `BAD_USER_INPUT` instead of crashing later with an opaque error; (b) surface guard messages in the four wizard submit paths instead of the generic `considerFormErrors` toast.
5. **Discharge fresh agent-browser verification of the corrective tip** (pagination/filter/select-all/paste/bulk-add) once DevPod/Docker runtime permits — the PR body itself marks current-tip browser verification as blocked; historical screenshots predate the corrective commits.

## Prior gates

| gate | artifact | status |
|---|---|---|
| `$code-review` | none for this head | missing |
| `$thermo-nuclear-code-quality-review` | none for this head | missing |
| `$security-review` | none for this head | missing |
| per-slice reviews | none for this head | missing |
| `-combined-final` | none for this head | missing |

Only prior artifact in `project/_local/reviews/` was the PR #5323 brief (different scope). The PR description cites an earlier independent review and passing repo checks on the branch, but no standing-gate artifact records them.

## Findings

| severity | dimension | finding | evidence | proposed action | verification |
|---|---|---|---|---|---|
| major | deploy | Service-file merge conflicts are mechanical-to-lightly-semantic; QR additions survive v3's newer logic; keep PR's post-validation clue deletion over v3's early deletion | v3 kept clue deletion at `groups.ts:877-880`; PR moves it behind validation; `getUserElements` filter line lands in v3's single shared clause (`elements.ts` v3:159, 234-235) | Resolve as v3 skeleton + PR splice; re-run merge-tree after staging | unverified (static analysis) |
| major | failure modes | Completeness check in `splitActivityInstances` is tautological (Set built from `dbElements` compared to its own size), dead validation now load-bearing for the QR guard | `packages/graphql/src/services/liveQuizzes.ts:152-156`: `const uniqueElements = new Set(dbElements.map((q) => q.id))` / `if (dbElements.length !== uniqueElements.size)` | Compare against requested ids; throw `GraphQLError('Not all elements could be found')` | unverified (verbatim source) |
| major | observability | Cross-type id rejection returns silent null with zero logging; sibling services log via `executionCtx.logger` | `services/elements.ts:518-519`: `if (elementPrev && elementPrev.type !== type) { return null }`; grep for logger in elements.ts = zero matches | Log with elementId + expected/actual type, or typed GraphQLError | unverified (verbatim source) |
| major | observability | Not-found / wrong-type / deleted / not-owner collapse into one indistinguishable null on both QR queries; `withPermission` denial also silent | `elements.ts:297` `return element?.qrScanCode ?? null`; `elements.ts:319` `if (!element?.qrScanCode) return null`; `sharing.ts` ~5978 `if (!access) return null` | Debug/info log in OWNER-denial branch; document null-semantics contract | unverified |
| major | observability | Backend ships no working error tracking/metrics (Sentry commented out, OTel imported nowhere) — platform-wide gap the QR surface inherits | `apps/backend-docker/src/app.ts:11-13`, 155-179 commented `useSentry`; `index.ts:15-16` commented Sentry import | Platform-level: enable Sentry or add explicit resolver logging before participant-facing stack PRs | unverified |
| major | observability | P2002 unique-constraint collision on QR create/copy unhandled — masked 500 instead of self-healing retry; repo already has `isPrismaError` helper | `elements.ts:606-607` and `sharing.ts:4774-4776` generate codes with no try/catch; precedent `assessmentReports.ts:543,643` | Wrap writes with `isPrismaError(P2002)` + one regeneration retry | unverified |
| major | data safety | Migration 2's non-transactional execution rests on Prisma single-statement semantics + an out-of-repo deploy runner nobody has documented; first CONCURRENTLY migration in ~170 | `20260719133000_.../migration.sql` sole statement; Prisma 7.8.0; `docs/data-and-migrations.md:39` admits "Where `migrate deploy` runs in deployment is **not documented in-repo**"; no CI workflow invokes migrate | Execute the doc-prescribed replay validation once; pin the pipeline invocation into the doc (Condition 2) | unverifiable-from-repo (failure mode is loud, not silent) |
| major | ux | Guard `BAD_USER_INPUT` messages never reach lecturers — four wizard catch blocks render generic "check form errors" toasts | `practiceQuizzes.ts` ~233 throw; `apps/frontend-manage/src/lib/apollo.ts:57-84` errorLink handles only 'Unauthorized'; `submitLiveQuizForm.tsx:210-213` swallows to console | Inspect `extensions.code === 'BAD_USER_INPUT'` in shared submit helper; dedicated i18n message | unverified |
| major | docs | No operator recovery runbook for half-failed CONCURRENTLY index build despite recovery scripts shipping unreferenced | repo-wide grep: `prisma:resolve:prod/qa` only at `packages/prisma/package.json:61-62`; no doc mentions `migrate resolve` | Add five-line recovery paragraph (Condition 3) | unverified |
| major | docs | PR modifies `docs/log.md`, which v3 policy bans and trunk has deleted — guaranteed conflict, entry will be lost | AGENTS.md:258 "must never be created or restored"; modify/delete conflict in merge-tree | Drop the log.md hunk in resolution (Condition 1) | confirmed (policy + merge-tree) |
| minor | deploy | Generated artifacts regenerable via unchanged codegen script | `packages/graphql/package.json` `"generate": "graphql-codegen --config codegen.ts"` outputs exactly the conflicted set | Regenerate, treat residue as resolution mistake | unverified |
| minor | deploy | Nothing gates QR_SCAN at runtime — live-on-deploy for lecturer creation (inert for participants) | full-tree env/flag sweep of PR tree: zero hits | Accept (structural gating via guards + client allow-lists); kill-switch would be a product request | unverified |
| minor | deploy | Revert-after-deploy is safe without DB action; enum value/column/index inert residue; do NOT hand-drop objects | additive-only SQL delta; base-era `processElementData` throws on unknown types rather than corrupting | One sentence in release notes | unverified |
| minor | deploy | Deployment ordering safe under PreSync expand-contract; watch-items: prd migrator values/doc discrepancy; 600s hook deadline vs index build | `deploy/charts/klicker-uzh-v3/templates/job-migrate.yaml` header; `env-uzh-prd/values.yaml:997-998` vs `data-and-migrations.md:43` | Reconcile prd migrator state; mention timeout+recovery in release notes | unverified |
| minor | deploy | `docs/log.md` resolves to delete (see major row above) | policy | `git rm docs/log.md` | confirmed |
| minor | failure modes | Guard hole (unresolvable ids pass the guard) ends in crash-before-persistence, not placement: `getActivityInstanceConnectOrCreate` throws when map entry missing, before any transaction | `packages/util/src/elements.ts:372` Case 3: `throw new Error('Element that was required for instance creation not found')` | Subsumed by tautology fix; optionally convert to GraphQLError | confirmed (trace end-to-end) |
| minor | failure modes | Pre-existing QR instances referenced via `existingInstanceId` ARE caught — persistentInstances fetched without permission/type filter | `activities.ts:18-44` source resolution verbatim; `liveQuizzes.ts:74-79` fetch where-clause | None needed | confirmed |
| minor | failure modes | Duplication-mode miss (nonexistent/denied instance id) fails open through the guard then crashes in util Cases 1/2 | same trace | Subsumed | unverified |
| minor | failure modes | `recomputeDerivedPermissions` outside `$transaction` after upsert (pre-existing shape, negligible for fresh QR elements) | `elements.ts:688-692,700` on `ctx.prisma` | Follow-up debt only | unverified |
| minor | failure modes | Offset pagination can duplicate/omit rows across pages under concurrent edits (pre-existing property) | shared `elementFilteringClause` for count+page at `elements.ts:164,239-240`; sort key `updatedAt desc` | None for this PR; cursor pagination eventually | unverified |
| minor | data safety | No down-migration documented; revert leaves dev-DB drift prompts; no data-loss window (additive-only, no DROP/RENAME/backfill anywhere) | SQL diff grep: zero destructive statements | One-sentence revert note in migrations doc | confirmed (diff scan) |
| minor | data safety | Prod PG major version assumed ≥12, not verifiable in-repo (all visible pins are 15: docker-compose.yml:185, devcontainer, CI) | pin citations | Record prod PG version when deploy location is resolved | unverifiable-from-repo |
| minor | data safety | Restore script forces `restore_exit_code=0`, masking partial pg_restore failures (pre-existing); verifier checks tables not index validity | `util/backup/advanced/restore-db-infisical.sh` tail | Flag to maintainers out-of-PR-scope | unverified |
| minor | data safety | `qrScanCode` needs a sensitivity classification + rotation mechanism before later stacks make scans grant answers | generator `randomBytes(9).toString('base64url')` at `util/src/qrScan.ts:8`; plaintext column | Classify low-sensitivity capability secret in docs; define rotation pre-#5225 | unverified |
| minor | data safety | No existing rows can violate the new unique constraint (all NULL at creation, NULLS DISTINCT, no seed backfill) | `migration.sql:5`; zero `qrScanCode` refs in prisma-data; regression test `elementSharing.test.ts:2526-2527` | None needed | confirmed |
| minor | data safety | Decoys deduped only against own code, not other rows' stored codes (~10⁻¹⁹ collision odds) | `elements.ts:304-322` loop | Negligible; note only | confirmed (arithmetic) |
| minor | ux | Cross-type edit null maps to misleading generic save-failed toast (reachable only via hand-crafted API calls) | `ElementEditModal.tsx` QR case returns false → `questionSavedFailed` toast | Disable type selector in EDIT mode or dedicated message | unverified |
| minor | ux | Decoy-count input clamps safely (21→20, −1→0) but each keystroke refetches whole payload (`network-only`) | `qr-print.tsx` onChange clamp | Commit value on blur/Enter | unverified |
| minor | ux | No per-sheet language toggle; switching EN/DE requires changing app locale | `getStaticProps({ locale })`; only controls are decoy input + print button | Optional segmented control overriding locale for the sheet | unverified |
| minor | ux | Printed sheet offers no paper-side way to identify the answer QR (legend screen-only, cards shuffled) | `qr-print.tsx` legend `print:hidden`; Fisher-Yates shuffle in useMemo | Screen-only key page or highlight matching aid | unverified |
| minor | ux | QR_SCAN filter icon duplicates NUMERICAL's exactly | `FilterList.tsx:126-129` both `[faQuestionRegular, faQuestionSolid]` | Use `faQrcode` | confirmed (verbatim) |
| minor | ux | DE copy "Anzahl Täuschcodes" coins an unusual term | `de.ts` ~1701 | Consider "Zusatz-/Störcodes" | confirmed (verbatim) |
| minor | ux | Print CSS quality good (toolbar/header/footer suppressed, break-inside-avoid); >20-card pagination untested | `qr-print.tsx` classes; Header/Footer `print:hidden` | Verify in release QA | unverified |
| minor | ux | Authoring form correctly minimal; sample solution correctly absent (QUESTION_GROUPS.ALL excludes QR) | `shared-components/src/constants.ts:45-53`; yup default branch | None | confirmed |
| minor | ux | Preview wiring correct; visual fidelity partially traced (QR prompt injection into ContentElement not fully traced) | ElementTypeMonitor/useArtificialInstanceInstance/StudentElement reads | Confirm preview text in release QA | unverified |
| minor | perf/capacity | Element table has no index on ownerId or type at all — pre-existing; the new `elementTypes` filter rides the existing per-owner scan pattern | `packages/prisma/src/prisma/schema/element.prisma` at PR head: no @@index on Element beyond @unique constraints | Out-of-scope observation for maintainers; realistic per-user scale keeps it tolerable | confirmed (schema read) |
| minor | perf/capacity | `react-qrcode-logo` statically imported on print page but confined to that page's chunk; identical pattern to pre-existing `pages/qr/[...args].tsx`; dependency pre-exists at same version | `qr-print.tsx:11` import; package.json identical v3 vs head | None | confirmed |
| minor | perf/capacity | No unbounded growth or cost surprises: decoys regenerated per request, sheets never persisted, no new jobs/Redis/Hatchet tasks | PR file list + services evidence | None | confirmed |
| minor | config/secrets | Zero new env vars/deps/config; no secrets in diff (credential-pattern scan of +3,170 lines); turbo.json globalEnv correctly untouched; SSR/build-safe print page | full-diff greps cited in worker report | None | confirmed |
| minor | config/secrets | Committed verification screenshots display the synthetic dev element's answer code (isolated DevPod row, no rotation applies) | `project/2026-07-29-escape-room-qr-verification/03/04*.png` visual inspection | Optional context handoff to `$security-review` | confirmed (visual) |
| minor | docs | Migration guidance in `data-and-migrations.md` verified accurate against shipped SQL; prescribed ritual was performed per delivery plan | `data-and-migrations.md:39` bullet vs both migration files | None | confirmed (cross-read) |
| minor | docs | "Where migrate deploy runs" open question is pre-existing repo debt (verbatim at merge-base), mirrored in ci-and-deployment.md | `7812fa71ce:docs/data-and-migrations.md:39`; `ci-and-deployment.md:50` | Maintainer verbal confirmation before tag promotion | unverifiable-from-repo |
| minor | docs | Wiki/skill obligations met: inertness contract, defense-in-depth rule, CSPRNG/print rules durably documented; 4 skills updated in-PR | `domain-model.md`, `graphql-api-layer.md`, `frontend-conventions.md` additions | None | confirmed |
| minor | docs | Verification artifacts honest; residual debt stated in PR body where mergers read ("database-backed GraphQL tests remain blocked…", "Current-tip browser verification remains blocked…") | PR body Verification section; verification README | Discharge agent-browser condition post-runtime | confirmed |
| minor | observability | Health probes unchanged/schema-agnostic; migration failure is loud (process exits before listen, healthz stays down) | `app.ts:190-192` `/healthz`; `migration.ts` `.then` without catch | None | unverified |
| minor | observability | Placement-guard throws acceptable (typed user-input validation, not faults); ActivityLogEntry CREATION writes give a free adoption/failure trail | guard sites; activity-log write ~`elements.ts:723-737` | Defer metrics to stack PRs | unverified |
| minor | observability | Frontend GraphQL errors console-only (no Sentry/RUM anywhere in manage app) | `apps/frontend-manage/src/lib/apollo.ts:58-85` | Platform-level | confirmed |

Refuted during the audit (kept so future runs don't re-litigate):
| severity claimed | finding | refuting evidence |
|---|---|---|
| candidate blocker | QR guard "fails open" letting QR elements into activities via unresolvable element ids | `packages/util/src/elements.ts:372` — instance factory throws `'Element that was required for instance creation not found'` before any `$transaction` opens; nothing persists; participants cannot receive such an instance (failure modes worker, confidence 100) |

## Not checked

- **Any runtime/browser verification** — no running instance existed for head `75438561ba42`; workspace spin-up declined by orchestrator (quota/host churn). All interaction claims are static. Historical screenshots predate the corrective commits (per their own README).
- **Actual stg/prd migration invocation** — absent from the repo by the project's own admission; the single largest unverifiable premise (fails loud if wrong).
- **Production Postgres major version** — infra config outside the repo.
- **DB-backed GraphQL tests at this head** — blocked per the PR body (local Prisma/Hatchet unavailable); no test-run evidence exists for the tip.
- **External monitoring, alerting, backup scheduling** — no in-repo trace; cannot rule out infra-layer coverage.
- **Participant-side QR rendering deep-dive** — delivery path proven unreachable in ordinary activities; deferred to the stack PRs that make it reachable.
- **PNG metadata/EXIF forensics** — visual inspection only (deemed low-risk).
- **Empirical codegen/build/test execution** — barred by read-only discipline; regenerability asserted from config.

## Handoffs

- **`$code-review` / `$thermo-nuclear-code-quality-review`**: silent-null logging additions (observability majors), P2002 retry wrapper, tautology fix implementation, wizard toast handling, duplicate filter icon, DE terminology, decoy-input blur commit, per-sheet language control, answer-QR paper key. None investigated further here.
- **`$security-review`**: printed sheets inherently expose the true answer code to whoever holds the paper (by design, owner-gated retrieval); screenshot observation; rotation mechanism design needed before #5225 makes codes participation-capable; exposure surface was checked statically (participant union omits field; owner filters on both queries; instance copies exclude it with tests) but a dedicated vulnerability pass was not part of this audit.
- **Final-outcome review** (its own gate): not run as part of this audit; standing-gate artifacts remain missing for this head.
- **Platform/on-call owners** (out of any PR's scope): Sentry/OTel wired but disabled repo-wide; restore script exit-code masking.

## Audit mechanics

Wave one consumed 14 reviewer-tier xhigh runs (six dimensions required relaunches after tool-permission denials; performance was closed by orchestrator-targeted reads after repeated empty returns). Wave two: zero deduplicated candidate blockers → zero verifier dispatches. Total: 14 of the 16 hard maximum.
