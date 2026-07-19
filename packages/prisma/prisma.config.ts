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
