import { createAdaptiveAttemptDiagnosticsSchema } from '@klicker-uzh/adaptive-server/schema/adaptiveAttemptDiagnostics'
import builder from '../builder.js'

export const {
  AdaptiveAttemptDiagnosticsRef,
  AdaptiveAttemptDiagnosticRef,
  AdaptiveAttemptReviewRef,
  AdaptiveAttemptExpectedLevelInput,
  AdaptiveAttemptEstimateBackfillRef,
} = createAdaptiveAttemptDiagnosticsSchema(builder)
