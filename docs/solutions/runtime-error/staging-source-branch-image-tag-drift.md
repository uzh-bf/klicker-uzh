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

The staging promoter currently checks out and writes `v3`. While ArgoCD tracks
`v3-ai` directly, those promotion commits cannot update the active manifests.
Before any direct-source switch, follow the render and runtime checks in
[CI & Deployment](../../ci-and-deployment.md#staging-promotion). The testing
procedure also requires image-tag inspection and independent ArgoCD health
verification.

The source change followed the external ArgoCD application update in
[df-cloud MR !434](https://gitlab.uzh.ch/uzh-bf/cloud/df-cloud-klickeruzh/-/merge_requests/434).
The lecturer and student MCP images had already been published by the exact-head
[lecturer build](https://github.com/uzh-bf/klicker-uzh/actions/runs/32950229129)
and [student build](https://github.com/uzh-bf/klicker-uzh/actions/runs/32950229105).
