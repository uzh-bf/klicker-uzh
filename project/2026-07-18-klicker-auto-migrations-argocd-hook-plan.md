# Plan: Auto-run DB migrations via ArgoCD PreSync hook

## Identity

- Plan path: `project/2026-07-18-klicker-auto-migrations-argocd-hook-plan.md`
- Branch: `claude/klicker-auto-migrations-90b73c`
- Target: `v3`
- PR: none yet
- Reference pattern: `~/Git/tc/{elearning,careers}/deploy/{stg,prd}/migration-job.yaml` (ArgoCD PreSync migration Job)

## Goal

Migrations run automatically as ArgoCD `PreSync` hook Job before each stg/prd rollout. New app never boots on unmigrated DB. Retire manual laptop-run `prisma:deploy:prod` (keep as break-glass).

## Non-goals

- Boot-time data-migration runner (`apps/backend-docker/src/migration.ts`) — untouched (currently empty list, separate concern).
- standard-version release flow — unchanged.
- Auto-bump of image tags — still manual per-release (same as today); migrator tag bumped alongside backend tag.

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

R2. Migrator image must carry: prisma CLI + migration (schema) engine binary + `src/prisma/schema` (177 migrations) + `prisma.config.ts`. Needs `DATABASE_URL` only at deploy time.
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
- [x] Finish gate — reviews done.
  - Security ($security-review): PASS. 0 HIGH-confidence findings. Traced: no creds baked in image / logged, non-root, exec-form CMD; GH Actions use only trusted server-controlled interpolations (no untrusted event body in run:/ref:), scoped `contents:read`/`packages:write`; images exact-pinned. 3 defense-in-depth NOTES (not blocking): (1) Job `envFrom` inherits full backend secret not just DATABASE_URL — accepted (secret provisioned out-of-band, blast radius = backend's); (2) actions tag-pinned not SHA — matches repo convention; (3) `npm i -g` transitive deps unlocked — same as backend image.
  - Maintainability: `$thermo-nuclear-code-quality-review` is slash-only (`disable-model-invocation`) → USER must run `/thermo-nuclear-code-quality-review`. Ran equivalent independent review via agy (Gemini 3.5 Flash High): 4 findings, ALL rejected with evidence — prisma version pin (exact > `~6.16.1` range), no-cache arm-only (mirrors backend jobs exactly), resources `{{- with }}` (chart renders unguarded at deployment-app.yaml:67), custom user (cosmetic, both non-root). Clean.
  - ADR: DECIDED AGAINST standalone `docs/adr/`. Repo has no ADR convention; its documented pattern puts architectural decisions in the engineering wiki (`docs/`). Rationale captured in wiki + this plan's Research (R1/R2).
- [ ] Draft PR — via $rs-mr-description-writer.

Current slice: Finish gate complete. Next: create draft PR.

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
