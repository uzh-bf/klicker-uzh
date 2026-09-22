// Compose the pinned Catalyst persistence fragments before Prisma commands.
import { defineConfig } from 'prisma/config'
import { composeAdaptivePrismaSchema } from '../../external/catalyst/packages/adaptive-persistence/src/compose.mjs'

const composed = composeAdaptivePrismaSchema({
  schemaDirectory: 'src/prisma/schema',
  migrationsDirectory: 'src/prisma/schema/migrations',
  outputDirectory: 'src/prisma/.adaptive-schema',
})

if (
  typeof composed.schema !== 'string' ||
  typeof composed.migrations !== 'string'
) {
  throw new Error(
    'Adaptive Prisma composition must return schema and migrations paths.'
  )
}

export default defineConfig({
  schema: composed.schema,
  migrations: {
    path: composed.migrations,
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
