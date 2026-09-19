---
type: Design
title: Hatchet Worker Development Startup Ordering
description: Define deterministic local Hatchet package build and worker startup ordering.
timestamp: '2026-07-21'
tags:
  - hatchet
  - development
  - turborepo
---

# Hatchet Worker Development Startup Ordering

## Problem

The general Hatchet worker imports `@klicker-uzh/hatchet` through the
package's generated `dist` output. The root Turborepo development tasks do
not currently require that package's build to finish before persistent
development processes start. On a clean startup, the worker can therefore
fail its initial import and remain idle, leaving workflows such as
`ingest-kb-resource` unregistered in local Hatchet.

## Design

Add `@klicker-uzh/hatchet#build` as an explicit prerequisite in `turbo.json`
for the four development task variants that share the local application
stack:

- `dev`
- `dev:lti`
- `dev:offline`
- `dev:assessment`

This follows the repository's existing explicit package-build dependency
pattern. It also follows Turborepo's package-specific `package#task`
ordering mechanism: each persistent development task starts only after the
Hatchet package build succeeds.

Clean-start verification exposed a second, independent failure in the
existing development runtime. Hatchet SDK 1.9.4 assumes every heartbeat
worker-thread message contains a log-level `type`, while `tsx --watch` sends
unrelated control messages over the same worker-thread channel. Run the
Hatchet workers without `tsx --watch` instead of importing and modifying the
SDK's internal logger implementation. They remain persistent Turbo tasks and
can be restarted when their source changes. The general worker's Pino
development formatter stays in-process; production JSON logging remains
unchanged.

## Runtime Flow

1. A developer starts one of the four supported development variants.
2. Turborepo builds the Hatchet package before starting persistent `dev`
   processes.
3. Both Hatchet workers run without a `tsx --watch` control thread; the general
   worker uses in-process pretty formatting.
4. The general worker imports a complete Hatchet package and registers its
   workflows with local Hatchet.
5. A resource Ingest request can enqueue `ingest-kb-resource`, which can then
   dispatch the configured external ingestion workflow.

## Error Handling

Build failures remain visible through Turbo and prevent the persistent
development processes from starting with incomplete dependencies. Normal
Hatchet log levels and existing worker/GraphQL error handling are unchanged.

## Verification

1. Validate `turbo.json` as JSON and run formatting checks for the file.
2. Inspect Turbo's dry-run task graph to confirm the Hatchet build precedes
   the general worker's development task.
3. Start the normal development stack from built dependencies and confirm a
   current `hatchet-worker-general` listener exists.
4. Confirm local Hatchet registers `ingest-kb-resource` and
   `monitor-kb-ingestions`.
5. Trigger one resource Ingest action and correlate it with the external run
   ID persisted on the resource.

## Scope

The change fixes local development startup and watch compatibility only. It
does not alter production deployment ordering, external Hatchet configuration,
FalkorDB connectivity, or the separate chat i18n module-resolution issue.
Knowledge-graph startup and dispatch verification belongs to the parked W9
scope.
