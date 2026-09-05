---
module: chat
date: 2026-07-25
problem_type: build_error
severity: high
symptoms:
  - 'The chat production build failed while prerendering /_global-error.'
  - "The build reported TypeError: Cannot read properties of null (reading 'useContext')."
  - 'The same source worked in the running development server.'
root_cause: 'The devcontainer exported NODE_ENV=development and the package build script inherited it instead of selecting production mode.'
tags:
  - nextjs
  - turbopack
  - node-env
  - devcontainer
  - chat
---

# Next build inherited development mode

## Problem

The chat production-readiness gate failed while prerendering Next's generated
`/_global-error` page. The stack's long-running dev process worked, but a direct
package production build in the same devcontainer did not.

## Symptoms

The failing build reported
`TypeError: Cannot read properties of null (reading 'useContext')` for
`/_global-error`, alongside React key warnings for generated head metadata. The
failure pointed at rendering and provider code even though no application
`global-error.tsx` existed.

## What Didn't Work

Treating the generated error page, the root internationalization provider, or
the head metadata as the root cause followed the failure site rather than the
build environment. Those components also ran in the development server, so
changing them would not explain why only the package production command failed.

## Solution

Make the package command select its own mode:
`apps/chat/package.json:73` runs
`cross-env NODE_ENV=production next build --turbopack`. The repository root
build follows the same rule at `package.json:45`.

[PR #5197](https://github.com/uzh-bf/klicker-uzh/pull/5197) contains the fix and
the successful package and CI build evidence.

## Why This Works

`next build` is a production operation, but an inherited `NODE_ENV` still
affects which React and framework branches load before and during prerendering.
Setting it at the script boundary makes the command deterministic regardless of
the shell or devcontainer that invokes it.

## Prevention

Every production build script must select `NODE_ENV=production` explicitly.
Run package builds inside the devcontainer, where inherited development
variables reproduce this class of failure, and require the CI build gate before
calling a framework upgrade production-ready.
