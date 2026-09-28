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
copying the four package fragments into the image; it must not overlay tracked
host source.

Migration verifiers must require `KLICKER_HOST_ROOT`, compose the host schema,
and read `composed.migrations`. They must never read the package's historical
migrations directory directly. Composition performs no database work.
