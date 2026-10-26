# LTI launch harness

Runs real LTI 1.3 launches against the local LTI service (`apps/lti`, built on
ltijs) without an external LMS. It shows whether a launch reaches the PWA in a
top-level window and inside a cross-site iframe, for each browser and for both
values of `LTI_DEV_MODE`.

## How it works

`mockPlatform.ts` is a minimal LTI platform. It listens on
`http://127.0.0.1:4311` on the host. A bare IP is a different site from
`*.klicker.localhost`, so its iframe launch is cross-site, like a course page in
an LMS. The platform:

- starts the launch with a form POST to the tool's `/login`,
- answers ltijs's authorization request with a signed `id_token`, and
- serves its key set at `/jwks`.

The LTI service registers this platform on startup from the `LTI_*` values in
`.devcontainer/devcontainer.env`. ltijs fetches the key set from inside the
devcontainer through `host.docker.internal:4311`.

A launch counts as successful when the browser requests the PWA with the `jwt`
parameter that the LTI service appends. The test also records whether the
browser stored ltijs's session cookie on the tool host. That shows whether the
browser kept third-party cookies in the iframe.

The `chromium-third-party-cookies-blocked` project turns on Chromium's
third-party cookie restriction through the DevTools protocol
(`Network.setCookieControls`). The `--test-third-party-cookie-phaseout` launch
flag does not block them in Playwright's Chromium. The project's iframe test
fails if Chromium still stores the tool's cookies, so a restriction that stops
working is noticed.

## Run it

The harness has its own Playwright configuration and no global setup. It does
not reset or seed the database.

1. Install the extra browsers once:

   ```bash
   pnpm --filter @klicker-uzh/playwright exec playwright install firefox webkit
   ```

2. Run the harness against the LTI service's current mode (`LTI_DEV_MODE=true`
   by default):

   ```bash
   LTI_HARNESS_DEV_MODE=true node util/run-playwright-host.mjs \
     --runtime-profile full -- --config lti-harness.config.ts
   ```

3. Switch the LTI service to `LTI_DEV_MODE=false` and run again with
   `LTI_HARNESS_DEV_MODE=false`. See [Switching dev mode](#switching-dev-mode).

`LTI_HARNESS_DEV_MODE` only labels the run. It must match the value the running
LTI service uses.

For a manual launch, run the platform alone and open the printed URL:

```bash
node playwright/lti-harness/mockPlatform.ts
```

For a linked worktree, whose hosts include the workspace name, set
`LTI_HARNESS_TOOL_ORIGIN` and `LTI_HARNESS_REDIRECT_TARGET` for this manual run.
The spec derives both from the PWA URL the host runner provides.

## Switching dev mode

The dev stack runs the LTI service under nodemon with the container
environment. `set-lti-dev-mode.sh` restarts only that process with a different
`LTI_DEV_MODE` and keeps every other variable, including the per-workspace
origins:

```bash
devrouter exec . -- bash playwright/lti-harness/set-lti-dev-mode.sh false
devrouter exec . -- bash playwright/lti-harness/set-lti-dev-mode.sh true
```

`false` stops the nodemon child and starts the same command in the background
with `LTI_DEV_MODE=false`. Its output goes to `/tmp/lti-dev-mode-override.log`
in the container. `true` stops that override and touches the build output, so
nodemon starts the original process again. Restarting the runtime also restores
the original value.

## Reading the result

Each test prints one `[lti-launch]` line with the project, dev mode, embedding,
whether the launch reached the PWA, the LTI service's error message if it
rejected the launch, and whether the browser stored the tool's session cookie.
With dev mode off, ltijs rejects a launch whose state cookie the browser did not
send with `MISSING_VALIDATION_COOKIE`.
