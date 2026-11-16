# Control mobile store roadmap

Research date: 2026-10-23. Scope: lecturer Control first, iOS and Android.
Status: research complete; architecture recommendations and milestones proposed.
Approval mode: direction-only. This document does not authorize implementation,
store submission, deployment, paid services or changes to the existing Android listing.

## Recommendation

Keep Capacitor as the leading option and package the existing React Control UI
as local web assets. Keep live quiz data and commands on the existing backend.
Prove a small Next.js static build before choosing a separate frontend build.
If Next-specific routing makes that awkward, evaluate a small Vite entry that
imports the same screens. Neither approach requires a Swift/Kotlin UI rewrite.

Use store releases for bundled UI and native changes initially. Consider live
updates later, after compatibility, rollback and store-policy checks work.
Keep the working student Android package separate from this Control release.
The user reports that listing already works; its published package and signing
configuration were not inspected.

The deciding experiment is a bundled release build on physical devices:
startup, institutional login, opening a newly created session, controlling it,
background/resume and network recovery. App Store acceptance remains an external
decision. No native device, TestFlight or store submission was tested in this research.

## What exists today

Source baseline: `375e5274cd6235737ab78053a70b706dfa2a06a6`, the existing
[controller follow-up PR](https://github.com/uzh-bf/klicker-uzh/pull/6686), above
[the native-shell PR](https://github.com/uzh-bf/klicker-uzh/pull/6539).

- [Control](../apps/frontend-control/package.json) already uses Next.js 16.3.4.
  Its [configuration](../apps/frontend-control/next.config.mjs) selects the Pages
  Router. A Next version upgrade and an App Router migration are separate changes.
- [Course](../apps/frontend-control/src/pages/course/[id].tsx) and
  [session](../apps/frontend-control/src/pages/session/[id].tsx) pages read IDs
  at runtime and use empty `getStaticPaths` with blocking fallback. There are no
  Control `getServerSideProps`, API routes or middleware. Page static props load
  translations; live data comes through Apollo. Bundling is plausible, but the
  current routes cannot simply be exported unchanged.
- [Shared Next configuration](../packages/next-config/index.js) uses standalone
  server output and EN/DE locale routing. Control also has server redirects,
  an optional local GraphQL rewrite and PWA generation. These need explicit
  treatment in a native build. Translations use `next-intl`.
- [The Capacitor 8.5.2 shell](../native/control/package.json) currently targets
  iOS only. Its [configuration](../native/control/capacitor.config.ts) loads
  `server.url`; `www` contains a loading placeholder. There is no native Android
  project or live-update plugin in this Control package. Capacitor documents
  `server.url` as a development/live-reload facility, unsuitable as its normal
  production bundling path. This is engineering guidance, separate from Apple's
  review rules. [Capacitor configuration](https://capacitorjs.com/docs/config)
- [Login](../apps/frontend-control/src/pages/login.tsx) redirects to hosted auth
  and constructs a hosted Control return URL. The shell keeps auth and edu-ID
  inside its WebView. [Apollo](../apps/frontend-control/src/lib/apollo.ts) uses
  credentialed requests, a CSRF header and production persisted operation hashes.
  [The backend](../apps/backend-docker/src/app.ts) resolves those hashes from its
  generated operation map and disallows arbitrary operations outside development
  and test. Mobile releases therefore need compatibility beyond schema fields.

The [June student-app proposal](2026-06-07-capacitor-mobile-app-plan.md) concerns
the student PWA. Its remote-first, push and offline-practice proposals are not
requirements or approvals for this Control roadmap.

## Is Capacitor the best fit?

This comparison prioritizes reuse of the current design, lecturer workflows and
GraphQL contracts. The conclusions are architectural judgments, not device benchmarks.

| Option                            | Fit for Control                                                                                                                                                                                                                                                          | When to choose it                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **Capacitor with bundled web UI** | Strongest starting fit. Reuses DOM components, CSS, translations and web skills; native lifecycle/auth still need work.                                                                                                                                                  | Preferred unless the device experiment exposes a concrete limitation.                              |
| **Expo / React Native**           | Strong alternative when native screens become the product direction. Ordinary native components differ from DOM components; substantial visual adaptation is likely. Expo DOM components can reuse web UI incrementally, but introduce a WebView and bridge constraints. | Choose when native interaction, navigation or substantial platform features justify the migration. |
| **Tauri 2**                       | Supports mobile distribution and web UI reuse, but also needs a static frontend/client-server boundary. Adds a Rust/native toolchain without solving Next server dependencies.                                                                                           | Revisit if desktop distribution or Rust integration becomes a concrete requirement.                |
| **SwiftUI and Kotlin/Compose**    | Most platform control; largest UI and maintenance divergence from the web app.                                                                                                                                                                                           | Choose for requirements the shared web UI cannot reasonably satisfy.                               |
| **PWA / Android TWA**             | Retains the current web delivery model. TWA is an Android browser-backed packaging route; it does not supply an iOS App Store counterpart.                                                                                                                               | Preserve the working Android student distribution and web fallback.                                |

Sources: [React Native components](https://reactnative.dev/docs/intro-react-native-components),
[Expo DOM reuse and limitations](https://docs.expo.dev/guides/dom-components/),
[Tauri frontend requirements](https://v2.tauri.app/start/frontend/),
[Tauri mobile distribution](https://v2.tauri.app/distribute/),
[Android TWA](https://developer.chrome.com/docs/android/trusted-web-activity).
Using Expo DOM does not automatically run a Next server or remove authentication
work. It is a credible migration option, rather than a drop-in native rendering
replacement for the existing application.

Capacitor and Ionic's commercial services have different outlooks. Ionic stopped
new commercial sales and announced Appflow access for existing customers through
December 31, 2027, while committing to maintain open-source Capacitor. Avoid
building a new release dependency on Appflow. Capacitor does not require Ionic UI
components or a commercial build service.
[Ionic announcement](https://ionic.io/blog/important-announcement-the-future-of-ionics-commercial-products)

## How to bundle the UI

### Choose the smallest frontend boundary

| Build approach                            | Concrete adaptation                                                                                                                                                                                   | Disposition                                                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Next static export                        | Native-specific build with fixed entry pages, client-selected course/session IDs, bundled locale messages and no server rewrites.                                                                     | First experiment; preserves the existing build and most imports.                                                           |
| Vite client entry sharing Control screens | Thin client router, providers and platform navigation; adapt `next/router`, `next/head`, font loading and build-time environment references where used. Share screens and logic without copying them. | Fallback if this is demonstrably smaller and easier to maintain than the Next export adaptations. No dependency added yet. |
| Hosted Control in `server.url`            | Keep current WebView prototype and remote deployment behavior.                                                                                                                                        | Useful for development comparison; not the recommended store architecture.                                                 |

A normal Next `.next/standalone` directory contains a server application; it is
not the static web asset directory that Capacitor expects. Next static export
produces `out`, but blocking dynamic routes, built-in locale routing and rewrites
are unsupported. [Next Pages export](https://nextjs.org/docs/pages/guides/static-exports)

Proposed mobile routing: a fixed `/session/` entry reads a runtime ID from a
query parameter, or a single SPA entry uses client routing. A new quiz created
after the binary was built must open without another build. Preserve public web
URLs such as `/session/<id>` and translate incoming app links to the local route.
Do not prebuild private course/session records into a public app bundle.
Cold launch, refresh, back navigation and auth return must all be tested against
Capacitor's actual local asset routing. A blanket SPA fallback alone does not
make Next dynamic routes exportable.

### Build and package

The proposed production pipeline is:

```text
shared Control UI + translations + public configuration
  -> static frontend build (Next out/ or Vite dist/)
  -> Capacitor webDir
  -> cap sync ios / cap sync android
  -> Xcode archive / Android signed bundle
  -> TestFlight / Play testing -> store review
```

Capacitor's `sync` copies the built web assets and updates native dependencies.
It does not turn server code into client code, upload a store release or provide
live updates. Point `webDir` at the real output and remove production
`server.url`; development may still use live reload.
[Capacitor workflow](https://capacitorjs.com/docs/basics/workflow)

Package CSS, fonts, icons and EN/DE messages. Replace server-only locale and
redirect behavior in the mobile entry. Disable service-worker registration in
the bundled build so the store bundle or a future native updater owns its UI
version. Keep web PWA behavior separate. Starting offline should render a useful
shell and an honest connection state; controlling an active quiz remains online.

Release checks should reject local API/auth endpoints, cleartext remote traffic,
missing assets and placeholder-only bundles. Public environment values are
compiled into Next browser assets; changing a deployed server's environment
does not change an installed bundle. Keep server credentials out of assets.
[Next environment variables](https://nextjs.org/docs/app/guides/environment-variables)

### Authentication and native behavior are part of the experiment

Bundling changes the origin. Capacitor's documented defaults are
`capacitor://localhost` on iOS and `https://localhost` on Android. Neither is the
hosted Control site. Recheck API CORS/preflight, cookies, CSRF and any subscription
authentication; the current local Next proxy will not exist inside the app.
Changing the local hostname does not by itself reproduce hosted cookie behavior.
[Capacitor origin settings](https://capacitorjs.com/docs/config)

Use a system authentication session for institutional login, with a validated
callback to the app. OAuth native-app best practice uses an external user agent
and PKCE for public native clients. Retain the backend-mediated login if suitable;
do not embed an OIDC client secret in the app. System-browser authentication
does not automatically populate the app WebView's authenticated session.
[RFC 8252](https://www.rfc-editor.org/rfc/rfc8252.html)

The first experiment must choose and prove either an explicit, short-lived,
single-use backend handoff into an app session, or a properly scoped native token
flow. Validate callback target/state, cancellation, expiry, logout and account
switching. Do not expose session/refresh tokens in callback URLs or logs, weaken
web CSRF protections, or assume a cookie plugin alone solves login. Token storage,
cookie transport and any new backend endpoint require a reviewed implementation
design before adoption.

Use native lifecycle events to refetch server state on resume. Disable commands
while connection state is uncertain and never replay a queued destructive quiz
command blindly. Verify cancellation/retry semantics and prevent duplicate
commands after transport failures. Preserve safe areas, keyboard behavior,
Android back navigation and the current session/tab when practical. Useful
optional additions include verified app links and an explicit keep-awake option
during an active lecture. These are product choices, not App Store checkboxes.
[Capacitor lifecycle and link events](https://capacitorjs.com/docs/apis/app)

## What happens with App Router or a future Next upgrade?

App Router can produce static exports. Server Components may execute at build
time and emit bundled output; they do not become an on-device server. Runtime
user/session data should continue through the client API. Request-time cookies,
Server Actions, request-dependent Route Handlers and unenumerated dynamic routes
cannot run in a static export. Adding `'use client'` does not fix an unknown
`/session/[id]` route by itself.
[App Router export constraints](https://nextjs.org/docs/app/guides/static-exports)

For a fixed static page that reads query parameters using `useSearchParams`,
place the client reader below the required Suspense boundary and verify a
production build. Avoid reading request-specific `searchParams` on the server
to select a private session in the bundled application.
[Static search-parameter rendering](https://nextjs.org/docs/app/api-reference/functions/use-search-params)

Two sustainable directions remain available:

- Keep a static-exportable Control frontend in Next, with client API access.
  An App Router migration is then a routing/provider migration with an export
  acceptance check, rather than a native rewrite.
- Let hosted web apps use SSR, Server Actions or dynamic RSC as needed, while a
  small mobile entry imports portable client screens and calls stable APIs.
  Keep web-only server wrappers outside the mobile dependency graph. Share a
  package only when the second build creates a real second caller.

Do not make installed clients depend on private Next RSC/Server Action protocols
or a particular deployed web build. Next upgrades rebuild and retest the mobile
assets and do not automatically require a Capacitor upgrade. Native plugins,
Capacitor and platform SDK changes have their own compatibility checks. Apply
each dependency change through its lockfile and a store build when required.

## Updates and compatibility

### Keep the delivery layers explicit

| Change                                                              | Recommended delivery      | Compatibility obligation                                                                                                           |
| ------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Quiz data, responses, feedback                                      | Existing API updates      | Existing permission and data contracts; no store release for ordinary data.                                                        |
| Backend implementation/schema                                       | Backend deployment        | Support installed clients, accepted operations and auth behavior during the published support window.                              |
| Bundled UI, CSS, translations, client dependency fixes              | New store build initially | Build/sync/archive together; users may install later or remain on an older version. A web deploy alone does not update the bundle. |
| Native plugin, permission, entitlement, SDK or native configuration | New native store build    | Test each supported platform; a JavaScript live update cannot add native code.                                                     |
| Compatible web-layer fix after optional updater adoption            | Signed live-update bundle | Native version targeting, policy review, atomic activation and rollback. Material functionality changes use normal store review.   |

Capgo and Capawesome offer Capacitor web-bundle updates. Capawesome documents
self-hosted bundle downloads, signing, native-version targeting and startup
rollback; cloud services add operational conveniences. These are third-party
options requiring a separate dependency, service/cost/privacy evaluation.
[Capgo update scope](https://capgo.app/docs/live-updates/),
[Capawesome updater](https://capawesome.io/docs/sdks/capacitor/live-update/),
[version targeting](https://capawesome.io/docs/cloud/live-updates/bundles/).
Expo has an analogous native-runtime/update compatibility boundary; moving to
Expo does not eliminate this responsibility.
[Expo runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)

### Release order and older installed apps

Recommended release contract:

1. Deploy additive backend support first, including both new and still-supported
   persisted operation hashes. Keep existing field, enum, mutation and auth
   semantics compatible. A current-only generated hash map is insufficient if
   an operation changed in a still-installed mobile release.
2. Build one immutable mobile asset set, sync it into each native project and
   record source revision, native build version and web-bundle version. Keep
   native and web assets from the same tested release together.
3. Test the oldest supported binary against the candidate backend, then release
   through the stores. Test fresh install and upgrade, rather than assuming users
   update with the web deployment.
4. Retain old API/operation support until the declared retirement point. Define
   the initial supported-version/time window before launch. A minimum-version
   prompt should explain recovery and avoid interrupting an active lecture
   unless a concrete safety/security issue requires it.
5. Make rollback preserve the API contracts of every already-released client.
   An old backend image may lack newly shipped operations, so binary rollback
   alone is not a sufficient recovery plan. A store update is not an immediate
   rollback for devices that already installed a defective version.

This is a proposed compatibility policy. No retention mechanism, support window
or release automation has been implemented by this research.

### Optional live updates after the first release

If store turnaround becomes a demonstrated problem, evaluate one updater against
these acceptance conditions: authenticated/signed bundles, immutable assets,
native-version bounds, interrupted-download safety, startup rollback and an
embedded last-known usable shell. Include its device identifiers, telemetry,
hosting region, retention and ongoing cost in the decision.

Activate a downloaded bundle at a safe restart outside an active lecture.
Do not allow an updater to reload the running controller mid-session. Startup
readiness should prove the local app boots; requiring a successful remote API
call could turn a network outage into a false rollback. Test offline startup,
corrupt/incompatible bundles, migration compatibility and failed activation.
[Signing](https://capawesome.io/docs/cloud/live-updates/code-signing/),
[rollback behavior](https://capawesome.io/cloud/live-updates/advanced/rollbacks/).

Apple restricts downloaded code that changes functionality; an updater vendor
cannot guarantee App Store acceptance. Treat OTA as a constrained fix channel,
with material features and native changes following store review. Google Play
distinguishes interpreted WebView code from downloadable native executables,
while still requiring policy compliance. Neither policy is blanket approval for
arbitrary remote changes. [Apple guidelines 2.5.2 and 2.3.1](https://developer.apple.com/app-store/review/guidelines/),
[Google Play update policy](https://support.google.com/googleplay/android-developer/answer/16559646?hl=en).

## Store readiness and milestones

Apple guideline 4.2 evaluates useful, app-like functionality beyond a repackaged
website. Bundling and a fixed count of plugins do not guarantee acceptance.
Control's classroom remote workflow is a credible utility case. Review notes
should demonstrate session selection, live controls, Q&A and audience feedback.
Provide a usable demo account or suitable demo mode and a reachable backend.
Check privacy disclosures, applicable SDK manifests, support and account deletion
where account creation is offered. Check the education-account exception under
4.8 against actual sign-in options before adding another login service.
[Apple review requirements](https://developer.apple.com/app-store/review/guidelines/)

| Milestone                                  | Work and dependency                                                                                                                                                                                                       | Evidence needed to advance                                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **R0: prove bundled delivery**             | First bounded implementation proposal: adapt one session entry and EN/DE providers; add the minimal Android shell needed for this experiment; compare Next export with a Vite entry only if needed. Reuse current design. | Release-mode assets boot locally on iOS and Android without the hosted UI; a test-owned ID created after the build reaches the local session entry; cold start/back/refresh work. This proves routing only; authenticated session access follows R1. Record actual code/build delta and select one approach. |
| **R1: prove authentication and transport** | Depends on R0's actual origin. Review the minimal auth handoff/native client design and backend contract.                                                                                                                 | Physical-device edu-ID success, cancel, expiry, logout, account switch and link return; authenticated queries/mutations and required subscriptions; exact CORS/CSRF behavior.                                                                                                                                |
| **R2: qualify lecture use**                | Depends on R1. Bring the remaining shared screens into the chosen build and complete both platforms' integration.                                                                                                         | Full lecturer flow, safe areas, EN/DE, keyboard/back, lock/background/resume, Wi-Fi/mobile switching and connection loss. No stale state presented as current and no duplicate or queued destructive commands.                                                                                               |
| **R3: qualify releases and updates**       | Depends on R2. Define support window, retain operation hashes, add immutable build provenance and release checks.                                                                                                         | Fresh install and upgrade; oldest supported client against new backend; API/backend rollback rehearsal; no production local endpoints or service-worker version interference. OTA remains optional.                                                                                                          |
| **R4: beta and store submission**          | Depends on R3 and explicit submission authority. Prepare signing, metadata, privacy and reviewer access.                                                                                                                  | TestFlight and Play testing on physical devices, pilot lecturer acceptance, then separate public store review results. Beta distribution does not establish public App Store approval.                                                                                                                       |

No elapsed-time promise is made before R0/R1 resolve routing and authentication.
Later student iOS support is a separate package: its server-rendering, offline,
assessment and account requirements must be evaluated on its own source and scope.

## Research verification and next action

Repository source/configuration and primary vendor/platform documentation were
checked. A bounded independent code-mapping pass confirmed routes, providers and
the native shell. Context7 supplied Next 16.2.9 reference material; the installed
version is 16.3.4, so current official documentation was also checked. No claim of
an exact-version export build is made.

Research is complete; R0-R4 remain unstarted. The next proposed action is a
bounded R0/R1 implementation plan with device acceptance checks. Auth transport,
support-window length and any updater vendor remain decisions for that plan.
This roadmap records recommendations and does not settle those contracts.
