import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { STABLE_EVENT_TYPES } from '../src/index.js'

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

const producerSourcePaths = [
  'apps/hatchet-worker-response-processor/src/processors/assessmentAudit.ts',
  'apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts',
  'packages/audit/src/producers/assessment.ts',
  'packages/graphql/src/services/activities.ts',
  'packages/graphql/src/services/assessmentAudit.ts',
  'packages/graphql/src/services/assessmentAuditActivation.ts',
  'packages/graphql/src/services/assessmentAuditProducers.ts',
  'packages/graphql/src/services/assessmentAuditRollout.ts',
  'packages/graphql/src/services/assessmentReports.ts',
  'packages/graphql/src/services/courses.ts',
  'packages/graphql/src/services/elements.ts',
  'packages/graphql/src/services/liveQuizzes.ts',
  'packages/graphql/src/services/sharing.ts',
  'packages/graphql/src/services/templates.ts',
  'packages/graphql/src/services/verification.ts',
]

describe('audit event producer coverage', () => {
  it('registers only event types that a production source records', () => {
    const productionSource = producerSourcePaths
      .map((path) => readFileSync(resolve(repositoryRoot, path), 'utf8'))
      .join('\n')
    for (const eventType of STABLE_EVENT_TYPES) {
      // Retained version-1 media events are read compatibility only.
      if (
        eventType === 'ASSESSMENT_MEDIA_CAPTURED' ||
        eventType === 'ASSESSMENT_MEDIA_REPLACED'
      ) {
        continue
      }
      expect(productionSource, eventType).toContain(`'${eventType}'`)
    }
  })
})
