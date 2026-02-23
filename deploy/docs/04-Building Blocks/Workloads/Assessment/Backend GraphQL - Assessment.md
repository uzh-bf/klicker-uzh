# Backend GraphQL - Assessment

> **Shared image:** This workload uses the same Docker image as [[Backend GraphQL]] with different configuration/environment variables. See [[01-Assessment vs Non-assessment Split]] for details on how assessment mode is separated.

This is the **assessment-mode** deployment variant of the main backend GraphQL service.

## What differs from non-assessment

- `ASSESSMENT_MODE='true'` is injected via ConfigMap (`cm-backend-assessment.yaml`).
- Different **domains/app origins** are configured (separate assessment API + PWA domains).
- Cookie parsing/auth handling changes in assessment mode (see `jwtMiddleware` in `apps/backend-docker/src/app.ts`).
- Scheduling is typically **pinned to the assessment node pool** (see `06-Deployment Views/02-Node Pools and Scheduling.md`).

## Deployment (Helm)

- Values: `assessment.backendGraphql.*` in the Helm chart overlay values
- Deployment template: `deploy/charts/klicker-uzh-v3/templates/deployment-assessment.yaml` (component `backend-assessment`)
- ConfigMap: `deploy/charts/klicker-uzh-v3/templates/cm-backend-assessment.yaml`
- Secret: `{{ releaseFullname }}-secret-backend-assessment`
- Ingress: `deploy/charts/klicker-uzh-v3/templates/ingress-backend-assessment.yaml`

## Cross-links

- Concept: `07-Cross-cutting Concepts/01-Assessment vs Non-assessment Split.md`
