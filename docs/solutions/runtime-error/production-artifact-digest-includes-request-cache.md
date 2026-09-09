---
module: Local production Playwright runtime
date: 2026-09-09
problem_type: runtime_error
severity: medium
symptoms:
  - A successful production browser run prevents the next managed launch.
  - Artifact verification reports changed PWA or Manage output without source changes.
root_cause: Next.js writes request-generated cache files inside the standalone output tree.
tags: [playwright, devrouter, nextjs, production]
---

# Production artifact verification rejected request-generated files

The first production account run started real standalone applications and
reached the browser tests. The next managed launch reused the correct process,
then failed artifact verification because the standalone directory had changed.

Comparing file modification times against the build manifest identified
optimized image files under `.next/cache/images`. Excluding that directory
resolved the PWA mismatch. A later Manage evaluation request materialized
locale-specific `.html` and `.json` files under `.next/server/pages`, producing
the same failure in Manage.

`util/production-standalone.mjs` excludes those request-generated files from its
artifact digest. Server JavaScript, trace manifests, build identifiers, bundled
dependencies, public assets and static chunks remain covered. Source identity
and public build inputs are checked separately. The focused artifact test
requires generated image/page output to preserve verification and replaced
server code to fail it.

Do not repair this by accepting a new digest from a running server, disabling
verification, or starting a development server. Inspect the changed files and
keep the exclusion limited to generated output. A production build passing its
first launch does not prove that managed reuse works after browser traffic.
