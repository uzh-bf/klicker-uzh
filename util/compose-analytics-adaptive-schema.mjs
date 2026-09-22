import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { composeAdaptivePrismaSchema } from '../external/catalyst/packages/adaptive-persistence/src/compose.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const composed = composeAdaptivePrismaSchema({
  schemaDirectory: join(root, 'apps/analytics/prisma/schema'),
  outputDirectory: join(root, 'apps/analytics/prisma/.adaptive-schema'),
})

if (typeof composed.schema !== 'string' || composed.migrations !== undefined) {
  throw new Error('Analytics composition must return only a schema path.')
}

console.log(composed.schema)
