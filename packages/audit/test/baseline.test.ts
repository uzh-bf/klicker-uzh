import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  type AssessmentBaselineContent,
  buildAssessmentBaseline,
} from '../src/baseline/build.js'

const capturedAt = '2026-08-12T10:00:00.000Z'

function contents(): AssessmentBaselineContent[] {
  return [
    {
      kind: 'LECTURER_PERMISSION',
      userId: randomUUID(),
      permission: 'OWNER',
      effective: true,
    },
    {
      kind: 'BLOCK',
      block: {
        blockId: 20,
        order: 1,
        timeLimitSeconds: 60,
        expiresAt: null,
        randomSelectionCount: null,
        execution: 0,
        status: 'SCHEDULED',
        startedAt: null,
        closedAt: null,
      },
    },
    {
      kind: 'ASSESSMENT_CONFIGURATION',
      courseId: randomUUID(),
      configuration: {
        name: 'Internal title',
        displayName: 'Assessment',
        description: null,
        accessMode: 'RESTRICTED',
        publicationStatus: 'DRAFT',
        reviewStatus: 'REVIEWED',
        availableFrom: null,
        isLiveQAEnabled: false,
        isConfusionFeedbackEnabled: false,
        isModerationEnabled: true,
        isGamificationEnabled: false,
        isAssessmentEnabled: true,
        areInstancesOutdated: false,
        pointsMultiplier: 1,
        defaultPoints: 10,
        defaultCorrectPoints: 5,
        maximumBonusPoints: 45,
        secondsToZeroBonus: 20,
        activeBlockId: null,
      },
    },
  ]
}

describe('assessment baseline builder', () => {
  it('sorts parts deterministically and derives an incremental aggregate', () => {
    const baselineId = randomUUID()
    const input = contents()
    const forward = buildAssessmentBaseline({
      baselineId,
      baselineKind: 'CREATION',
      capturedAt,
      contents: input,
    })
    const reversed = buildAssessmentBaseline({
      baselineId,
      baselineKind: 'CREATION',
      capturedAt,
      contents: [...input].reverse(),
    })

    expect(forward).toEqual(reversed)
    expect(forward.parts.map((part) => part.partKey)).toEqual([
      'ASSESSMENT_CONFIGURATION|ROOT',
      'BLOCK|000000000020',
      expect.stringMatching(/^LECTURER_PERMISSION\|[0-9a-f-]{36}$/),
    ])
    expect(forward.root.aggregateHash).toMatch(/^[0-9a-f]{64}$/)
    expect(forward.root.expectedPartCounts).toEqual({
      configuration: 1,
      blocks: 1,
      elementInstances: 0,
      solutionsAndScoring: 0,
      participantEligibility: 0,
      lecturerPermissions: 1,
      mediaReferences: 0,
      limitations: 0,
    })
  })

  it('rejects duplicate part identities and non-allowlisted fields', () => {
    const duplicate = contents()[1]!
    expect(() =>
      buildAssessmentBaseline({
        baselineId: randomUUID(),
        baselineKind: 'CREATION',
        capturedAt,
        contents: [duplicate, duplicate],
      })
    ).toThrow('Duplicate assessment baseline part key')

    expect(() =>
      buildAssessmentBaseline({
        baselineId: randomUUID(),
        baselineKind: 'CREATION',
        capturedAt,
        contents: [
          {
            ...duplicate,
            pinCode: 'SECRET',
          } as unknown as AssessmentBaselineContent,
        ],
      })
    ).toThrow()
  })
})
