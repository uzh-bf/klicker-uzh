---
type: Runbook
title: Learning Analytics Operations
description: Deploy, trigger, observe, recover, and cold-roll back the native Python Hatchet learning-analytics worker.
timestamp: '2026-07-23'
tags:
  - analytics
  - hatchet
  - operations
---

# Learning Analytics Operations

The dedicated `hatchet-worker-analytics` Deployment is the sole owner of
`recompute-learning-analytics` and `recompute-learning-analytics-full`. It runs
the Python analytics modules directly with one worker slot. The TypeScript
general worker retains `scan-ended-courses`, which emits `course-ended` after
the configured finalization grace period.

## Before deployment

1. Confirm that the target Hatchet control-plane version accepts
   `hatchet-sdk[v0-sdk]==1.18.1`. Local compatibility is proven against
   `hatchet-lite:v0.73.1`; staging remains the authoritative deployed-version
   gate.
2. Confirm that the owning GitOps repository declares the secret sync for
   `<release>-secret-hatchet-worker-analytics`. In the target namespace, find
   the sync object by its target Secret and require its `Ready=True` condition
   before checking the generated Secret:

   ```bash
   kubectl --context <context> -n <namespace> get externalsecret -o json |
     jq -er --arg target '<release>-secret-hatchet-worker-analytics' \
       '.items[] | select(.spec.target.name == $target) |
       select(any(.status.conditions[]?;
       .type == "Ready" and .status == "True")) | .metadata.name'
   kubectl --context <context> -n <namespace> get secret \
     <release>-secret-hatchet-worker-analytics -o json |
     jq -er '.data |
       has("HATCHET_CLIENT_TOKEN") and has("DATABASE_URL")'
   ```

   If the environment uses an Infisical-native sync resource instead of
   External Secrets Operator, apply the same gate to that resource: it must
   exist, target this Secret, and report ready before deployment. Do not deploy
   based on a stale generated Secret alone.

3. Render the target values and inspect the analytics Deployment and
   ConfigMap:

   ```bash
   helm template <release> deploy/charts/klicker-uzh-v3 \
     -f deploy/env-uzh-<environment>/values.yaml
   ```

   The rendered worker must use the target cluster architecture, one replica,
   `Recreate`, port 8001 probes at `/health`, the SDK-standard
   `HATCHET_CLIENT_SERVER_URL`, and the existing secret reference. The
   top-level Python client uses that explicit REST URL and reads the gRPC
   address from `HATCHET_CLIENT_TOKEN` unless `HATCHET_CLIENT_HOST_PORT` is
   explicitly set.

4. Confirm that the image is the native Python image: non-root UID/GID 10001,
   command `python -m src.hatchet_worker`, CPU-only Torch, and the pinned
   `intfloat/multilingual-e5-base` model bundled under `/opt/models`. The
   bundle must contain `UPSTREAM_MODEL_CARD.md` from the exact pinned revision
   and the complete Microsoft MIT notice in `LICENSE`. Runtime model downloads
   are disabled.
5. Leave `hatchet.workers.analytics.allowFull=false` for routine deployment.
   Enable it only through a reviewed maintenance-window values override when a
   full rebuild is intended.

The chart does not create the worker Secret. Its external secret/Infisical
mapping is a deployment prerequisite, not a Helm default.

## Deploy and verify

The Deployment uses `Recreate` so the retiring and replacement workers cannot
own the same Hatchet events simultaneously. Do not temporarily change it to a
rolling strategy.

After the GitOps rollout:

```bash
kubectl --context <context> -n <namespace> rollout status \
  deployment/<release>-hatchet-worker-analytics --timeout=70m
kubectl --context <context> -n <namespace> get pod \
  -l app.kubernetes.io/component=hatchet-worker-analytics
kubectl --context <context> -n <namespace> logs \
  -l app.kubernetes.io/component=hatchet-worker-analytics --tail=200
```

The worker should register the proof task plus both 15-task workflows. The SDK
server exposes:

- `/health` — worker name, status, slot count, actions, and Python version.
- `/metrics` — Prometheus metrics, including a worker-status gauge.

The chart probes `/health` and annotates the pod for `/metrics` scraping. The
startup probe allows five minutes for imports and registration. Kubernetes
allows 61 minutes on termination so the SDK can drain a task with a 60-minute
execution timeout before `SIGKILL`.

