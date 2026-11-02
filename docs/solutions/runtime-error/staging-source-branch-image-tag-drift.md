---
type: Solution
title: Prevent staging source branch image tag drift
description: Render the branch ArgoCD tracks and verify sync, health, images, and resources independently.
module: deployment
date: 2026-08-26
problem_type: runtime_error
severity: high
symptoms:
  - 'ArgoCD remained Progressing after a successful staging sync.'
  - 'The embedded MCP pods reported ImagePullBackOff for unavailable v3 tags.'
  - 'The general Hatchet worker was OOMKilled at its inherited 256 MiB limit.'
root_cause: 'The active v3-ai chart retained two v3 image tags, while the merged worker exceeded its inherited memory limit.'
tags:
  - argocd
  - helm
  - staging
  - image-tags
  - mcp
  - hatchet
  - oom
---

# Staging source branch image tag drift

## Problem

The staging ArgoCD application was changed to track `v3-ai` directly. The sync
succeeded, but the application did not become healthy.

## Symptoms

- The lecturer and student MCP Deployments entered `ImagePullBackOff`.
- Both Deployments requested the `v3` image tag even though their successful
  branch builds had published `v3-ai`.
- The general Hatchet worker repeatedly exited with code 137 and the
  `OOMKilled` reason at its inherited 256 MiB memory limit.
- ArgoCD reported `Synced` and a successful operation while overall health
  remained `Progressing`.

## What didn't work

- Treating successful image workflows as proof that the chart selected those
  images. Builds publish branch tags; Helm values independently choose a tag.
- Treating a successful ArgoCD sync as runtime proof. Sync confirms desired
  manifests were applied, not that every resulting pod became ready.
- Relying on the infrastructure preview to detect workload-level errors. The
  preview validated the ArgoCD source revision, but it did not render the
  application chart or check image availability and container memory.

## Solution

The staging values now select `v3-ai` for both MCP images and give the general
Hatchet worker a 512 MiB memory limit. Render the exact branch and environment
values before changing ArgoCD's `targetRevision`, then inspect every generated
workload image tag.

After the authorized sync, verify the layers separately:

1. ArgoCD tracks the intended source branch and revision.
2. The application is `Synced` and the sync operation succeeded.
3. The application becomes `Healthy`.
4. Each changed Deployment is ready with the expected image and resources.

## Why this works

The MCP Deployments now reference the same branch tag published by their image
workflows. The explicit worker override replaces the chart's lower default for
the workload that exceeded it. Separate sync and health checks expose failures
that manifest application alone cannot catch.

Once the student MCP image could start, it exposed a separate Node ESM package
import failure. That fix and its build-time regression check are recorded in
[Make built Node ESM package imports explicit](./node-esm-apollo-directory-import.md).

## Prevention

The annotation write-back in
[ADR-0003](../../adr/0003-promote-stg-via-release-annotation-write-back.md)
was the first protection against floating-tag drift. Its successor publishes a
full source-commit SHA tag beside each branch tag and promotes that exact
revision through `stg-release`. The chart's optional `global.imageTag` applies
the ArgoCD-resolved revision to all first-party workloads, including the
PreSync migrator.

A full-SHA Docker tag is still mutable registry metadata; its spelling alone
does not prove image content. Every active push workflow must inspect that tag
after registry login. If it already exists, the workflow records its canonical
digest and skips the build/push path. If it is absent, the existing build may
publish all tags once. An uncertain registry response fails closed. This keeps
a rerun from overwriting the SHA tag or moving the floating branch tag backward.

The privileged `workflow_run` controller must execute only code checked out
from the trusted default branch. Candidate commits, workflow runs, API records,
and Git objects are untrusted data; the controller must never execute candidate
actions or scripts or consume candidate caches or artifacts. It advances
`stg-release` only after every required exact-SHA build and registry digest is
present, using a non-forcing compare-and-swap update.

The controller's sorted canonical registry digest receipt is deployment
provenance. ArgoCD's resolved `$ARGOCD_APP_REVISION` separately proves which Git
revision supplied `global.imageTag`. After sync, compare every deployed
container's `imageID` digest with the corresponding receipt entry. A matching
tag, green build, successful sync, migration result, workload health, and user
acceptance are distinct checks; none substitutes for the others. Follow the
full sequence in [CI & Deployment](../../ci-and-deployment.md#staging-promotion).

Production is unchanged: it stays on `v3`, receives no `global.imageTag`, and
continues to use hand-edited release tags. Retain the old rollout annotations
through the stability window as rollback aids, not as proof of image content.

The source change followed the external ArgoCD application update in
[df-cloud MR !434](https://gitlab.uzh.ch/uzh-bf/cloud/df-cloud-klickeruzh/-/merge_requests/434).
The lecturer and student MCP images had already been published by the exact-head
[lecturer build](https://github.com/uzh-bf/klicker-uzh/actions/runs/32950229129)
and [student build](https://github.com/uzh-bf/klicker-uzh/actions/runs/32950229105).
