import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EVENT_REGISTRY } from '../src/index.js'

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

const producerSources = {
  'assessment audit activation and baseline service': {
    durabilityPoint: 'coverage/baseline transaction commit',
    paths: [
      'packages/graphql/src/services/assessmentAudit.ts',
      'packages/graphql/src/services/assessmentAuditActivation.ts',
      'packages/graphql/src/services/assessmentAuditRollout.ts',
    ],
  },
  'LiveQuiz lifecycle services and scheduled workers': {
    durabilityPoint: 'lifecycle transaction commit',
    paths: [
      'packages/graphql/src/services/assessmentAuditProducers.ts',
      'packages/graphql/src/services/liveQuizzes.ts',
      'packages/graphql/src/services/templates.ts',
    ],
  },
  'LiveQuiz content and configuration services': {
    durabilityPoint: 'content/configuration transaction commit',
    paths: [
      'packages/graphql/src/services/assessmentAuditProducers.ts',
      'packages/graphql/src/services/elements.ts',
    ],
  },
  'assessment eligibility and permission services': {
    durabilityPoint: 'eligibility/permission transaction commit',
    paths: [
      'packages/audit/src/producers/assessment.ts',
      'packages/graphql/src/services/assessmentAuditProducers.ts',
      'packages/graphql/src/services/sharing.ts',
    ],
  },
  'LiveQuiz runtime session transitions': {
    durabilityPoint: 'runtime transition transaction commit',
    paths: ['packages/graphql/src/services/liveQuizzes.ts'],
  },
  'authenticated assessment endpoints and workers': {
    durabilityPoint: 'standalone audit transaction commit',
    paths: [
      'packages/graphql/src/services/assessmentAuditProducers.ts',
      'packages/graphql/src/services/liveQuizzes.ts',
    ],
  },
  'response and scoring administration services': {
    durabilityPoint: 'response/scoring transaction commit',
    paths: [
      'packages/graphql/src/services/assessmentAuditProducers.ts',
      'packages/graphql/src/services/courses.ts',
      'packages/graphql/src/services/liveQuizzes.ts',
    ],
  },
  'assessment bulk services and workers': {
    durabilityPoint: 'per-effect transaction commit',
    paths: ['packages/graphql/src/services/courses.ts'],
  },
  'assessment report service': {
    durabilityPoint: 'report transaction commit',
    paths: [
      'packages/graphql/src/services/assessmentReports.ts',
      'packages/graphql/src/services/verification.ts',
    ],
  },
} as const

describe('launch lecturer and system producer coverage', () => {
  const registrations = Object.entries(EVENT_REGISTRY).filter(
    ([, registration]) =>
      registration.tier === 'LAUNCH' &&
      registration.ownerPackage === '@klicker-uzh/graphql'
  )

  it('maps every event to one declared producer family and durability point', () => {
    for (const [eventType, registration] of registrations) {
      const mapping =
        producerSources[registration.producer as keyof typeof producerSources]
      expect(mapping, eventType).toBeDefined()
      expect(mapping?.durabilityPoint, eventType).toBe(
        registration.durabilityPoint
      )
    }
  })

  it('requires every launch event name to occur in its production sources', () => {
    for (const [eventType, registration] of registrations) {
      const mapping =
        producerSources[registration.producer as keyof typeof producerSources]
      if (mapping === undefined) throw new Error(eventType)
      const productionSource = mapping.paths
        .map((path) => readFileSync(resolve(repositoryRoot, path), 'utf8'))
        .join('\n')
      expect(productionSource, eventType).toContain(eventType)
    }
  })
})