For the first staging rollout, run the non-mutating
`learning-analytics-native-proof` task, then run one incremental recompute for
a known low-volume course. Confirm task completion, expected analytics rows,
and the course status before increasing scope.

Before enabling the production cron, run one guarded `FULL` rebuild in a
reviewed maintenance window. This establishes a consent-correct baseline for
analytics rows created before the native worker tracked consent changes. After
that baseline, incremental runs retain the 14-day fast path for unaffected
courses and automatically rebuild older chat windows only where current
disclaimer consent changed.

## Trigger modes

Course admins can trigger the existing GraphQL mutation:

```graphql
mutation RecomputeCourseAnalytics($courseId: String!, $mode: AnalyticsMode!) {
  recomputeCourseAnalytics(courseId: $courseId, mode: $mode)
}
```

- `INCREMENTAL` — scoped course recompute with the default 14-day window.
- `FINALIZE` — scoped course recompute without the incremental window; the
  nightly scanner uses this route for ended courses.
- `FULL` — guarded rebuild through the protected full workflow. It fails
  closed unless the worker was explicitly deployed with `allowFull=true`.

Freshness runs use `CANCEL_IN_PROGRESS` per course. A newer run can supersede
an older run for the same course. Full runs use one global `CANCEL_NEWEST`
group, so a running full rebuild is protected from later full requests.

## Status and logs

Read course status through the existing GraphQL course field:

```graphql
query CourseAnalyticsStatus($courseId: String!) {
  course(id: $courseId) {
    analyticsStatus {
      areAnalyticsValid
      analyticsLastComputedAt
      analyticsFinalizedAt
      chatAnalyticsValidAt
    }
  }
}
```

In Hatchet, inspect `recompute-learning-analytics` for incremental/finalize
runs and `recompute-learning-analytics-full` for guarded full runs. Task names
run from `s0-*` through `s14-*`; `s99-mark-analytics-valid` has every analytics
task as a parent and must run only after all parents succeed.

Use the pod logs for Python exceptions and per-script row counts:

```bash
kubectl --context <context> -n <namespace> logs \
  -l app.kubernetes.io/component=hatchet-worker-analytics \
  --since=2h --timestamps
```

`areAnalyticsValid=false` after a failure is expected. Do not set it manually;
only `s99-mark-analytics-valid` should mark a successful run valid.

## Failure and retry

1. Identify the first failed task in Hatchet and inspect its pod log.
2. Fix the underlying dependency or data precondition before retrying.
   Common categories are database connectivity, script 11 correlation
   prerequisites, and script 10 clustering/model memory pressure.
3. Prefer retriggering the complete course workflow with the original mode.
   Do not replay `s99-mark-analytics-valid` in isolation.
4. Ordinary tasks have two automatic retries. Script 10 has no automatic retry
   because its CPU/memory-heavy work should not repeat without operator review.
5. A superseded freshness run is intentionally canceled and is not an incident
   when the replacement completes.

Keep one pod and one slot until staging measurements show representative task
duration, peak RSS, database load, and model memory. The initial pod requests
200m CPU and 512 MiB memory with a 4 GiB memory limit; change them only from
recorded evidence.

## Cold rollback

Rollback must preserve single ownership:

1. Stop new manual triggers and wait for or deliberately cancel the active
   analytics run.
2. Roll back the complete Helm/GitOps revision, not only the image tag. The
   image, command, ports, probes, ConfigMap, and Secret contract must come from
   the same known-good worker generation. The historical TypeScript worker
   listens on port 3000, has no native `/health` endpoint, and does not
   register `learning-analytics-native-proof`.
3. Keep `Recreate` during rollback so the current pod is gone before the
   rollback pod starts.
4. Confirm only one analytics worker registration is live.
5. Verify the generation-specific contract:
   - Native Python: `/health` succeeds and
     `learning-analytics-native-proof` completes.
   - Historical TypeScript: the worker logs show successful registration;
     then run one scoped incremental recompute. Do not expect the native proof
     task or probes.

Never run the historical TypeScript analytics image and the native Python
image together. Both can subscribe to the same event names and duplicate
analytics work.
