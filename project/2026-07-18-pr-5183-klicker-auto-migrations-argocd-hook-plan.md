# Plan: Auto-run DB migrations via ArgoCD PreSync hook

## Identity

- Plan path: `project/2026-07-18-pr-5183-klicker-auto-migrations-argocd-hook-plan.md`
- Branch: `claude/klicker-auto-migrations-90b73c`
- Target: `v3`
- PR: https://github.com/uzh-bf/klicker-uzh/pull/5183 (draft)
- Reference pattern: `~/Git/tc/{elearning,careers}/deploy/{stg,prd}/migration-job.yaml` (ArgoCD PreSync migration Job)

## Goal

Migrations run automatically as ArgoCD `PreSync` hook Job before each stg/prd rollout. New app never boots on unmigrated DB. Retire manual laptop-run `prisma:deploy:prod` (keep as break-glass).

## Non-goals

- Boot-time data-migration runner (`apps/backend-docker/src/migration.ts`) — untouched (currently empty list, separate concern).
- standard-version release flow — unchanged.
- Auto-bump of image tags — still manual per-release (same as today). The migrator tag is not bumped separately: it defaults to the backend tag in the chart, and per-env migrator tag pins were removed (see Progress post-review slice).

## Decisions (user-approved)

- Deploy driver = ArgoCD. Confirmed.
- Hook flavor = **ArgoCD-native** `argocd.argoproj.io/hook: PreSync`. Reversed from initial Helm-native lean — see Research R1.
- Migrator image = **dedicated minimal** `packages/prisma/Dockerfile` (Option B). Not `--target migrator` in backend Dockerfile (Option A).
- Scope = both stg + prd.
- Manual `prisma:deploy:prod` kept as documented break-glass.

## Research

R1. ArgoCD + Helm hook behavior (agy / Gemini 3.5 Flash High, ArgoCD docs; corroborated by reference projects in same DF-cloud ArgoCD):
- Evidence: ArgoCD reads `argocd.argoproj.io/hook: PreSync` from `helm template` output → honored in Helm charts.
- Evidence: failed PreSync hook aborts sync; main-wave Deployments never update. = the safety we want.
- Evidence: if ANY argo hook annotation present on a chart resource, ArgoCD ignores ALL helm-native hooks → do not mix.
- Evidence: ArgoCD-native avoids Helm pre-install+pre-upgrade double-run-on-every-sync quirk; gives sync-wave ordering.
- Evidence: `hook-delete-policy: BeforeHookCreation,HookSucceeded` (reference value) = failed Job stays for debugging, cleaned up on next sync.
- Decision: use ArgoCD-native, mirror reference exactly.
- Applicability: reference = same team/cluster/ArgoCD → high transfer. Klicker chart is Helm (reference is Kustomize) but annotation handling identical post-render.

R2. Migrator image must carry: prisma CLI + migration (schema) engine binary + `src/prisma/schema` (176 migrations) + `prisma.config.ts`. Needs `DATABASE_URL` only at deploy time.
- Risk: backend runtime image installs `--prod --ignore-scripts` → no prisma CLI, no engine, no migrations. Cannot reuse.
- Risk: Option A (`--target migrator` off backend build) inherits `--ignore-scripts` → engine binary likely absent. Rejected.
- Decision: Option B — standalone alpine, `npm i -g prisma@6.16.1` (scripts run → engine present), copy schema + config.
- Open (verify slice 1): does `migrate deploy` require `SHADOW_DATABASE_URL`? Expected no (shadow only for dev/diff). Confirm by running container with only DATABASE_URL.

## Progress

