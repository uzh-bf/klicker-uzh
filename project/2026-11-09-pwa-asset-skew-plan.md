# PWA asset skew during rollouts

## Approval cards

### Card 1 — Withdraw step 1 (#6831)

- **Proposal:** close draft #6831 unmerged and delete its branch.
- **Why:** design A′ below serves the static files of every retained
  release, so a release-specific build ID no longer matters. #6831 adds two
  risks instead:
  - Next.js appends `?dpl=<id>` to asset URLs. Workbox ignores only
    `utm_*` and `fbclid` parameters by default, so the PWA service worker's
    precache can miss and the offline PWA can lose cached assets.
  - `ENV NEXT_DEPLOYMENT_ID` sits before the source copy in the Dockerfile,
    so every commit invalidates the cached PWA build layer.
- **Kept:** the `deploymentId` reload behaviour can return later as its own
  change if A′ leaves a gap, with the Workbox parameter setting.

### Card 2 — Release asset service (design A′)

- **Outcome:** during and after a rollout, every `/_next/static` request for
  the current or a retained release returns 200, so pages never load with
  missing scripts or styles.
- **Design:** a second Deployment per PWA host (PWA and assessment) runs the
  release's own PWA image. That image also carries the static files of the
  previous releases. The ingress routes `/_next/static` to it, and an Argo
  sync wave deploys it before the PWA Pods.
- **Effects:** one more Deployment per PWA host in staging and production;
  a larger PWA image; a CI step that copies earlier static files into the
  build; a new ingress path. No new images, registries, external resources
  or credentials.
- **Limitation:** a rollback deploys an older asset set that lacks the
  newer release's files. A rollback reopens the window until the next
  forward release; reverts should roll forward.
- **Authority requested:** a bounded prototype (A0), then implementation on
  draft PRs. Merging each PR and its staging sync stays a separate go, and
  production enablement is a separate go after the staging drills pass.
- **Terminal:** the staging drills in Verification pass and are recorded
  here.

## Problem

The staging rollout drill on 2026-11-09 (W12 plan, E4.5) returned 36 asset
404s within six seconds of a PWA rollout. Each PWA Pod serves `/_next/static`
from its own image. While old and new Pods both serve, a page from one release
can send its asset requests to a Pod of the other release. After a rollout,
a long-lived old page that loads a lazy chunk finds only new Pods; the
service worker's `skipWaiting` makes that more likely.

Two kinds of paths change between releases: the build-ID directory
`/_next/static/<buildId>/`, and content-hashed chunks whose source changed.

## Design A′ — release asset Deployment

- **A0 prototype (first, local):** run a staging PWA image with the static
  files of an older staging image copied into `.next/static`, and request
  files of both build IDs. Pass: both return 200 with immutable caching. If
  the standalone server refuses foreign build-ID files, fall back to
  design A (a separate static file server image).
- **Image:** the PWA Dockerfile gains a build stage that copies
  `.next/static` from the previously deployed image of the same target
  (staging: the image at the current `stg-release` SHA; production: the
  image of the pinned release tag in the production values). A per-build-ID
  manifest lists each release's files; the build keeps at least the last
  five releases regardless of age. Chains stay per target, so PWA and
  assessment never mix.
- **Bootstrap:** the first build seeds from the deployed image, so the
  first rollout is already covered.
- **Deployment:** `<release>-frontend-pwa-assets` with the PWA image and
  tag precedence, `RollingUpdate` with `maxUnavailable: 0`, a readiness
  probe on a known static file, two replicas and a PDB in production, one
  in staging. Argo sync wave `-1`; Argo waits for its health before the PWA
  Deployments change. The migrate Job is a PreSync hook, so the waves do not
  collide.
- **Routing:** the PWA and assessment ingress templates gain a per-path
  backend. `/_next/static` (`Prefix`) goes to the asset Service; `/` keeps
  the PWA Service. Verify in A0 or on staging that HAProxy matches the
  longer prefix first; existing `/` paths use `ImplementationSpecific`.
- **Alerting:** a stuck asset rollout blocks the PWA rollout, so Argo's
  degraded state must surface in the existing alerts.

## Design B — Blob Storage with `assetPrefix` (not recommended)

CI uploads `.next/static` per build to a container per environment, and
`assetPrefix` points the PWA at it. It needs a storage container with public
read or a CDN, a GitHub Actions federated credential with write access, CORS
for fonts, and a check of the service worker's cross-origin precache. None of
these exist today.

## Rejected alternatives

- Baking the previous release's static files into the PWA image only covers
  an old page reaching a new Pod, not a new page reaching an old Pod.
- HAProxy `retry-on 404` with redispatch lowers the rate but cannot promise
  zero.
- Cookie stickiness conflicts with per-request balancing, which the burst
  tier needs.

## Verification

- Render checks with `helm template` for staging and production values.
- Drill script: `util/load-test/pwa-burst.js` from #6805 (branch
  `rs/w12-e3-load-drill`), which already follows each page's assets and
  logs failed requests with their status. Extend it to fetch the previous
  build's asset list after the rollout.
- Staging drills:
  1. Rollout with a PWA code change: 0 asset 404s; Argo timestamps show the
     asset Deployment healthy before PWA Pods change; a response header
     proves `/_next/static` reached the asset service.
  2. Previous-release assets after the rollout: 200.
  3. Rollback drill: record the expected window (Card 2 limitation).
- Service worker check in a browser: precache and offline start still work.

## Progress

- 2026-11-09 Step 1 implemented in #6831 (draft). The plan critique led
  to proposing its withdrawal in favour of A′.
- 2026-11-09 #6831 closed and its branch deleted (user approved).
- 2026-11-09 A0 pass, locally on two consecutive staging PWA images whose
  PWA source was identical: copying the older image's `.next/static` into
  the newer image let the standalone server serve both releases' build
  manifests and both releases' `_app` chunks with 200 and
  `public, max-age=31536000, immutable`; an unknown path still returned 404.
  The two builds differed in 4 of 159 chunk and CSS files despite identical
  source, so every promotion changes some asset paths.
