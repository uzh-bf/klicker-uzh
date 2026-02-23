# Environments - stg vs prd

This note captures how “staging” and “production” deployments differ in practice, based on the checked-in UZH environment overlays (examples in `deploy/env-uzh-stg/values.yaml` and `deploy/env-uzh-prd/values.yaml`).

> Public-safe rule: treat `deploy/env-uzh-*` as examples; don’t copy internal-only hostnames/endpoints into docs unless explicitly labeled as examples.

## How environments are modeled

- The Helm chart provides defaults in `deploy/charts/klicker-uzh-v3/values.yaml`.
- Each environment overrides these defaults via an overlay `values.yaml`.

## Typical differences (observed in overlays)

- **Domains / app origins**: `global.appOrigins.*` differ between staging and production (different base domains).
- **Priority classes**: overlays set `priorityClassName` to `staging-workload` vs `production-workload` (chart installs both PriorityClasses).
- **Replica counts**: production generally runs higher `replicaCount` for frontends/backends/workers; staging keeps counts low.
- **Image tags**: staging may use a moving tag (e.g., `v3`), while production pins versioned tags (example: `v3.x.y-*`).
- **Spreading**: production overlays often add `topologySpreadConstraints` across zone/hostname for critical workloads; staging may rely on (preferred) pod anti-affinity only.
- **Assessment pinning**: both environments pin assessment workloads to dedicated nodes via node affinity + tolerations (see `06-Deployment Views/02-Node Pools and Scheduling.md`).
- **Ingress**: certificate issuer annotations and ingress class names can differ per environment.

## Where to look in the repo

- Staging overlay: `deploy/env-uzh-stg/values.yaml` (example)
- Production overlay: `deploy/env-uzh-prd/values.yaml` (example)
- Chart templates: `deploy/charts/klicker-uzh-v3/templates/`
