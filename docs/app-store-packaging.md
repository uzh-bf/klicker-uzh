---
type: Operations
title: App Store Packaging
description: How the control app is packaged for Google Play as a Trusted Web Activity, what stays outside the repository, and why iOS is not covered.
timestamp: '2026-11-24'
tags:
  - mobile
  - deployment
  - frontend-control
---

# App Store Packaging

**The Play Store build of the control app contains no web code: it is a Trusted
Web Activity that opens `https://control.klicker.uzh.ch` in Chrome, and it only
runs without a browser address bar while every trusted origin serves a Digital
Asset Links file carrying the Play App Signing fingerprint.** The fingerprint
that matters is the one Google signs the delivered app with (Play Console →
App integrity → App signing), not the local upload key. A missing or wrong
`/.well-known/assetlinks.json` does not break the app; it silently degrades it
to a Chrome Custom Tab with a visible URL bar.

## What is tracked

- `apps/frontend-control/android/twa-manifest.json` is the only tracked Android
  artifact. [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
  regenerates the complete Android project from it, and
  `apps/frontend-control/android/.gitignore` ignores everything else in that
  directory, including the generated project, build outputs and keystores.
- The Bubblewrap project template sets the target API level, so raising it for a
  new Play requirement means regenerating with a current `@bubblewrap/cli`, not
  editing Gradle files.
- `apps/frontend-control/public/manifest.json` is the web manifest the store
  build points at through `webManifestUrl`. Its `any` icons must stay
  non-maskable files: a maskable image declared as `any` is rendered with its
  safe-zone padding on launchers that do not mask.

This repository is public. The upload keystore, its passwords and any Play
service-account file never belong in it; keep them in the team secret store.

## Trusted origins

`twa-manifest.json` lists `auth.klicker.uzh.ch` under
`additionalTrustedOrigins` because the control login leaves the app origin
(`apps/frontend-control/src/pages/login.tsx:Login` redirects to
`NEXT_PUBLIC_AUTH_URL`). Both origins therefore need the asset links file:

- `apps/frontend-control/public/.well-known/assetlinks.json`
- `apps/auth/public/.well-known/assetlinks.json`

The student app already follows this pattern for its own package in
`apps/frontend-pwa/public/.well-known/assetlinks.json`. The Edu-ID identity
provider is a third-party origin and always shows the address bar during
sign-in; that is expected.

Neither control nor auth serves the file yet, because the fingerprint only
exists once the app has been created in the Play Console.

## First release

`update` and `build` are **verified** with `@bubblewrap/cli` 1.27.0 and a
throwaway local keystore; the `fingerprint` commands are **config-derived** from
the Bubblewrap CLI reference. Bubblewrap needs JDK 17 and the Android command
line tools, and three details are easy to trip over:

- `minSdkVersion` must stay at 24 or higher. Bubblewrap defaults to 21, which
  fails the manifest merge against `androidbrowserhelper`.
- Bubblewrap looks for `sdkmanager` in `<sdk>/bin` or `<sdk>/tools/bin`. A
  Homebrew `android-commandlinetools` install keeps it in
  `<sdk>/cmdline-tools/latest/bin`, so link that directory to `<sdk>/bin`.
- Each Bubblewrap release pins one build-tools version (36.1.0 for 1.27.0) and
  needs exactly that version installed.

1. Create the app in the Play Console with package name
   `ch.uzh.bf.klicker.control` and enrol it in Play App Signing.
2. Create the upload keystore outside the repository and build from
   `apps/frontend-control/android`:

   ```bash
   npx @bubblewrap/cli update
   npx @bubblewrap/cli build --signingKeyPath=<keystore> --signingKeyAlias=<alias>
   ```

3. Record the Play App Signing SHA-256 fingerprint and generate the asset links
   file:

   ```bash
   npx @bubblewrap/cli fingerprint add <SHA-256> --name="Play App Signing"
   npx @bubblewrap/cli fingerprint generateAssetLinks
   ```

4. Commit the generated file at both paths under
   [Trusted origins](#trusted-origins) and deploy control and auth before
   testing the store build.
5. Upload `app-release-bundle.aab` to an internal testing track and confirm on a
   device that the app opens without an address bar on both the control app and
   the auth page.

Later releases increase `appVersionCode` in `twa-manifest.json` (Bubblewrap
`update` does this) and repeat step 2. Web changes ship through the normal
deployment and need no store release.

The store listing also needs material that is not in this repository: phone
screenshots, a feature graphic, the privacy policy URL, the data safety form,
the content rating and a reviewer login, because the app is unusable without an
account.

## iOS

There is no iOS counterpart. Apple does not accept a Progressive Web App
directly, and a web-view wrapper without native functionality risks rejection
under App Review Guideline 4.2. The control app stays "Add to Home Screen" on
iOS until the Capacitor track for the student app decides otherwise.
