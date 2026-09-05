---
type: Solution
title: Keep DevPod UI verification gates independent
description: Separate route readiness, repository builds, and browser-runtime prerequisites when a local UI verification run fails.
module: devrouter-playwright
date: 2026-08-10
problem_type: integration
severity: medium
symptoms:
  - 'devrouter ensure timed out with SSL certificate problem: out of memory'
  - 'A reported @klicker-uzh/util Rollup failure did not reproduce in the isolated package build'
  - 'Playwright type and test-discovery checks passed, but browser launch lacked Chromium dependencies and ffmpeg'
root_cause: 'Route readiness, package-build attribution, and browser-runtime prerequisites were treated as one verification failure instead of independent gates.'
tags:
  - devpod
  - devrouter
  - playwright
  - browser-verification
  - node24
  - tls
  - rollup
---

# Keep DevPod UI verification gates independent

## Problem

The course-header UI change was initially described as blocked by an unrelated
`@klicker-uzh/util` Rollup parse error. The local run actually crossed several
independent boundaries: host dependency management, DevRouter route readiness,
repository-wide checks, and the browser test runtime. A failure in one layer
made the next layer look unavailable, which obscured the evidence for the UI
itself.

The repository pins Node 24 in the DevPod image at
`.devcontainer/Dockerfile:4`, while the failed host-side dependency commands
ran under Node 26. That race damaged ignored host `node_modules` state and
produced misleading missing-package and missing-message errors in the running
apps.

## Symptoms

- `devrouter ensure` reported `SSL certificate problem: out of memory` from
  macOS `curl`, even though the HTTPS route responded when certificate
  verification was disabled.
- The isolated `@klicker-uzh/util` Rollup build passed, with only its existing
  circular-dependency and unused-import warnings.
- `check:all` failed in Analytics because pandas needed a compiler that the
  image did not contain, and in Manage because the existing
  `CourseDuplicationModal.tsx:602` ref rule failed.
- The root build failed later in OLAT at
  `apps/olat-api/src/index.ts:24` with Rollup's
  `'const' declarations must be initialized` error. It did not fail in Util.
- Playwright typechecking and test discovery passed, but the container lacked
  Chromium, its native libraries, and ffmpeg. A first filtered command also
  collected the entire 48-test file instead of the intended focused tests.
- `agent-browser` provided successful live UI evidence for the ordinary and
  assessment course headers, including mobile, English, German, menu, Escape,
  and focus-return states. That evidence is browser verification, not a green
  Playwright suite.

## What Didn't Work

- Running `pnpm` on the host while the repository's container used Node 24
  created a dependency race. Reinstalling inside the DevPod restored the
  runtime; repeating host-side installs would only recreate the damage.
- Running `devrouter ensure` from the wrong checkout or from a sandbox without
  host process visibility produced lifecycle-lock diagnostics. The command
  must target the exact linked worktree and have access to its host process
  identity.
- `devrouter tls install` alone did not remove the readiness error. The shared
  local certificate had a very large SAN set generated from active workspace
  routes, and macOS SecureTransport rejected it with the misleading
  `out of memory` certificate error.
- A temporary `curl -k` wrapper allowed route publication, but it bypassed
  certificate verification and therefore proved only that the proxy answered.
  It is a diagnostic workaround, not a repository or DevRouter fix.
- Installing Playwright's browser packages ad hoc was not a reliable first
  proof: the image had no browser dependencies, extraction stalled, and the
  interrupted run never established a complete ffmpeg-backed Playwright
  environment.

## Solution

Use a layered verification loop:

1. Establish the exact checkout with `devrouter ensure <worktree>` and run
   package commands through `devrouter exec <same-worktree> -- ...`.
2. Confirm the container runtime before touching dependencies: Node must match
   the repository pin, and the host must not run the container's pnpm workflow.
3. Run the changed package's typecheck, lint, and build in isolation before
   interpreting `check:all` or the root build. Record the first failing
   package, not the package that was suspected in an earlier summary.
4. Preflight the browser runner independently: test-file discovery, browser
   executable, native libraries, and ffmpeg are separate requirements.
5. Use `agent-browser` for live authenticated UI evidence when the DevPod has
   no complete Playwright runtime, and label that result separately from E2E
   status.

## Why This Works

Each gate has a different owner and failure signal:

- DevRouter owns container identity, proxy routes, and TLS readiness.
- The repository owns package transforms and root build dependencies.
- Playwright owns browser artifacts and media capture; the container image
  owns the native libraries those artifacts need.
- `agent-browser` verifies the user-visible page directly and does not prove
  repository-wide build health.

Separating the gates prevents an infrastructure probe from being reported as a
source parser failure and prevents an unrelated package failure from invalidating
browser evidence that already passed.

## Prevention

- Extend the environment and testing preflights to report Node version, exact
  worktree, DevRouter TLS/SAN health, package-local build status, Chromium
  executable status, native browser dependencies, and ffmpeg availability.
- Complete the optional browser-enabled DevPod stage already identified in
  `project/2026-07-06-agent-readiness-improvement-plan.md:128`, or document a
  supported host/browser fallback with the same evidence boundary.
- Run `playwright test --list` with the intended grep before launching a long
  suite; only then run the focused test command.
- Keep unrelated OLAT, Analytics, and pre-existing Manage lint failures in
  their own fixes. Do not widen a UI change to make the aggregate gate green.
- Treat oversized shared TLS certificates as a DevRouter defect to fix in
  route/certificate management. Do not institutionalize insecure readiness
  probes.
