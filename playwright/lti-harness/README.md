# LTI launch harness

Runs real LTI 1.3 launches against the local LTI service (`apps/lti`, built on
ltijs 7) without an external LMS. It shows whether a launch reaches the PWA in a
top-level window and inside a cross-site iframe, for each browser, and checks
that a launch cannot be replayed.

## How it works

`mockPlatform.ts` is a minimal LTI platform. It listens on
`http://127.0.0.1:4311` on the host. A bare IP is a different site from
`*.klicker.localhost`, so its iframe launch is cross-site, like a course page in
an LMS. The platform:

- starts the launch with a form POST to the tool's `/login`,
- answers ltijs's authorization request with a signed `id_token`, after
  checking that the `redirect_uri` is exactly the target link URI without its
  query, as a platform does, and
- serves its key set at `/jwks`.

The LTI service registers this platform on startup from the `LTI_*` values in
`.devcontainer/devcontainer.env`. ltijs fetches the key set from inside the
devcontainer through `host.docker.internal:4311`.

ltijs 7 keeps the launch state in the browser's `localStorage`, not in cookies.
A launch counts as successful when the browser requests the PWA with the `jwt`
parameter that the LTI service appends. The test also records whether the
browser stored the `lti-token` cookie the LTI service sets, which shows whether
the browser kept third-party cookies in the iframe.

WebKit blocks all third-party cookies, like Safari, so it is the blocking
browser here: its iframe test fails if the tool's cookie was stored anyway.
Chromium's DevTools cookie restriction (`Network.setCookieControls`) cannot
stand in for a blocking browser, because it misses navigations that a
cross-site iframe starts itself. Firefox runs with its release default, Total
Cookie Protection, which Playwright's Firefox build turns off.

Two further tests, run in Chromium only, check the server side:

- an `id_token` and `state` captured in one browser and posted from another are
  rejected with `INVALID_STATE`, and
- the handoff URL that issues the KlickerUZH token works only once.

## Run it

The harness has its own Playwright configuration and no global setup. It does
not reset or seed the database.

1. Install the extra browsers once:

   ```bash
   pnpm --filter @klicker-uzh/playwright exec playwright install firefox webkit
   ```

2. Run the harness:

   ```bash
   node util/run-playwright-host.mjs --runtime-profile standard -- \
     --config lti-harness.config.ts
   ```

For a manual launch, run the platform alone and open the printed URL:

```bash
node playwright/lti-harness/mockPlatform.ts
```

For a linked worktree, whose hosts include the workspace name, set
`LTI_HARNESS_TOOL_ORIGIN` and `LTI_HARNESS_REDIRECT_TARGET` for this manual run.
The spec derives both from the PWA URL the host runner provides.

To reproduce an LMS that renders its iframe with a `sandbox` attribute, set
`LTI_HARNESS_IFRAME_SANDBOX` to the attribute value for a manual run. Without
`allow-same-origin`, the tool cannot use `localStorage` and the launch fails.

## Reading the result

Each launch test prints one `[lti-launch]` line with the project, the embedding,
whether the launch reached the PWA, the LTI service's error message if it
rejected the launch, and whether the browser stored the tool's cookie, either
as an ordinary cookie or as a partitioned (CHIPS) cookie.

Launches open the seeded Testkurs course page as `testuser50`: the mock learner's
email links its LTI identity to that participant on the first launch. The test
then requires a signed-in participant, by the PWA's session cookie or, when the
browser blocks cookies in the iframe, by its `sessionStorage` token. Chromium and
Firefox iframes skip this check, because the development PWA sets its session
cookie with `SameSite=Lax`, which a cross-site iframe cannot store.
