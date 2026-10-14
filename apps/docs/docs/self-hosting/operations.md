---
title: Operations and troubleshooting
sidebar_label: Operations and troubleshooting
---

# Operate your instance

**Healthy HTTP endpoints do not prove that responses are processed, email is delivered, or a backup is recoverable.** Test the complete workflows and the state outside PostgreSQL before inviting real users.

This checklist is source-derived. It does not certify availability, capacity, assessment suitability or recovery objectives for a particular installation.

## First-run acceptance

Use synthetic accounts and content on your own deployment:

- Confirm every browser request, redirect, image, telemetry call and support link reaches the destinations you intended; remove leftover UZH hosts
- Sign in to Manage with the provisioned lecturer, complete first-login settings, and verify delegated access has the intended scope
- Register and sign in through the PWA's current account/data-use form. Verify activation and magic-link messages actually arrive and their links resolve to your PWA
- Create a course and a scored live quiz with sample solutions; submit responses from at least three registered synthetic participants, close the block and end the quiz. Confirm persisted results, scoring and rank achievements; a one-person quiz does not exercise the required achievement reference data
- Verify live updates through the public ingress, not just localhost. Test a reconnect and more than one backend replica if you deploy replicas
- Upload a synthetic media image, then display it in Manage and PWA. Check CORS, anonymous reads and Next image optimization
- Exercise a background activity transition and check both Hatchet worker registrations and task completion, not merely task submission
- Restart an application container and verify retained data and login behavior. Test dependency failure/recovery in a non-production environment
- Verify that unconfigured optional features stay unavailable and do not emit jobs to external services

Config-derived HTTP checks (replace example origins):

```bash
curl --fail https://api.klicker.example.org/healthz
curl --fail https://response-api.klicker.example.org/healthz
```

The backend and Response API `/healthz` handlers are basic liveness responses, not continuous dependency checks. Response API pings both execution Redis services during startup; later health responses do not recheck them. Worker health servers expose `/healthz` and `/readyz`; readiness reports lifecycle state, not an independent Hatchet intake switch or an end-to-end delivery guarantee. Keep worker health ports internal and inspect your worker/Helm configuration for their actual ports.

The production backend accepts persisted GraphQL operations, not arbitrary queries. Test using matching built clients or repository-defined operations; changing `NODE_ENV` to make an ad-hoc query work weakens the deployment.

## Backups and restore

Define your recovery point and recovery time objectives, then test them on an isolated restore. The repository does not provide a complete backup/restore automation.

| State                            | What to preserve                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Application PostgreSQL           | All application records, schema and migration history; additional assessment database if separately deployed |
| Blob/object storage              | Original objects, paths and public URL contract; optional KB/artifact stores separately                      |
| Execution Redis                  | Active quizzes, response/score aggregation and other live state; assessment execution state separately       |
| Hatchet and its backing database | Accepted jobs, schedules, retry state and tenant configuration                                               |
| Optional integrations            | LTI database, graph/retrieval stores, model gateway state as applicable                                      |
| Deployment configuration         | Pinned image identities, reviewed configuration, DNS/proxy settings and access to securely stored secrets    |

Cache/pub-sub Redis is not the authoritative content database, but losing it interrupts real-time updates and cached state; validate recovery rather than assuming no effect. Execution Redis must not be treated as disposable cache.

A consistent recovery plan must account for work crossing PostgreSQL, Redis, storage and Hatchet. For a simple planned backup, stop new activity and uploads, drain or explicitly record in-flight workflows, and take coordinated snapshots. For online backups, establish and test an equivalent consistency/replay strategy. A database dump plus unrelated later object/queue snapshots is not automatically a consistent point in time.

Restore rehearsal:

1. Restore to an isolated network with outbound email, notifications, ingestion and model calls disabled. Do not let copied scheduled jobs contact real recipients or production services
2. Restore matching application data, required object versions, execution/queue state and configuration. Preserve the schema migration history and runtime migration records
3. Start the application image version compatible with the restored schema. Preserve object URLs, or explicitly plan reference migration and retained redirects before switching hosts
4. Check for pending/duplicated workflow dispatches and verify activity results before admitting traffic. Do not blindly replay every queued job
5. Run the first-run acceptance checklist and record the actual recovery time and missing-data window

Keep backups encrypted and access-controlled, including object backups and logs. Store restore credentials separately from the backups and test that the operator can access them. Never commit dumps, secrets, participant records, signed URLs or model keys to this public repository.

## Upgrades and rollback

