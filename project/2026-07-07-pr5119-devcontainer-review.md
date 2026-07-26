# Review — PR #5119: self-contained devcontainer + devrouter local dev (Phase 1)

- **Date:** 2026-07-07
- **Reviewed state:** branch `feat/devcontainer-devnet` @ `c324d30c8` (deep review performed at `90fd0b21e`, then every finding re-verified file-by-file against `c324d30c8` after the Phase-2/localhost-mode rework landed)
- **Review method:** full diff read, backend/auth middleware trace on this branch, multi-agent review (security dimension adversarially verified), CI/comment history audit. Every finding below carries the evidence that was actually checked — nothing is speculation from the diff alone.

## Verdict

**Mode 2 (devrouter) is solid and was end-to-end verified by the author — but the PR is not mergeable yet.** Mode 1 (plain localhost — the documented *default*) has a broken login flow with two independent causes, and the port-publishing restructure silently invalidated the PR's own "nothing is published on the host" security model in *both* modes. Both are fixable with small, local changes listed below.

---

## Blockers (fix before merge)

### B1 — Mode 1 (plain localhost) auth is broken: two independent causes

Greptile flagged one of these; we verified it against the actual middleware code and found a second, independent break in the auth app.

**Cause A — backend never reads the session cookie.**
[apps/backend-docker/src/app.ts:84-100](../apps/backend-docker/src/app.ts) resolves which cookie to read by substring-matching the request `Origin` header:

```ts
if (req.headers.origin?.includes(process.env.APP_MANAGE_SUBDOMAIN ?? 'manage') || ...) {
  token = req.cookies?.['next-auth.session-token']
} else if (req.headers.origin?.includes(process.env.APP_STUDENT_SUBDOMAIN ?? 'pwa')) { ... }
```

The Mode 1 fallback block in [.devcontainer/post-start.sh](../.devcontainer/post-start.sh) (the `if [ ! -f /etc/devrouter/mkcert-rootCA.pem ]` branch) overrides `APP_ORIGIN_*`, `NEXT_PUBLIC_*`, `NEXTAUTH_URL`, `COOKIE_DOMAIN` — but **not** `APP_MANAGE_SUBDOMAIN` / `APP_STUDENT_SUBDOMAIN` / `APP_CONTROL_SUBDOMAIN`. They keep their `devcontainer.env` values (`manage.klicker.localhost` etc.), so a browser `Origin: http://localhost:3002` matches nothing, no cookie is read, and every authenticated GraphQL call silently returns unauthenticated data. Login *appears* to work; the dashboard never loads.

**Cause B — auth app rejects the redirect host.**
[apps/auth/src/middleware.ts](../apps/auth/src/middleware.ts) (`isAllowedHost`) does **exact** host matching (`parsed.host === domain || endsWith('.' + domain)`). `devcontainer.env` sets:

```
AUTH_LECTURER_ALLOWED_HOSTS=manage.klicker.localhost,127.0.0.1:3002
```

Mode 1 URLs use `localhost:3002`, which is **not** `127.0.0.1:3002` under exact matching — the lecturer redirect back to manage is rejected even if Cause A were fixed.

**Fix (junior-executable):** in the Mode 1 fallback block of `post-start.sh`, add:

```bash
export APP_MANAGE_SUBDOMAIN=localhost:3002
export APP_CONTROL_SUBDOMAIN=localhost:3003
export APP_STUDENT_SUBDOMAIN=localhost:3001
export AUTH_LECTURER_ALLOWED_HOSTS=localhost:3002,127.0.0.1:3002
export AUTH_STUDENT_ALLOWED_HOSTS=localhost:3001,127.0.0.1:3001
```

(The `includes()` substring check makes `localhost:3002` safe: it cannot collide with the other two ports.)

**How to verify:** `devpod up .` on a machine *without* devrouter → open `http://localhost:3002` → login `lecturer`/`abcd` → the dashboard must show Library/Activities/Courses. In devtools → Network, confirm GraphQL responses contain real (non-null) user data. Repeat for the PWA at `http://localhost:3001` with `testuser1`/`abcdabcd`.

### B2 — All service ports are published on `0.0.0.0`, in **both** modes, contradicting the PR's own security model

The consolidation moved port publishing into the base [.devcontainer/docker-compose.yml](../.devcontainer/docker-compose.yml): postgres `5432:5432`, mailhog `8025`, hatchet `8888` + `7077`, litellm `4000`, app `3000-3004/3010/3030/7078`. Without an explicit bind address, Compose publishes on **all interfaces**.

Two consequences, both verified:

