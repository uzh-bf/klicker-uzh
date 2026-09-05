// NOTE: the migrator image (packages/prisma/Dockerfile) copies this file into a
// container where ONLY the `prisma` package is installed. Imports here must stay
// limited to `prisma/config` — a workspace dependency (e.g. @prisma/adapter-pg)
// would build green and then fail module resolution in the ArgoCD PreSync hook.
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'src/prisma/schema',
  migrations: {
    path: 'src/prisma/schema/migrations',
    seed: 'pnpm --filter @klicker-uzh/prisma-data run seed:raw',
  },
  views: {
    path: 'src/prisma/schema/views',
  },
  typedSql: {
    path: 'src/prisma/schema/queries',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
      : {}),
  },
})
