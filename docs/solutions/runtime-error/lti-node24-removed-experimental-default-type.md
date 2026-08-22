---
module: lti
date: 2026-08-05
problem_type: runtime_error
severity: high
symptoms:
  - 'The stg lti Deployment sat in CrashLoopBackOff with over 100 restarts.'
  - 'The container exited immediately with: node: bad option: --experimental-default-type=module'
  - 'https://lti.klicker.stg.df-app.ch returned a 503 with the HAProxy body "No server is available to handle this request."'
  - 'ArgoCD reported app-klicker as Synced but Progressing rather than Healthy.'
root_cause: 'The lti Dockerfile CMD passed --experimental-default-type=module, a flag Node removed before the base image was bumped to node:24.16.0-alpine. The flag was already redundant because apps/lti/package.json declares "type": "module" and turbo prune copies it into the runner image.'
tags:
  - node24
  - docker
  - esm
  - lti
  - deployment
---

# LTI crashed on a Node flag removed in Node 24

## Problem

Every `lti` pod on staging exited at startup with

```
node: bad option: --experimental-default-type=module
```

and the ingress answered `lti.klicker.stg.df-app.ch` with a 503, because no
backend pod ever became ready.

## Why it stayed hidden

The flag became invalid when the base image moved to Node 24, but staging runs
the floating `:v3` tag and had not been rolled since **2026-06-15**. The break
only surfaced on 2026-08-04, when the first `rollout.klicker.uzh.ch/release`
promotion in seven weeks finally restarted the pods — see
[CI & Deployment → Staging promotion](../../ci-and-deployment.md#staging-promotion).

A build-time check could not have caught it: the image builds fine, and nothing
executes the CMD until a container starts.

## Fix

Drop the flag:

```dockerfile
CMD ["node", "apps/lti/dist/index.js"]
```

This is safe because Node resolves module type from the nearest `package.json`
to the entrypoint. The runner image's `COPY --from=deps /app/out/json/ .` places
`turbo prune --docker`'s pruned manifests into the image, so
`/app/apps/lti/package.json` exists and declares `"type": "module"`. Every
sibling service (`backend-docker`, `olat-api`, `response-api`,
`hatchet-worker-general`) already uses a bare `CMD node <path>` with the same
Dockerfile shape.

## Lesson

A floating image tag hides startup-time regressions for as long as the pods
happen to keep running. When a rollout follows a long gap, check that **every**
Deployment reached Ready afterwards — an app-level `Progressing` health is the
signal, and a single crash-looping service does not stop the other twelve from
rolling successfully.
