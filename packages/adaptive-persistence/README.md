# Adaptive Persistence

Build-time Prisma schema composition for the adaptive-learning persistence
fragments. The package is AGPL-3.0; see [LICENSE.md](./LICENSE.md).

## Host integration

Run composition before every Prisma command. The host owns its source schema,
migration directory, datasource, generators, and database operations.

```ts
import { composeAdaptivePrismaSchema } from '@klicker-uzh/adaptive-persistence/compose'

const composed = composeAdaptivePrismaSchema({
  schemaDirectory: 'src/prisma/schema',
  migrationsDirectory: 'src/prisma/schema/migrations',
  outputDirectory: 'src/prisma/.adaptive-schema',
})

export default defineConfig({
  schema: composed.schema,
  migrations: { path: composed.migrations },
})
```

For Analytics, run the same composition before its Python Prisma command and
point it at the returned schema directory. Omit `migrationsDirectory` for this
schema-only mode; it returns `migrations: undefined`. Its `py.prisma` remains
a host source fragment, so its generator settings and relative paths are
preserved. Docker may compose an equivalent build-only schema directory by
copying the package fragments into the image; it must not overlay tracked
host source.

## First shared deployment

The single `20260929000000_adaptive_learning` migration creates the final
adaptive schema after the host migrations. It replaces 28 development-only
migrations that were applied only to local test databases. The obsolete standalone
`AdaptiveAssessment` model is excluded; adaptive practice quizzes use competence
trees and their own attempt/response records. Intermediate adaptive backfills and
their fixtures are intentionally omitted; existing non-adaptive host rows are
preserved. Future deployed migrations must remain immutable.

Run `pnpm --filter @klicker-uzh/prisma verify:adaptive-migration` against an
explicit disposable local PostgreSQL admin URL. The verifier reads the host
history and bootstrap separately to test clean installation, preservation of
existing host rows/defaults, database guards, and complete transaction rollback.
It creates and drops only its uniquely named rehearsal databases.

A local database using the old development history must not run migrate deploy
with this new history. Keep its matching old checkout for demo review, or rebuild
a disposable database with the new migrations. Do not reset a seeded demo or
rewrite its `_prisma_migrations` entries as part of this change. An old generated
`.adaptive-schema` directory will be rejected by the composition ownership guard;
inspect it for locally authored migrations before discarding that generated
output and recomposing.
