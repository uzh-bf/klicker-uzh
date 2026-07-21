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

No package scripts, application code, dependencies, environment variables,
or runtime retry loops will change.

## Runtime Flow

1. A developer starts one of the four supported development variants.
2. Turborepo builds the Hatchet package before starting persistent `dev`
   processes.
3. The general worker imports a complete Hatchet package and registers its
   workflows with local Hatchet.
4. A knowledge-graph Build request can enqueue
   `build-chatbot-knowledge-graph`, which can then dispatch the configured
   external `course-kg-ingestion` workflow.

## Error Handling

Build failures remain visible through Turbo and prevent the persistent
development processes from starting with incomplete dependencies. Existing
worker and GraphQL error handling remains unchanged.

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

The change fixes local development startup ordering only. It does not alter
production deployment ordering, external Hatchet configuration, FalkorDB
connectivity, or the separate chat i18n module-resolution issue.
