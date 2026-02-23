# Node Pools and Scheduling

This note documents _how_ we intend to schedule workloads across node pools, and what is actually configured in-repo (Helm values + env overlays).

## Node pools (conceptual)

The overview architecture assumes a single AKS cluster with dedicated node pools for:

- **klicker**: main Klicker workloads (frontends, backend, integrations, workers)
- **assessment**: isolated assessment workloads (separate domains/config; pinned scheduling)
- **ai infra**: AI workloads and supporting services (chat + AI infra)

## What is currently configured (repo-grounded)

### Assessment pool pinning

The UZH environment overlays (examples in `deploy/env-uzh-{stg,prd}/values.yaml`) pin assessment workloads to a dedicated pool using:

- `affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution` with a node label constraint `klickerasm=reserved`
- a matching `tolerations` entry with `effect: NoSchedule`

This appears under multiple assessment workloads (e.g., assessment PWA, assessment backend, assessment response-api, assessment response-processor worker).

### Pod spreading (anti-affinity / topology spread)

Most workloads are configured with **pod anti-affinity** (preferred) by `app.kubernetes.io/component` to reduce same-node co-location.

In production overlays, some components also define **topologySpreadConstraints** across:

- `topology.kubernetes.io/zone`
- `kubernetes.io/hostname`

## How to change scheduling

Helm values expose scheduling knobs per workload:

- `*.nodeSelector`
- `*.affinity`
- `*.tolerations`
- (in some overlays) `*.topologySpreadConstraints`

These are consumed by the chart templates in `deploy/charts/klicker-uzh-v3/templates/deployment-*.yaml`.

## Open questions / to validate

- The overview canvas includes a dedicated **AI infra** node pool. In the checked-in UZH overlays, only the **assessment** pool is explicitly pinned via node affinity/taints. If AI infra scheduling is enforced elsewhere (e.g., cluster-level taints/labels or separate charts), document it here during Phase 2.
