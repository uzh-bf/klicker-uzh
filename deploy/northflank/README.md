# Northflank preview bootstrap

The generic Devrouter controller owns preview admission, deadlines and teardown.
Klicker owns its build inputs, database initialization and synthetic fixtures.
The root preview manifest and rollout plan are prepared. No default workflow is
installed, and live admission remains disabled until qualification completes.
Provider-specific allocation, volume mounts and service environment bindings
stay in the private installation layer.

## Disposable PostgreSQL

`packages/prisma/scripts/northflankBootstrap.ts` initializes a newly allocated,
empty preview database. It defaults to dry-run and repeats target validation
under an advisory lock before writing. It refuses retained or partially
initialized targets. A partial failure requires a new environment.

The initial database may contain provider statistics views from
`pg_stat_statements` and `pg_stat_kcache`. Only their exact extension-owned view
names are exempt from the empty-schema check. Ordinary views, lookalike names,
other extension-owned relations and data-bearing relations still refuse initialization.
PostgreSQL 17 or later is required before any role is created.

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

Run from the repository root inside the provisioned development container, or
from `/app` inside the fixture image:

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

Native jobs use `node /app/deploy/northflank/bootstrap.mjs bootstrap` for the
one-time database initialization and `node /app/deploy/northflank/bootstrap.mjs
fixtures` for guarded migration deployment followed by synthetic seed data.
The wrapper resolves the package directory from its own location, accepts only
these two operations and bounds the complete operation to eight minutes. It
reports phases while suppressing raw child output that could contain runtime
credentials. The existing database identity and dry-run guards still apply.

Bootstrap CLI failures use exit codes `2` (input refusal), `3` (inspection
refusal before writes), `4` (write failure) and `5` (verification failure).
The wrapper emits `KLICKER_BOOTSTRAP_FAILURE_<code>` for these failures while
keeping raw child output suppressed. Every failed initialization still requires
a new generation.

The trusted installation runs initialization jobs only on creation, using the
provider's `runNodeOnce` fence and zero automatic retries. Refresh and extension
do not rerun successful jobs. Any initialization failure requires teardown and a
new generation, including failure of the verification after ownership changes.

## Remaining qualification

Live proof of native bootstrap, worker startup and task processing, network
access policy, controller expiry, extension and stop behavior, and complete
resource cleanup remains pending. This source slice prepares the manifest and
plan and does not prove native runtime behavior. See the
[approved rollout plan](../../project/2026-10-26-devrouter-preview-rollout-plan.md)
for the remaining acceptance checks.
