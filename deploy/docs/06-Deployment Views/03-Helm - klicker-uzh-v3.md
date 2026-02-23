# Helm - klicker-uzh-v3

This deployment is managed via the Helm chart in `deploy/charts/klicker-uzh-v3/`.

## What the chart deploys (high level)

- Kubernetes **Deployments** for the Klicker workloads (auth, frontends, backend, integrations), assessment variants, chat, response-api, and Hatchet workers.
- Kubernetes **Services** (`ClusterIP`) per workload (see `templates/service-app.yaml`).
- **Ingress** resources per workload (see `templates/ingress-*.yaml`) with TLS configured via `secretName` (certs are provisioned externally, e.g., via cert-manager).
- Per-workload **ConfigMaps** (`templates/cm-*.yaml`) and a shared `config-global` with canonical app origins (`templates/cm-global.yaml`).
- **PriorityClass** resources (`templates/priority-*.yaml`) used by workloads via `priorityClassName`.
- Optional **HPA** and **PDB** resources (templates present; enable/values depend on environment).

## Values structure (map)

Default values live in `deploy/charts/klicker-uzh-v3/values.yaml`. Environment overlays (examples) exist in:

- `deploy/env-uzh-stg/values.yaml`
- `deploy/env-uzh-prd/values.yaml`

Key value sections (non-exhaustive):

- `global.appOrigins.*` (canonical origins injected into all workloads)
- `auth`, `frontendPWA`, `frontendManage`, `frontendControl`
- `backendGraphql`, `olatApi`, `lti`, `responseApi`
- `assessment.*` (assessment PWA/backend/response-api settings)
- `chat` (chat deployment + Azure OpenAI config + MCP key)
- `hatchet.client.*` and `hatchet.workers.*`

## Config vs secrets

- **Non-secret config** is rendered into ConfigMaps (`*-config-*`) and mounted via `envFrom.configMapRef`.
- **Secrets are referenced, not created**: deployments use `envFrom.secretRef` with names like `{{ releaseFullname }}-secret-backend-graphql` (see `templates/deployment-*.yaml`).
  - The chart currently does **not** define `Secret` manifests; secrets must be provisioned out-of-band with matching names.

## Naming + labels

- Resource names are based on the Helm release name (`include "chart.fullname"`).
- Workloads are labeled with `app.kubernetes.io/component` (used by (anti-)affinity, topology spread, and for identifying pods).

## Rollout behavior

- Deployments include `checksum/config` annotations for the corresponding ConfigMaps, so config changes trigger a rollout.
- Some environments also enable `reloader.stakater.com/auto: 'true'` to reload pods when config changes.