1. Pin and inspect the target commit/release, migration SQL, configuration changes and external-service compatibility
2. Build all selected application and migrator images from that version. GraphQL client hashes and server persisted-operation maps must match; do not independently roll forward a frontend built against another API schema
3. Rehearse migrations and the user flows on an isolated copy/synthetic environment; take a recoverable backup
4. Run and wait for `prisma migrate deploy` using the [production migration path](./production.md#4-migrate-then-bootstrap-accounts-and-reference-data). With ArgoCD, inspect the PreSync Job result; with another controller, enforce ordering yourself
5. Roll out compatible workers and applications, accounting for pending Hatchet work. Observe error rates, job backlogs, failed tasks and Redis/database connectivity
6. Re-run smoke checks, including persisted results, email and media, before declaring the upgrade complete

The backend also runs application-level data migrations at startup. A failure can leave the server running in a degraded state and retry on restart, so a green liveness probe is insufficient. Inspect startup logs and migration records. Source: [runtime migrations](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/apps/backend-docker/src/migration.ts).

Rolling an image back does **not** roll the database back. Prefer backward-compatible schema changes; if the old application cannot use the new schema, use a planned forward fix or a rehearsed coordinated restore. Replacing a volume or running a development reset is not a rollback procedure.

## Security and data handling checklist

- Use HTTPS, secure cookies, strong independently generated credentials and least-privilege runtime accounts
- Keep secret values out of public environment variables, image layers, build logs, tickets and source control
- Configure exact response/upload origins and trusted redirect hosts; review the GraphQL ingress origin policy. Separate sensitive admin and worker interfaces from browser endpoints
- Do not expose MailHog, mock OIDC, development tools, Redis, databases or internal MCP servers publicly
- Treat media-library URLs as public. Keep private teaching documents in a separately reviewed private-document workflow
- Leave `TEAMS_WEBHOOK_URL` unset unless explicitly needed and reviewed: existing signup/magic-link notifications can include the complete activation/login link
- Review hosted-service assumptions in translated privacy/terms links, email footers, support/Catalyst request destinations, telemetry, remote fonts and static assets. UZH's notices and support address do not automatically describe or support your deployment
- Establish your own retention, access, disclosure, incident response and deletion policies before collecting participant data. Source licensing and the UZH hosted service's user terms are separate matters
- Configure limits and monitoring for HTTP requests, database connections, uploads, queue backlog and optional paid model usage. This guide does not provide a tested production sizing formula

## Troubleshooting

| Symptom                                                 | First checks                                                                                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser still calls UZH or an old hostname              | Inspect the built `NEXT_PUBLIC_*` values and rebuild the affected frontend. Runtime environment changes are insufficient                                                  |
| Login succeeds then immediately looks logged out        | Shared `APP_SECRET`; sibling-host cookie domain; HTTPS/secure cookies; API origin and backend `APP_*_SUBDOMAIN` matching; correct audience-specific redirect allowlist    |
| Edu-ID button errors on a delegated-only deployment     | `EDUID_CLIENT_SECRET` must be absent, not empty. Use delegated access; the current page may still display the unconfigured provider                                       |
| First lecturer cannot be created                        | Schema migration is not account bootstrap. Complete the reviewed first-user provisioning described in [Production](./production.md#first-lecturer-known-provisioning-gap) |
| Signup fails after entering a new username              | Check whether the participant row already exists, required EmailTemplate rows, SMTP logs and delivery. Do not repeatedly seed/reset to retry                              |
| Mail UI says success but nothing arrives                | Verify SMTP transport, template rows, actual provider delivery logs and PWA link origins. `EMAIL_TYPE=OAUTH` is not implemented                                           |
| Redis connection fails unexpectedly                     | Inspect host/port/password and TLS: a literal `false` still enables TLS in current clients                                                                                |
| Live quiz accepts input but scores/results never update | Check Response API routing/CORS, Hatchet tenant/token, response worker readiness, execution Redis and failed workflow logs                                                |
| Other activity action stalls or says workflow not found | General worker registration/health, matching Hatchet tenant, task version and database/Redis settings                                                                     |
| Live updates fail only through ingress                  | WebSocket upgrade and timeout configuration at `/api/graphql`; shared Redis pub/sub across replicas                                                                       |
| Unknown persisted operation                             | Frontend/backend builds are from different revisions or GraphQL generated artifacts are stale; rebuild matching images                                                    |
| Upload authorization works but browser PUT fails        | Blob CORS for the exact Manage origin, public endpoint reachability, account/container permissions and SAS validity. Never paste the signed query into an issue           |
| Image uploaded but will not display                     | Public blob-read policy, stable stored URL, image-host allowlist and frontend build-time `BLOB_STORAGE_ACCOUNT_URL`                                                       |
| Helm pods cannot start                                  | Inspect rendered Secret references, image tags, enabled optional workloads, PriorityClasses and migration ordering; the chart does not provision external dependencies    |
| AI/analytics unavailable despite running core apps      | Check account entitlement/approval, beta preference, rollout flags and actual optional services separately. Do not bypass by switching to development mode                |
| Healthy backend after failed migration                  | `/healthz` is not a data-integrity check. Inspect schema migration Job and application-level migration logs                                                               |

For help, provide the exact commit/image tags, which deployment path you used, sanitized failing service logs and the failing step. Do not include credentials, cookies, student data, database dumps or signed upload/login URLs. Historical [deployment-link feedback](https://github.com/uzh-bf/klicker-uzh/issues/4795) and [environment-variable feedback](https://github.com/uzh-bf/klicker-uzh/issues/3841) explain why the legacy installer links and institutional configuration cannot serve as current setup instructions. Use the project's [community](https://community.klicker.uzh.ch/) for discussion.