- [x] Plan approved, decisions locked.
- [x] Slice 1 — migrator image applies migrations. VERIFIED: `packages/prisma/Dockerfile` built (node:24.16.0-alpine + prisma@6.16.1 global); ran vs throwaway Postgres with ONLY `DATABASE_URL` → 176 migrations applied, exit 0; 2nd run idempotent ("No pending migrations"); `_prisma_migrations`=176. Confirms no SHADOW_DATABASE_URL / generators needed. `--schema src/prisma/schema` resolves migrations from `<dir>/migrations`.
- [x] Slice 2 — CI. Added `build-migrator-{arm,amd}` jobs + `MIGRATOR_IMAGE_NAME` env to `v3_backend-docker-{stg,prd}.yml`. Mirror backend jobs, `file: packages/prisma/Dockerfile`. Same triggers/metadata-action → tags lockstep (prd `v*.*.*`, stg `v3`; stg PR paths already include `packages/prisma/**`). YAML validated (ruby): 4 jobs each. True build test = on push.
- [x] Slice 3 — Helm PreSync hook Job + values. `templates/job-migrate.yaml` (ArgoCD PreSync, envFrom = backend-graphql global+cm+secret, guarded by `migrator.enabled`). Base `values.yaml` migrator block; prd overlay (`-arm`, tag `v3.4.0-alpha.62`); stg overlay (`-arm`, tag `v3`). VERIFIED: `helm lint` clean; `helm template` per env renders correct annotations/image/envFrom; `enabled=false` → empty (no Job).
- [x] Slice 4 — wiki updated. `docs/ci-and-deployment.md` (deploy driver = ArgoCD, new Deployment migrations section + ArgoCD-native-vs-Helm-hook gotcha, resolved open question) + `docs/data-and-migrations.md` (Deployment migrations subsection: hook mechanics, expand-contract, break-glass `prisma:deploy:prod`). Anchors + cross-links verified.
- [~] Finish gate — automated reviews run; slash-only maintainability gate + operational confirmations still pending (see Current slice).
  - Security ($security-review): PASS. 0 HIGH-confidence findings. Traced: no creds baked in image / logged, non-root, exec-form CMD; GH Actions use only trusted server-controlled interpolations (no untrusted event body in run:/ref:), scoped `contents:read`/`packages:write`; images exact-pinned. 3 defense-in-depth NOTES (not blocking): (1) Job `envFrom` inherits full backend secret not just DATABASE_URL — accepted (secret provisioned out-of-band, blast radius = backend's); (2) actions tag-pinned not SHA — matches repo convention; (3) `npm i -g` transitive deps unlocked — same as backend image.
  - Maintainability: `/thermo-nuclear-code-quality-review` RAN (interactive, maintainer). Verdict: APPROVE, no structural blockers. One deferred observation — CI adds 4 near-identical build jobs (migrator arm/amd × stg/prd), but they mirror the existing backend jobs verbatim and no image-build workflow in the repo uses a matrix/reusable-workflow; matrix-ifying only the migrator would be a lone deviation, so a repo-wide CI refactor is the real fix (own PR). Minor inherited oddities (QEMU on native-arch runners, no-cache arm-only, old action pins) verified verbatim from backend jobs → NOT fixed here to preserve consistency. Dockerfile + `job-migrate.yaml` clean (non-root, chart helpers, `with` guards, gated). Earlier agy pre-check (Gemini 3.5 Flash High) had already rejected its 4 findings with the same convention/reproducibility evidence.
  - ADR: CREATED. User aligned repo convention — ADRs are the decision record, wiki is non-obvious concepts only. Established `docs/adr/` (README + convention), wrote [ADR-0001](../docs/adr/0001-automate-db-migrations-via-argocd-presync-hook.md), linked from both wiki sections + `docs/index.md`, re-routed `AGENTS.md`/`CLAUDE.md` decisions → `docs/adr/`.
- [x] Draft PR — https://github.com/uzh-bf/klicker-uzh/pull/5183 (draft, base v3). Body via $rs-mr-description-writer, whole-branch coverage, read-back verified. GitGuardian PASS. `build-migrator-{arm,amd}` recognized in CI, `skipping` on draft (same `draft==false` gate as backend jobs) → will build on non-draft/merge/tag.

- [x] Post-review slice — couple migrator tag to backend tag. `job-migrate.yaml` defaults `migrator.image.tag` to `.Values.backendGraphql.image.tag`; dropped the per-env migrator `tag` pins (repo-only). VERIFIED: helm renders prd `…-migrator-arm:v3.4.0-alpha.62`, stg `…-migrator-arm:v3` (both follow backend tag); lint clean. Resolves the prd bootstrap landmine: release does not auto-bump env tags (standard-version bumps only package.json; Helm updater commented out), and a prd release necessarily builds the migrator image + moves the backend tag the migrator now follows. ADR-0001 + wiki updated.

- [x] Prisma 7 re-port (2026-08-03) — the ADR's version-drift risk materialised: #5185 moved `v3` to Prisma 7.8.0 and relocated the datasource URL from `datasource.prisma` into `prisma.config.ts`, so the merged image (still `prisma@6.16.1`, schema-only copy) would have had **no connection string** and aborted every stg/prd sync. Fix: merged `origin/v3` (single conflict, `docs/data-and-migrations.md` frontmatter); Dockerfile now pins `prisma@7.8.0` as a **local** install (global breaks the `prisma/config` import in `prisma.config.ts`), copies `prisma.config.ts` to `/app`, runs `npx prisma migrate deploy` (config auto-discovered; no `typescript` dep needed). VERIFIED by running, not building: local arm64 image vs throwaway Postgres 15 → `Loaded Prisma config from prisma.config.ts.`, 176 migrations applied, exit 0; 2nd run idempotent ("No pending migrations"); empty `DATABASE_URL` → clear `Connection url is empty` failure (config genuinely consulted); `--network none` run proves `npx` needs no registry at runtime. amd64 variant not locally verified (CI builds it). Also fixed SonarCloud `kubernetes:S6865`: `automountServiceAccountToken: false` on the Job pod spec, helm render re-checked stg+prd. `docker:S6505` remains a deliberate false positive (lifecycle scripts are load-bearing); suppression convention still an open user question.

- [x] Production-readiness gate (2026-08-03/04) — `$rs-production-readiness`, 8 dimension reviewers + verifiers. Report: `project/2026-08-03-pr5183-production-readiness.md`. Verdict was **not-ready** on one CONFIRMED blocker, now fixed: prd inherits `backendGraphql.image.tag` (`v3.4.0-alpha.62`), a pre-hook tag for which no migrator image exists and none can be built (prd CI triggers only on new `v*.*.*`; re-running an old tag uses that tag's workflow file, which has no migrator jobs) — so every prd sync, including an emergency rollback, would have failed on ImagePullBackOff after the 600 s deadline and aborted. This **supersedes the "Resolves the prd bootstrap landmine" claim in the post-review slice above**: the tag coupling closes the gap only from the first post-hook release onward, and partial promotions (chat is on alpha.64 while backend is on alpha.62) make the window real. Fix: `migrator.enabled: false` on prd until its tags reach a migrator-bearing release, documented in values, wiki, and ADR-0001. Two other candidate blockers were verified and REFUTED, kept in the report so they are not re-litigated: GHCR packages are not private-by-default on this path (108/108 org packages are anonymously pullable), and an interrupted migration cannot silently succeed (empirically: SIGTERM ignored, SIGKILL → exit 137 → loud, sticky P3009). Majors also fixed this slice: dropped `ttlSecondsAfterFinished` (it deleted the very failed Jobs the delete-policy keeps), gave the deploy-gating Job the env's app priority class (was priority 0 among 100k/1M workloads), added a failed-hook runbook, recorded the assessment-DB scope limit and the missing hook-failure alerting, and taught `klicker-data-model` the expand-contract constraint. Pin guard tightened to the `RUN npm install` line and fails closed.

Current slice: DONE. Branch complete, draft PR open. Bot reviews addressed (Greptile 5/5; 2 P2 replied — 1 rejected on convention, 1 stale/resolved by coupling. CodeRabbit 3 plan-doc findings fixed in b8461b5e6). `/thermo-nuclear-code-quality-review` RAN → APPROVE, no blockers. Remaining before merge: confirm real CI migrator build on non-draft/tag; confirm ArgoCD picks up the PreSync hook on next stg sync (both operational, out of repo control).

## Slices

### Slice 1 — Migrator image
- Do: add `packages/prisma/Dockerfile`. `FROM node:24-alpine`; `npm i -g prisma@6.16.1`; copy `src/prisma/schema` + `prisma.config.ts`; non-root user; `CMD ["prisma","migrate","deploy"]` (or `--schema src/prisma/schema`).
- Pin prisma version = `packages/prisma` devDep (`~6.16.1`). Note drift risk.
- Check: build image; `docker run` against throwaway Postgres, env ONLY `DATABASE_URL`. Expect: all migrations applied, exit 0, no shadow/engine error. Re-run → "already applied", exit 0 (idempotent).
- Commit: `build(prisma): add migrator image for prisma migrate deploy`

### Slice 2 — CI
- Do: add migrator build jobs (arm + amd, `file: packages/prisma/Dockerfile`, image `backend-docker-migrator`) to `.github/workflows/v3_backend-docker-{stg,prd}.yml`. Same triggers → lockstep tags with backend.
- Check: YAML parse; diff mirrors existing backend build jobs (registry, metadata-action tag derivation, permissions). True test = push.
- Commit: `ci(prisma): build and push migrator image`

### Slice 3 — Helm hook + values
- Do: `deploy/charts/klicker-uzh-v3/templates/job-migrate.yaml` — ArgoCD PreSync hook Job. Annotations: `hook: PreSync`, `hook-delete-policy: BeforeHookCreation,HookSucceeded`, `sync-wave: '-1'`. `envFrom` `-config-backend-graphql` + `-secret-backend-graphql` (holds DATABASE_URL). `restartPolicy: Never`, `backoffLimit: 1`, `activeDeadlineSeconds`, `ttlSecondsAfterFinished`. Guard: `.Values.migrator.enabled`.
- Do: base `values.yaml` `migrator:` block (enabled, image.repository `ghcr.io/uzh-bf/klicker-uzh/backend-docker-migrator`, pullPolicy, resources).
- Do: `env-uzh-prd/values.yaml` migrator overlay (`-arm` repo, pinned tag = backend tag). `env-uzh-stg/values.yaml` (`-arm`, tag `v3`).
- Check: `helm lint`; `helm template` per env → Job valid, annotations/image/envFrom correct; template with `migrator.enabled=false` → no Job.
- Commit: `deploy(helm): run prisma migrate deploy as ArgoCD PreSync hook`

### Slice 4 — Docs
- Do: update `docs/ci-and-deployment.md` (resolve open question, document hook + where migrations run). `docs/data-and-migrations.md` (deploy-time migration story; break-glass = `prisma:deploy:prod`). Note expand-contract constraint.
- Check: `pnpm run check:agents-md` (if it covers docs) / prettier on changed md.
- Commit: `docs(deploy): document automated migration hook, demote manual to break-glass`

## Independent review (slices 1-3, agy / Gemini 3.5 Flash High)

- F5 ACCEPTED (correctness): PreSync hook `envFrom` referenced Sync-phase ConfigMaps → fails on fresh install. Fix: reference ONLY the external `secret-backend-graphql` (holds DATABASE_URL; confirmed absent from all configmaps; provisioned out-of-band so present before any sync). Re-verified: helm template shows secretRef-only; image re-run applies 176 migrations.
- F2 minor cleanup ACCEPTED: `adduser -S -G nodejs -u 1001 prisma` (place user in group). Rejected as "build fails" — image built + ran twice.
- F1 REJECTED (false positive): `if: github.event.pull_request.draft == false` — existing backend prd jobs use identical `if` and build on tag-only push (no PR context). Mirrored working pattern.
- F3 REJECTED (false positive): `runs-on: ubuntu-24.04-arm` — existing backend build-arm uses same valid label.
- F4 REJECTED: base values unsuffixed `backend-docker-migrator` matches chart convention (base `backendGraphql` repo also unsuffixed, line 356); env overlays override to `-arm`.

## Finish gate

- Security review subagent ($security-review): Job secret handling, no creds in image/logs, no over-privilege.
- Maintainability review ($thermo-nuclear-code-quality-review).
- Independent branch review (agy/droid) if value.
- Draft PR via $rs-mr-description-writer. Conventional title (not feat — this is deploy/ci/build/docs). Likely `feat` NOT used; lead type `ci` or `build`... use accurate composite; PR title candidate: `build(deploy): automate DB migrations via ArgoCD PreSync hook`.
- ADR check: hook-based migration = arguably ADR-worthy (hard to reverse, trade-off vs manual). Decide at finish.

## Risks / notes

- Backward-compat: PreSync runs while OLD app still live → migrations must be expand-contract. Inherent, same as reference.
- Migrator prisma version must track `packages/prisma`. Drift → engine/schema mismatch. Mitigate: comment + note in docs.
- Failed hook blocks rollout by design. Ops must watch first few releases.
- Local Docker build in slice 1 = only heavy step; run in background.
