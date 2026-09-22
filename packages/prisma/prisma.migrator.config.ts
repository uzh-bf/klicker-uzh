// Standalone migration-image config. It must not import workspace code.
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'src/prisma/schema',
  migrations: {
    path: 'src/prisma/schema/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
      : {}),
  },
})
