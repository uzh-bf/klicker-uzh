# Configuration and Secrets

This note documents where runtime configuration comes from (Helm values + ConfigMaps + Secrets) and the “public-safe” rules for documenting it.

## Configuration sources (non-secret)

In the Helm chart (`deploy/charts/klicker-uzh-v3/`), non-secret configuration is rendered into **ConfigMaps** and loaded via `envFrom`.

Examples:

- `templates/cm-global.yaml` renders `APP_ORIGIN_*` values from `global.appOrigins.*` as a canonical origin source of truth.
- `templates/cm-backend-graphql.yaml` renders domain/cookie settings and Hatchet client config (non-secret).
- Similar `cm-*.yaml` exist for auth, chat, response-api, assessment variants, and workers.

Config updates trigger rollouts via `checksum/config` annotations on Deployments.

## Secrets (referenced, not created)

Workloads load secrets via `envFrom.secretRef` (see `templates/deployment-*.yaml`). Secret manifests are **not** created by the chart, so they must be provisioned out-of-band with matching names.

Expected secret names (by workload):

- `{{ releaseFullname }}-secret-auth`
- `{{ releaseFullname }}-secret-frontend-pwa`
- `{{ releaseFullname }}-secret-frontend-manage`
- `{{ releaseFullname }}-secret-frontend-control`
- `{{ releaseFullname }}-secret-backend-graphql`
- `{{ releaseFullname }}-secret-frontend-assessment`
- `{{ releaseFullname }}-secret-backend-assessment`
- `{{ releaseFullname }}-secret-response-api`
- `{{ releaseFullname }}-secret-response-api-assessment`
- `{{ releaseFullname }}-secret-chat`
- `{{ releaseFullname }}-secret-lti`
- `{{ releaseFullname }}-secret-olat-api`
- `{{ releaseFullname }}-secret-hatchet-worker-general`
- `{{ releaseFullname }}-secret-hatchet-worker-response-processor`
- `{{ releaseFullname }}-secret-hatchet-worker-response-processor-assessment`

> Public-safe rule: document secret _categories_ (e.g., “Postgres connection string”, “Azure OpenAI key”), but never commit secret values or paste real secret manifests into this repo.

## TLS certificates (Ingress)

Ingress resources reference TLS `secretName`s (e.g., `klicker-*-tls`). These secrets are created externally (commonly via cert-manager) and are not treated as application secrets in this vault.

## Environment overlays (examples)

Environment overlays in `deploy/env-uzh-{stg,prd}/values.yaml` show how configuration is applied per environment. These files can contain UZH-specific domains and integration endpoints; when referencing them in docs, treat them as **examples** and avoid copying internal-only values verbatim.