1. **Security:** on a shared or cloud devpod host, a Postgres with the known password `klicker`, a Hatchet dashboard running with `SERVER_AUTH_COOKIE_INSECURE: 't'` / `SERVER_GRPC_INSECURE: 't'`, MailHog, and every app become reachable by anyone who can route to that VM.
2. **Doc drift:** the overlay [docker-compose.devrouter.yml](../.devcontainer/docker-compose.devrouter.yml) only *adds* networks/hosts/volumes — Compose **concatenates** `ports:` lists across files, it never removes them. So the "NO published host ports" / "nothing is published on the host" claims in `.devrouter.yml` (header), `.devcontainer/README.md` (intro + "How routing works"), and `AGENTS.md` are now false **even in Mode 2**. This also means Mode 2 on a host running devrouter may hit a hard bind conflict on `:5432` (devrouter fronts Postgres on the shared host `:5432`; docker will refuse to start the stack if both bind) — the author's Mode 2 e2e verification passed, so re-test this specific case on a host with devrouter's Postgres route active.

**Fix (choose one; the second is cleaner):**

- *Minimal:* prefix every `ports:` entry in the base compose with `127.0.0.1:` (e.g. `'127.0.0.1:5432:5432'`). Removes the network exposure in both modes; does **not** resolve a same-port bind conflict with devrouter on the loopback interface — test Mode 2 with devrouter running.
- *Structural:* move all `ports:` blocks out of `docker-compose.yml` into a new `docker-compose.ports.yml` overlay (loopback-bound). Mode 1 = `["docker-compose.yml", "docker-compose.ports.yml"]` (default in `devcontainer.json`), Mode 2 = `["docker-compose.yml", "docker-compose.devrouter.yml"]`. This restores the true "zero published ports" property of Mode 2 and eliminates the collision class entirely.

Then reconcile the three docs so the "nothing published" claim is only made where it is true, and add one warning line to the README's Mode 1 section about shared/cloud VMs.

**How to verify:** `docker compose -f docker-compose.yml [-f overlay] config | grep -A3 ports` shows `127.0.0.1` bindings (or no ports in Mode 2); on the host, `ss -tlnp | grep -E '5432|8888'` shows no `0.0.0.0`/`::` listeners; Mode 2 boots cleanly while devrouter is up.

---

## Major

### M1 — Toolchain pins drift from the repo's single source of truth

Repo pins on this very branch: `package.json` → `engines.node "=24"`, `volta.node 24.16.0`, `packageManager pnpm@11.5.0`. The devcontainer ships **Node 20 + pnpm 10.15.0**:

- [.devcontainer/Dockerfile](../.devcontainer/Dockerfile): `FROM node:20-bookworm-slim`, `npm install -g pnpm@10.15.0` — the comment "Mirror the repo's packageManager pin" is now false.
- README/AGENTS.md say "Node 20 + pnpm toolchain".

Every `pnpm` invocation inside the container emits `Unsupported engine: wanted {"node":"=24"}`, and natives are built for a Node major the repo doesn't declare.

**Fix:** `FROM node:24-bookworm-slim`, `pnpm@11.5.0`, update the two doc mentions. Longer term (see roadmap), derive both from `package.json` in CI so this cannot drift again.

### M2 — `litellm` service defined but never started in VS Code

`litellm` exists in `docker-compose.yml` and in the README's "What's inside" table, but is missing from `runServices` in [.devcontainer/devcontainer.json](../.devcontainer/devcontainer.json) — VS Code only starts the listed services, so Tier-3 chat can never reach its LLM proxy there (devpod behavior is implementation-dependent). **Fix:** add `litellm` to `runServices` (it idles cheaply without an upstream key), or remove it from the base file and document it as devrouter/manual-only.

### M3 — Mode 1 host port 4000 is litellm, but the docs say it is the LTI service

`LTI_PORT=4000` runs inside the `app` container, whose published port list (`3000-3004`, `3010`, `3030`, `7078`) does **not** include 4000 — while the separate `litellm` service publishes `4000:4000` on the host. So in Mode 1, `http://localhost:4000` reaches **litellm**, not LTI, even though the `post-start.sh` banner and `APP_ORIGIN_LTI=http://localhost:4000` both point users there. `forwardPorts: [... 4000 ...]` in `devcontainer.json` makes it worse: VS Code will try to forward the app container's 4000 onto a host port litellm already occupies.

**Fix:** move one of the two off port 4000 — simplest is litellm to `4001:4000` (host:container; the in-network URL apps use stays `litellm:4000`) and publish `4000:4000` on the `app` service for LTI. Update the banner/env accordingly. **Verify:** in Mode 1, `curl -s localhost:4000` returns the LTI service response, not litellm's.

