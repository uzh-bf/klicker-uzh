# Response API - Assessment

> **Shared image:** This workload uses the same Docker image as [[Response API]] with different configuration/environment variables. See [[01-Assessment vs Non-assessment Split]] for details on how assessment mode is separated.

This is the **assessment-mode** deployment variant of the Response API.

## What differs from non-assessment

- `ASSESSMENT_MODE='true'` is injected via ConfigMap (`cm-response-api-assessment.yaml`).
- The `/AddResponse` handler switches to assessment logic:
  - validates a `correlationKey` JWT (issuer: `APP_ORIGIN_ASSESSMENT_API`)
  - verifies the assessment participant session cookie JWT (issuer: `APP_ORIGIN_AUTH`)
  - deduplicates submissions via assessment Redis (votes hash keyed by `correlationId`)
  - emits Hatchet event `response-received:assessment` and audit-log events for traceability
- Scheduling is typically **pinned to the assessment node pool** (see `06-Deployment Views/02-Node Pools and Scheduling.md`).

## Deployment (Helm)

- Values: `assessment.responseApi.*`
- Deployment template: `deploy/charts/klicker-uzh-v3/templates/deployment-response-api.yaml` (component `response-api-assessment`)
- ConfigMap: `deploy/charts/klicker-uzh-v3/templates/cm-response-api-assessment.yaml`
- Secret: `{{ releaseFullname }}-secret-response-api-assessment`
- Ingress: `deploy/charts/klicker-uzh-v3/templates/ingress-response-api-assessment.yaml`

## Cross-links

- Concept: `07-Cross-cutting Concepts/01-Assessment vs Non-assessment Split.md`
