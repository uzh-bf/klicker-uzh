# Hatchet Worker - Response Processor - Assessment

> **Shared image:** This workload uses the same Docker image as [[Hatchet Worker - Response Processor]] with different configuration/environment variables. See [[01-Assessment vs Non-assessment Split]] for details on how assessment mode is separated.

This is the **assessment-mode** deployment variant of the response processor worker.

## What differs from non-assessment

- `ASSESSMENT_MODE='true'` is injected via ConfigMap (`cm-hatchet-workers.yaml` → `config-hatchet-worker-response-processor-assessment`).
- The worker registers and runs assessment workflows:
  - consumes Hatchet event `response-received:assessment`
  - processes responses using assessment Redis + Prisma (persistent updates)
  - triggers aggregation via `response-processed:aggregation`
- Scheduling is typically **pinned to the assessment node pool** (see `06-Deployment Views/02-Node Pools and Scheduling.md`).

## Deployment (Helm)

- Values: `hatchet.workers.responseProcessorAssessment.*`
- Deployment template: `deploy/charts/klicker-uzh-v3/templates/deployment-hatchet-workers.yaml` (component `hatchet-worker-response-processor-assessment`)
- ConfigMap: `deploy/charts/klicker-uzh-v3/templates/cm-hatchet-workers.yaml` (`config-hatchet-worker-response-processor-assessment`)
- Secret: `{{ releaseFullname }}-secret-hatchet-worker-response-processor-assessment`

## Cross-links

- Concept: `07-Cross-cutting Concepts/01-Assessment vs Non-assessment Split.md`
