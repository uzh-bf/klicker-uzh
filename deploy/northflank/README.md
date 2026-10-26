# Northflank preview bootstrap

The generic Devrouter controller owns preview admission, deadlines and teardown.
Klicker owns its build inputs, database initialization and synthetic fixtures.
The current consumer recipe is under qualification; no committed installation
policy enables automatic PR previews yet.

## Disposable PostgreSQL

`packages/prisma/scripts/northflankBootstrap.ts` initializes a newly allocated,
empty preview database. It defaults to dry-run and repeats target validation
under an advisory lock before writing. It refuses retained or partially
initialized targets. A partial failure requires a new environment.

The trusted runtime job injects these environment variables directly:

| Variable                                    | Purpose                                                              |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `KLICKER_NORTHFLANK_DISPOSABLE`             | Must equal `1`                                                       |
| `KLICKER_NORTHFLANK_POSTGRES_HOST`          | Exact private host of the owned addon                                |
| `KLICKER_NORTHFLANK_BOOTSTRAP_DATABASE_URL` | Privileged TLS URL for the fresh `klicker_test` database             |
| `KLICKER_NORTHFLANK_APP_PASSWORD`           | Fresh generation-scoped password for the restricted application role |
| `KLICKER_NORTHFLANK_HATCHET_PASSWORD`       | Optional separate password when Hatchet shares this addon            |
| `DRY_RUN`                                   | Writes require exactly `false`; otherwise validation only            |

The script rejects ambient `PG*` variables and other database URL overrides.
Controller credentials never belong in this job. Do not put injected values in
command arguments, files or logs.

Run inside the fixture image or the provisioned development container:

```sh
pnpm --filter @klicker-uzh/prisma exec tsx scripts/northflankBootstrap.ts
```

Write mode creates the restricted `klicker_test` role, gives it ownership of the
application and shadow databases, and marks both for the repository's existing
disposable-database guards. It verifies login and schema access using that role
after initialization. The optional Hatchet role is separate. Migration and seed
execution are later jobs using restricted credentials.

`pnpm --filter @klicker-uzh/prisma test:disposable` runs the bootstrap regression
cases alongside the existing disposable-database checks. These tests use
synthetic query clients and perform no database mutation.

## Remaining qualification

Fresh native execution must prove database initialization, generation-scoped
credential persistence, Hatchet token delivery and cleanup. Admission remains
disabled until the native expiry, access and deletion checks also pass. See the
[approved rollout plan](../../project/2026-10-26-devrouter-preview-rollout-plan.md)
for the remaining acceptance checks.
