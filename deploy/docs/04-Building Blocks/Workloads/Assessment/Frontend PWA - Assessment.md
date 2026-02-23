# Frontend PWA - Assessment

> **Shared image:** This workload uses the same Docker image as [[Frontend PWA]] with different configuration/environment variables. See [[01-Assessment vs Non-assessment Split]] for details on how assessment mode is separated.

This is the **assessment-mode** deployment variant of the student PWA.

## What differs from non-assessment

- A front-end assessment flag is enabled (`NEXT_PUBLIC_IS_ASSESSMENT='true'`), which switches UI labels and drives assessment-only GraphQL queries (see `apps/frontend-pwa/src/pages/index.tsx`).
- SSR GraphQL traffic is routed to the assessment backend via `API_URL_SSR` from `cm-frontend-assessment.yaml` (`backend-assessment` service DNS).
- Response submissions use an assessment-specific ingestion endpoint via `NEXT_PUBLIC_ADD_RESPONSE_URL` (same client submission code, different target).
- Different ingress host/domain is used (separate assessment PWA host).
- Scheduling is typically pinned to the assessment node pool (see `06-Deployment Views/02-Node Pools and Scheduling.md`).

## Deployment (Helm)

- Values: `assessment.frontendPWA.*`
- Deployment template: `deploy/charts/klicker-uzh-v3/templates/deployment-assessment.yaml` (component `frontend-assessment`)
- ConfigMap: `deploy/charts/klicker-uzh-v3/templates/cm-frontend-assessment.yaml`
- Secret: `{{ releaseFullname }}-secret-frontend-assessment`
- Ingress: `deploy/charts/klicker-uzh-v3/templates/ingress-frontend-assessment.yaml`

## Cross-links

- Concept: `07-Cross-cutting Concepts/01-Assessment vs Non-assessment Split.md`
- Workload: `04-Building Blocks/Workloads/Klicker/Frontend PWA.md`
- Backend variant: `04-Building Blocks/Workloads/Assessment/Backend GraphQL - Assessment.md`
