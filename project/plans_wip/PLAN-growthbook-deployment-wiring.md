# PLAN — GrowthBook deployment wiring

## Goal

Make the existing `@klicker-uzh/feature-flags` foundation configurable in all
five deployed Next.js images and all Kubernetes-deployed Node.js backend
workloads without initializing an SDK in applications that do not yet consume a
flag.

Browser builds receive the public GrowthBook SDK endpoint and client key from
GitHub Actions repository variables. Backend workloads receive the internal SDK
endpoint and SDK client key from one externally provisioned, shared Kubernetes
Secret plus the deployment environment from the Helm ConfigMap.

## Non-goals

- Creating GrowthBook features, SDK connections, or targeting rules.
- Using a GrowthBook management/admin API key in Klicker applications.
- Mounting `FeatureFlagProvider` or initializing `NodeFeatureFlagClient` before
  an app adopts a flag.
- Deploying GrowthBook or its proxy, changing CORS, or mutating live GitHub or
  Kubernetes configuration.
- Adding GrowthBook SDK support to the Python analytics app, Docusaurus docs,
  or the Office add-in.

## Design

### Credential and environment contract

- Staging browser builds read
  `vars.NEXT_PUBLIC_GROWTHBOOK_API_HOST_STG` and
  `vars.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY_STG`.
- Production browser builds read
  `vars.NEXT_PUBLIC_GROWTHBOOK_API_HOST_PRD` and
  `vars.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY_PRD`.
- The five Next.js Dockerfiles accept those values as build arguments so Next
  can inline them into the browser bundle.
- Helm renders `GROWTHBOOK_ENV` from a non-secret, environment-specific value.
- Node backend Deployments import `GROWTHBOOK_API_HOST` and
  `GROWTHBOOK_CLIENT_KEY` from the external `<release>-secret-growthbook`
  Secret. The latter is an SDK connection key, not a GrowthBook management API
  key.
- One SDK connection is shared per deployment environment because Klicker uses
  one GrowthBook project and typed flag registry. Per-app connections can be
  introduced later if payload filtering or independent rotation is required.

### Application scope

- Browser-ready: `auth`, `chat`, `frontend-control`, `frontend-manage`, and
  `frontend-pwa` (including the assessment image build).
- Node-ready: backend GraphQL (regular and assessment), OLAT API, LTI, response
  API (regular and assessment), and all three Hatchet worker Deployments.
- Auth and Chat receive browser configuration through their image builds. A
  future server-side flag in either hybrid app can opt into the shared Node
  Secret explicitly when it adds the Node adapter.

### Failure behavior

The shared adapters remain authoritative: missing configuration performs no SDK
fetch and evaluates flags as `false`. The shared Secret reference is optional,
so generic chart defaults and a rollout performed before external provisioning
do not block pod startup.

## Klicker feature-design checklist

- **Domain vocabulary:** no `User`, `Participant`, activity, or persistence
  contract changes. Future callers still provide the existing actor attributes.
- **Layer footprint:** five app Dockerfiles, twelve image workflows, `turbo.json`,
  the v3 Helm chart and staging/production values, plus feature-flag and
  CI/deployment documentation. No Prisma, GraphQL, i18n, or generated artifacts.
- **Auth:** unchanged; flags remain rollout controls and never authorization.
- **Gamification:** no points, XP, achievement, or leaderboard impact.
- **Async:** Hatchet behavior is unchanged; worker pods only become
  configuration-ready.
- **UI:** no visible change and no new strings or `data-cy` hooks.
- **Test level:** Prettier/YAML validation, Dockerfile/workflow contract checks,
  Helm rendering for staging and production, `helm lint`, and the repository
  checks proportionate to the final diff. Browser verification is not required
  because no provider or visible state changes.
- **Seeds/fixtures:** none.

## Slices

1. Wire public build arguments into the five Next images and twelve stg/prd
   workflows.
2. Add the shared backend SDK configuration and optional external Secret
   reference to the v3 chart and environment values.
3. Register the variables with Turborepo and document the operator setup and
   rollout order.
4. Render and validate both deployment environments; inspect every changed
   hunk.

## Progress

- 2026-08-21: mapped the existing GrowthBook package, all five Next image
  builds, v3 Helm workloads, and external-Secret deployment convention.
- 2026-08-21: current GrowthBook documentation confirmed that application SDKs
  use SDK client keys (`sdk-*`), while secret management API keys are for
  management integrations and are not required by Klicker runtimes.
- 2026-08-21: wired all five Next.js Dockerfiles and twelve staging/production
  image workflows, including the separate assessment PWA builds.
- 2026-08-21: wired nine Node.js Deployments to the optional shared GrowthBook
  Secret and rendered `GROWTHBOOK_ENV` for staging and production.
- 2026-08-21: Helm lint/render checks, repository checks, and the complete root
  build passed. The repository DevPod could not be used because its registered
  identity belongs to the primary checkout, so checks used the repository's
  exact Volta-pinned Node and pnpm versions on the host.
