import { createAdaptiveDryRunSchema } from '@klicker-uzh/adaptive-server/schema/adaptiveDryRuns'
import builder from '../builder.js'

export const { AdaptiveDryRunRef, AdaptiveDryRunWorkspaceRef } =
  createAdaptiveDryRunSchema(builder)
