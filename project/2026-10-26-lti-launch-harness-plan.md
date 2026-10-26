# LTI launch harness

## Approval summary

**Why and what changes?** The LTI service (`apps/lti`, built on ltijs) can only be exercised against a real LMS today, so nobody can check locally how a launch behaves when `LTI_DEV_MODE` is off. With dev mode off, ltijs requires its state and session cookies during the launch. Browsers that block third-party cookies may drop those cookies when the LMS embeds KlickerUZH in an iframe. This package adds a local harness that answers that question with evidence:

- A mock LTI 1.3 platform that runs on the host, on a different site from `*.klicker.localhost`. It signs launch tokens, serves its key set, and starts launches in a top-level window or a cross-site iframe.
- Development-only platform registration values in `.devcontainer/devcontainer.env`, so the local LTI service registers the mock platform on startup.
- A separate Playwright configuration and spec that run real launches in Chromium, Chromium with third-party cookies blocked, Firefox and WebKit, and record where each launch ends.

**What stays unchanged?** LTI service code, the chart defaults, cookie options, and the CI Playwright manifests. The default Playwright suite and its global database setup are untouched; the harness uses its own configuration.

**What could change the decision?** The harness result decides a later change to `LTI_DEV_MODE` or the cookie strategy; this package makes no such change. Running the dev-mode-off case needs a restart of the local LTI process with a different environment value, documented in the harness README.

**How will we know it is done?** Both dev-mode cases have been run locally across the four browser projects, with results recorded in this plan's Progress section. The harness detects a browser project that silently allows third-party cookies when it should block them.

**What does approval authorize?** Implementation on `test/lti-launch-harness`, local verification against this worktree's devcontainer runtime, a push of that branch, and a draft PR into `v3`. It does not authorize CI wiring, marking ready, merging, or deployment.

## Execution details

- Execution mode: solo (main session). Requested directly by the user on 2026-10-26 after an advisor consultation; executable batch.
- Terminal condition: draft PR open with the recorded result matrix.

### Design

- Site boundary: the mock listens on `127.0.0.1:4311` on the host. A bare IP is its own site, so an iframe from it to `lti.klicker[.<workspace>].localhost` is cross-site in every browser. The browser uses `http://127.0.0.1:4311` for the launcher and authorization endpoint. ltijs fetches the key set server-side from inside the devcontainer through `host.docker.internal:4311`.
- Handshake: launcher → tool `/login` (`iss`, `login_hint`, `target_link_uri`, `client_id`, `lti_deployment_id`) → mock `/auth` → auto-submitted form POST of `id_token` and `state` to the tool → ltijs session redirect → KlickerUZH `onConnect` redirect to the PWA with `?jwt=`.
- Token: RS256 signed with `node:crypto`, `kid` matching the served key set, and the LTI 1.3 claims ltijs validates (message type, version, deployment id, target link URI, resource link, roles, nonce, `aud`). The custom claim `klicker_redirect_to` points to an HTTPS PWA URL.
- Outcome: a launch succeeds when the browser requests the PWA with the `jwt` parameter the LTI service appends. The spec also records whether the browser stored ltijs's session cookie on the tool host, which shows whether it blocked third-party cookies. The blocked-Chromium project enables the restriction through the DevTools protocol, because the `--test-third-party-cookie-phaseout` flag has no effect in Playwright's Chromium.

### Test portfolio

- LTI launch end to end in embedded and top-level contexts: add new (`playwright/lti-harness/lti-launch.spec.ts`), local-only. No existing test reaches ltijs.

### Slices

1. Mock platform, Playwright configuration and spec, devcontainer platform registration, README.
2. Local runs with dev mode on and off; results recorded below.

## Progress

- Status: implementation complete; draft PR pending.
- Local runs against this worktree's devcontainer, 2026-10-26:

  | `LTI_DEV_MODE` | Top-level launch | Cross-site iframe launch |
  | --- | --- | --- |
  | `true` | reaches the PWA in all four projects | reaches the PWA in all four projects |
  | `false` | reaches the PWA in all four projects | rejected with `MISSING_VALIDATION_COOKIE` in WebKit and in Chromium with third-party cookies blocked; reaches the PWA in default Chromium and Firefox |

- WebKit and the blocked Chromium project stored no tool cookie in the iframe; default Chromium and Firefox did. The LTI service log showed `event=lti_launch_redirect` for successful launches.
- The calibration check caught the ineffective launch flag on the first run, before the switch to the DevTools protocol.
- After switching dev mode back on, nodemon restarted the original LTI process. The confirmation run that followed could not start because `devrouter ensure` failed to reconcile the `oidc` service (`Managed Compose configuration changed for service 'oidc'`), which shares the app container's network. The runtime was stopped.
- Checks: `shellcheck` clean on the helper; Prettier applied to the new files; `tsc` for the Playwright package reports no errors in the harness files (one pre-existing error from the host's ungenerated Prisma client).
- Execution: main session. Final simplification and review: self-review over the full diff.
