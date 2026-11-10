# LTI service upgrade to ltijs 7

## Approval summary

**Why and what changes?** The LTI service (`apps/lti`) runs ltijs 5.9.9, which keeps the launch state and its session in cookies. Inside an LMS iframe, Safari and other browsers that block third-party cookies drop them. Production therefore runs with `LTI_DEV_MODE=true`, which skips the check that ties a launch to the browser that started it. ltijs 7 keeps the launch state in the browser's `localStorage` and needs no cookies. This package moves the service to ltijs 7.0.7 and removes dev mode:

- A PostgreSQL storage adapter for ltijs 7, which ships only MongoDB adapters. It uses new tables and encrypts the platform private keys with `LTI_ENCRYPTION_KEY`.
- A same-origin handoff route issues the KlickerUZH token and `lti-token` cookie, which ltijs 7 responses cannot set. Each launch can use it once.
- The launch harness covers ltijs 7, plus checks for cross-browser replay and handoff reuse.
- `LTI_DEV_MODE` and `LTI_AAS_MODE` leave the chart, the devcontainer and `turbo.json`, because ltijs 7 has neither mode.

**What stays unchanged?** The platform configuration (`LTI_URL` … `LTI_ADDITIONAL_PLATFORMS`), the routes platforms are registered with (`/login`, `/`, `/keys`), launch-target rules, and what every launch target receives: the redirect with `?jwt=`, the token's claims and 5-minute lifetime, and the `lti-token` cookie with its attributes. The LTI service also signs in users of other services, such as e-learning, so this output contract stays exactly as it is.

**What could change the decision?** ltijs 7 is six weeks old. Playwright's WebKit is not Safari, so a real Safari launch in OLAT on staging is the release gate. A new tool keypair is generated; KlickerUZH uses no LTI services that platforms verify with it. Recommendations: base on `v3-ai`, close #6723 and #6719.

**How will we know it is done?** The harness passes for top-level and iframe launches in Chromium, Firefox and WebKit, the replay checks reject, CI is green, and the final review has no open findings.

**What does approval authorize?** Implementation on `enhance/lti-ltijs-7-cookieless-launch`, pushes, a draft PR into `v3-ai`, and closing #6723 and #6719 with a comment pointing to it. It does not authorize marking ready, merging, deployment, or dropping the old ltijs 5 tables.

## Execution details

- Execution mode: solo (main session). Approval mode: executable batch.
- Tier: full path (authentication path, new dependency, new persistence). Final review with a security lens.
- Terminal condition: draft PR into `v3-ai` with green CI and the final review resolved.

### Evidence from the prototype

The prototype is commit `6c12698c0f`, after the cherry-picked harness commits from #6719. Local results on 2026-10-26 against this worktree's devcontainer, without dev mode:

| Browser | Top-level launch | Iframe launch |
| --- | --- | --- |
| Chromium | reaches the PWA | reaches the PWA |
| Firefox (Total Cookie Protection) | reaches the PWA | reaches the PWA |
| WebKit (blocks all third-party cookies) | reaches the PWA | reaches the PWA, no cookie stored |

