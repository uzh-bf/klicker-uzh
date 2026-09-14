---
module: frontend
concept: shared translation context
created: 2026-09-09
updated: 2026-09-09
date: 2026-09-09
problem_type: runtime_error
severity: high
symptoms:
  - 'Account creation returns HTTP 500 during production server rendering.'
  - 'Shared useTranslations cannot find NextIntlClientProvider despite the app provider.'
root_cause: Different pnpm peer instances cause Webpack to bundle shared translations while externalizing the app provider.
tags: [nextjs, next-intl, pnpm, webpack, ssr]
---

# Shared translations lose the app provider during production rendering

## Problem

A shared component can throw a missing `NextIntlClientProvider` error even when
`_app` wraps the page correctly. This occurred on the participant account page.
The same dependency boundary also exists in Manage and the Assessment PWA.
A successful Next data request does not prove that full-document rendering works.

## Cause

Next.js checks whether a dependency resolves to the same physical file from the
importing package and from the app root before externalizing it. pnpm can install
the same `next-intl` version under distinct peer contexts. If these paths differ,
Webpack can bundle the shared hook while leaving the app provider external.
The two copies then create separate React contexts.

The Next peer context included an optional Babel dependency in some importers
but not others. The i18n workspace also selected an older Next peer version.
Deduplicating version strings alone therefore did not establish context identity.

## Correction

The root [package manifest](../../../package.json) declares the existing Babel
version so workspace peer resolution sees it consistently.
The [i18n manifest](../../../packages/i18n/package.json) declares matching Next,
React and React DOM development versions instead of leaving those peers to
independent automatic selection. The lockfile records those aligned importers.
Unrelated dependency snapshot updates are outside this correction.

The unused translation hook in `DebouncedUsernameField` is removed as well.
Removing that hook alone would hide one failing page while leaving other shared
translation consumers exposed.

## Verification

Run [the resolution guard](../../../util/test-intl-resolution.mjs) from an
installed workspace, passing a consuming app directory name, for example:

```sh
node util/test-intl-resolution.mjs frontend-pwa
```

It compares app and shared importer paths for `next-intl`, its `use-intl`
dependency, and React. Run it after Docker pruning and installation as well:
a full-workspace result does not prove the release installation topology.

Also build and render a real shared translation consumer through the app
provider using the production bundler. Keep a used translation hook in that
probe so username-hook removal cannot mask a regression. The ordinary PWA,
Manage and Control test builds use Turbopack while their production builds use
Webpack. A passing test build is not evidence for this Webpack boundary.

The isolated production PWA reproduction returned account-page 500 before peer
alignment and 200 afterward, with the original username hook still present in
both builds. The minimized lockfile also passed a frozen pruned install and a
production runner render. These are local regression results, not deployment
or complete authenticated cross-app acceptance.

## Failed approaches and limits

Adding Babel only to the shared packages aligned a pruned experiment but failed
when the full workspace graph was regenerated: the app resolved the other peer
instance. Alignment must be checked across both installation contexts.

No installer lockfile drift occurred in the production-pruned baseline or the
minimized correction. Changing Docker installation policy is not justified by
this incident evidence alone. Bundler aliases, conditional-export changes and
switching production bundlers were unnecessary for the proven correction.