---

## Minor / hygiene

- **GitGuardian red check has no auditable suppression.** The committed placeholders (`APP_SECRET=abcd`, postgres `klicker`) are a defensible false positive — same values already sit in `apps/backend-docker/.env.example` on `v3`, and nothing bakes them into an image (`env_file` is runtime-only; verified no `ENV`/`ARG` in the Dockerfile). But a permanently red check trains reviewers to ignore red. Add a narrowly-scoped `.gitguardian.yaml` (per-secret `matches-ignore`, not a whole-path ignore) so the check goes green through an auditable rule.
- **`LTI_ENCRYPTION_KEY=abcdabcd...` has the shape of a real key** — add an inline `# dev-only placeholder, never reuse` comment to reduce copy-paste-into-prod risk.
- **`version: '3.8'`** in `docker-compose.devrouter.yml` is obsolete (Compose v2 warns); drop it.
- **`mailhog/mailhog:latest`** — pin a tag for reproducibility (low priority).
- `.gitignore` coverage for the runtime-minted `.devcontainer/.hatchet.env` is correct — checked, nothing else the scripts generate can be accidentally committed.

## What is genuinely good (keep)

- The Mode 2 path was verified end-to-end on a clean `devpod up` with zero manual steps — rare and valuable.
- `post-create.sh`/`post-start.sh` are unusually well-engineered: `retry()` helper, explicit `exit 1` with an actionable message when the Hatchet token never appears, empty-`.env` seeding for `tsx --env-file`, no-TTY pnpm hardening, double-start guard.
- The `hatchet_token` sidecar (DATABASE_URL override to escape hatchet-lite's internal-Postgres config) is documented in-place with the *why* — exactly the standard the repo should hold.
- GOTCHAS cross-references make the scripts teachable for juniors and agents.

---

## Remaining steps toward production readiness (ordered)

1. **Fix B1 + B2, re-verify both modes** (checklists above). This is one small PR-update; everything else can follow.
2. **Add a devcontainer smoke job to CI** — the stack currently only breaks when a human next boots it. A weekly (or `.devcontainer/**`-path-filtered) workflow using `devcontainers/ci`: build the container, run `post-create.sh`, then assert `curl -sf localhost:3000/api/graphql` + a seeded-login GraphQL mutation. Without this, every future dependency bump can silently kill onboarding.
3. **Single source of truth for toolchain pins** — a tiny CI step (or extend `util/check-agents-md.mjs`-style smoke checks from PR #5140) that greps the Dockerfile's node/pnpm versions against `package.json` `volta`/`packageManager` and fails on mismatch.
4. **Decide the Codespaces story** — `extra_hosts: host-gateway` and mkcert mounts don't exist there; with B1 fixed, Mode 1 becomes the honest Codespaces default. Test once, document the result in the README scope note.
5. **Prebuild + cache** — publish the devcontainer image (GH Container Registry) from CI so first boot skips the image build; consider a pnpm-store cache volume warmed by the prebuild.
6. **Finish Phase 2 verification** — the branch now includes Tier 1 (olat-api, response-api, workers) and Tier 2/3 (lti, chat) in `turbo dev`, but chat needs litellm actually running (M2) and LTI needs a reachable Mode-1 port (M3); do one clean-boot verification per tier. Then revisit the analytics "SKIP" — PR #5140 introduces a uv-based toolchain for `apps/analytics`, which makes an analytics tier feasible now.
7. **Deduplicate docs** — README, AGENTS.md, and `.devrouter.yml` header repeat the same tables/claims; B2 showed they already drifted apart once. Keep the README canonical; make the other two link to it.
8. **Close PR [#3928](https://github.com/uzh-bf/klicker-uzh/pull/3928)** — the 2023 "initialize dev containers" draft is fully superseded by this PR (same 4 files, older approach).

## Re-review checklist for the next push

- [ ] Mode 1: lecturer + student login E2E works (B1)
- [ ] `docker compose config` shows loopback-bound or unpublished ports in both modes (B2)
- [ ] Mode 2 boots while devrouter is running (no `:5432` bind conflict)
- [ ] Dockerfile node/pnpm match `package.json` volta pins (M1)
- [ ] `litellm` starts under VS Code or is documented out (M2)
- [ ] Mode 1: `localhost:4000` reaches LTI, litellm relocated (M3)
- [ ] README / AGENTS.md / `.devrouter.yml` port claims match reality
- [ ] GitGuardian green via committed ignore rule, not ignored-red