- With ltijs 5 and dev mode off, the WebKit iframe launch failed with `MISSING_VALIDATION_COOKIE` (#6719).
- An `id_token` and `state` captured in one browser and posted from another browser are rejected with `INVALID_STATE`. ltijs 5 with dev mode on skips this check.
- Reusing a handoff URL after a launch returns 401.
- The PWA answers the launch redirect with 200 and receives a token with the same claims as before (`sub`, `email`, `scope: LTI1.3`, `iss`, 5-minute lifetime).
- The platform keyset stays the same across restarts. Stored private keys are encrypted, and the ltijs 5 tables are left untouched.
- ltijs 5 and 7 send the same `redirect_uri` to the platform: the target link URI without its query. The platform registrations stay valid.
- ltijs 7 renders two HTML pages with inline scripts inside the LMS iframe, where ltijs 5 only redirected. The chart sets no framing or CSP headers on the LTI host, and the LTI deployment has no HTTP probes.
- Nothing in the apps reads `/info` or calls the LTI service from a browser; `NEXT_PUBLIC_LTI_URL` appears only in environment files.

### Binding contracts

- Routes: `routes: { loginRoute: '/login', launchRoute: '/', keysetRoute: '/keys' }`. Platforms are registered with these paths.
- Startup registration reads the existing platform by URL and client ID and updates its fields; otherwise it registers it. Concurrent replicas keep the first stored record (`ON CONFLICT` upsert), so the served keyset stays stable.
- Schema creation runs in one transaction under a Postgres advisory lock, so replicas starting together cannot race on `CREATE TABLE IF NOT EXISTS`.
- Storage: tables `ltijs_platform`, `ltijs_access_token`, `ltijs_id_token`, `ltijs_nonce`, created at startup like ltijs-sequelize did. Expiry matches ltijs's MongoDB adapter: access tokens 1 hour, nonces 10 minutes, id tokens 24 hours. Nonce and handoff consumption are single `DELETE` statements, so concurrent requests cannot both succeed.
- `LTI_ENCRYPTION_KEY` encrypts private keys (AES-256-GCM, SHA-256-derived key). Rotating it makes stored keys unreadable, so rotation requires dropping `ltijs_platform` and letting startup register again.
- Handoff: `onConnect` validates the launch target and redirects to `/handoff?ltik=…` (plus `redirectTo` when the target came from the query). `/handoff` resolves the launch, consumes its id token if the launch is at most 5 minutes old, validates the target again, signs the JWT, sets `lti-token` and redirects to the target with `?jwt=`. Helmet sends `Referrer-Policy: no-referrer`, and the handoff sets `Cache-Control: no-store`.
- The handoff keeps the `lti-token` cookie because consumers depend on it. The PWA reads it before `?jwt=` and uses its presence to decide whether cookies work in the current context; Chat uses it the same way. Other services that use the LTI service for sign-in may read it too.
- `/handoff` consumes the launch before it validates the target again, so a tampered `redirectTo` uses up the launch. This is intentional: the launch cannot be retried with another target.
- CORS is off; no browser calls the LTI service cross-origin. The unused `/info` route is dropped.
- ltijs 7 depends on `mongoose`, `ioredis` and Express 5, which load at startup although only the PostgreSQL adapter is used. The ltijs-sequelize tree (sequelize, old axios and got, database drivers for MariaDB, MySQL and SQL Server) leaves the image.

### Test portfolio

- LTI launch in top-level and iframe contexts across Chromium, Firefox and WebKit: extend existing (`playwright/lti-harness/lti-launch.spec.ts`). WebKit is the blocking browser; its iframe run asserts that no tool cookie was stored. The DevTools-based blocked-Chromium project is removed, because Chromium applies that restriction only to some of a cross-site iframe's navigations.
- Launch replayed from another browser is rejected: add new (same spec), the browser binding dev mode gave up.
- Handoff URL works once: add new (same spec).
- Launch-target and platform-config rules: existing `apps/lti/tests` and `launchTarget.ts` behavior, unchanged.

### Slices

1. Service on ltijs 7: dependencies, PostgreSQL adapter, handoff route, registration. Prototype commit, then cleanup: the advisory lock, a startup log with the real port instead of ltijs's banner (which reports its default port), and a comment on the handoff order.
2. Harness: ltijs 7 reporting, WebKit calibration, replay checks, README without the dev-mode switch. The mock platform asserts the exact `redirect_uri` and can render its iframe with a `sandbox` attribute, so a staging finding can be reproduced locally. `restart-lti.sh` is removed: it existed to switch dev mode.
3. Configuration: remove `LTI_DEV_MODE` and `LTI_AAS_MODE` from both charts, `.devcontainer/devcontainer.env` and `turbo.json`. Update `docs/auth-model.md`. Re-audit the `pnpm-workspace.yaml` overrides whose consumers left with ltijs-sequelize (`axios@<=0.31.1` for adal-node, the `mysql2` comment) with the `klicker-dependency-overrides` skill.

### Verification

- Harness and replay checks from the host against this worktree's runtime.
- `apps/lti` typecheck, unit tests and build in the container. The commit hook runs `check:all`, and the push hook runs the build.
- CI on the draft PR.
- The host Playwright runner refuses to start while host dependencies lag the changed lockfile. The harness runs through the Playwright CLI with the host-runner marker and the workspace `URL_STUDENT` instead. A host `pnpm install` is not part of this package.

### Follow-ups outside this package

- A staging deployment and a real Safari, Chrome and Firefox launch in OLAT, inside the course iframe. This is the gate before production. It includes a sign-in to at least one service outside KlickerUZH that uses the LTI service. The environment's LTI ingress must route the new `/handoff` path. It also confirms that the environment adds no framing headers on the LTI host, and that OLAT's iframe allows same-origin scripts: a `sandbox` attribute without `allow-same-origin` blocks `localStorage`, and OLAT offers no postMessage storage fallback.
- Dropping the ltijs 5 tables (`platforms`, `idtokens`, `nonces`, `accesstokens`, `contexttokens`, `privatekeys`, `publickeys`, `states`, `platformStatuses`, `SequelizeMeta`) once production runs ltijs 7. The service imports the platforms from the ltijs 5 `platforms` table at startup, so the table must stay until every environment has started ltijs 7 at least once.
- Whether Chat and PWA sessions after the launch work in Safari iframes. That layer sets its own cookies and is not part of the LTI launch.

## Progress

- 2026-10-26: plan approved by the user ("first we should care about the upgrade and verification and finalizing these PRs"). Deep Linking, one-time launch codes, asymmetric token signing and Dynamic Registration are tracked in the KlickerUZH Someday Backlog in ClickUp.
- 2026-10-26: approach discussed with the advisor, prototype implemented and verified locally (see Evidence), then this plan reviewed with the advisor and its findings folded in.
- Substantive size so far, outside the lockfile: the ltijs 7 commit adds 402 and removes 154 lines; with the harness from #6719, the branch adds 1004 and removes 105 lines against `v3-ai`.
- 2026-10-26: slice 1 cleanup (`6faae94010`), slice 2 harness (`df13a0ac0b`) and slice 3 configuration done. The harness passes in Chromium, Firefox and WebKit, including both replay checks. The override audit marks only `axios@<=0.31.1` as made obsolete by this change; it is dropped with a one-line lockfile change. The audit reports six further overrides as no-ops on the base branch already (`glob`, three `brace-expansion` lines, `fast-uri`, `sharp`); they are left for a separate change. The `klicker-uzh-v2` chart directory keeps its LTI keys, because this package does not deploy through it.
- 2026-10-26: final review (delegated, security lens) found nothing blocking. Fixed: a pool error listener so a dropped idle database connection no longer exits the service, a retry when another replica registers a platform between lookup and insert, the startup failure log now names the cause, and the unused `LTI_DB_TYPE` and `LTI_DB_CONNECTION_STRING` settings are removed. Harness 8/8 and LTI unit tests pass after the fixes.
- 2026-10-26: external review follow-ups. The harness opens a seeded course page and requires a signed-in participant (top-level launches and the WebKit iframe; the development PWA's `SameSite=Lax` session cookie cannot be stored in Chromium and Firefox iframes). It reads the `lti-token` cookie from the PWA's first request, because the PWA deletes it after signing in, and it launches once through a `redirectTo` query instead of the custom claim. A handoff URL now works only within 5 minutes of the launch, and an undecryptable platform key fails with a clear cause. A manual iframe launch in Safari on macOS signed the participant in. The deployments run ltijs 5 in its PostgreSQL mode with a dedicated database, so the externally managed secret already provides the `LTI_DB_*` settings this build reads.
- 2026-10-26: review follow-ups. `/handoff` logs `event=lti_handoff_rejected` for each rejection, returns a JSON 500 when consuming the launch fails, and a failed schema rollback no longer hides the startup error.
- 2026-10-27: merged (#6728), synced to staging (#6742) and promoted. A staging launch from an OLAT course element failed with `UNREGISTERED_PLATFORM`: ltijs 5 had kept platforms registered under an earlier configuration in its own table, and ltijs 7 registered only the configured ones. The service now also registers the active platforms from the ltijs 5 `platforms` table at startup; the configuration wins for the same issuer and client ID. A local launch through a platform known only to that table completes the handoff; a deactivated one is skipped.
