---
status: proposed
---

# Use KEDA-managed regular and spot pools for Hatchet workers

KlickerUZH will make KEDA the horizontal replica owner for each explicit
Hatchet worker profile. A critical or latency-protecting floor runs in a regular
Deployment, while retry-safe excess capacity runs in a separate spot Deployment
above a regular-capacity threshold. KEDA derives demand from queued plus running
Hatchet task statistics; Prometheus supplies observability and the narrow burst
busy-worker lower bound needed for safe scale-down.

## Considered options

- One Deployment with preferred spot affinity cannot guarantee regular-first
  capacity and was rejected.
- Queue depth alone can scale down while slots remain occupied and was rejected.
- Prometheus as the sole queue control path adds an unnecessary dependency and
  was rejected while Hatchet task statistics remain suitable.

## Consequences

Each spot-eligible profile has distinct regular and burst identities,
Deployments, placement, ceilings, and fallbacks. Assessment and control work
remain regular-only. Resource-request changes from Goldilocks require a fresh
schedulability check before horizontal limits can be promoted.
