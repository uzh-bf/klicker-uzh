# Hatchet Worker Development Startup Ordering

## Problem

The general Hatchet worker imports `@klicker-uzh/hatchet` through the
package's generated `dist` output. The root Turborepo development tasks do
not currently require that package's build to finish before persistent
development processes start. On a clean startup, the worker can therefore
fail its initial import and remain idle in `tsx --watch`, leaving workflows
such as `build-chatbot-knowledge-graph` unregistered in local Hatchet.

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
worker-thread message contains a log-level `type`, but `tsx --watch` also
sends control messages without that shape. The shared Hatchet logger therefore
accepts a no-op `undefined` method until that SDK behavior changes. The general
worker's Pino pretty formatter also runs in-process because `pino.transport()`
creates another worker thread that collides with the same watch mechanism.

No package scripts, dependencies, environment variables, or runtime retry
loops will change. Production JSON logging remains unchanged.

## Runtime Flow

1. A developer starts one of the four supported development variants.
2. Turborepo builds the Hatchet package before starting persistent `dev`
   processes.
3. The development logger absorbs non-Hatchet watch control messages and uses
   in-process pretty formatting.
4. The general worker imports a complete Hatchet package and registers its
   workflows with local Hatchet.
5. A knowledge-graph Build request can enqueue
   `build-chatbot-knowledge-graph`, which can then dispatch the configured
   external `course-kg-ingestion` workflow.

## Error Handling

Build failures remain visible through Turbo and prevent the persistent
development processes from starting with incomplete dependencies. The logger
compatibility handler ignores only messages that lack the SDK's expected log
type; normal Hatchet log levels and existing worker/GraphQL error handling are
unchanged.

## Verification

1. Validate `turbo.json` as JSON and run formatting checks for the file.
2. Inspect Turbo's dry-run task graph to confirm the Hatchet build precedes
   the general worker's development task.
3. Start the normal development stack from built dependencies and confirm a
   current `hatchet-worker-general` listener exists.
4. Confirm local Hatchet registers `build-chatbot-knowledge-graph`,
   `ingest-kb-resource`, and `monitor-kb-ingestions`.
5. Trigger one chatbot graph Build and correlate the local run with a new
   external `course-kg-ingestion` run ID persisted on the graph.

## Scope

The change fixes local development startup and watch compatibility only. It
does not alter production deployment ordering, external Hatchet configuration,
FalkorDB connectivity, or the separate chat i18n module-resolution issue.
