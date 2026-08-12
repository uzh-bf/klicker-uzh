import { randomUUID } from 'node:crypto'
import { DisplayMode, type ElementData } from '@klicker-uzh/types'
import { describe, expect, it } from 'vitest'
import { buildAssessmentBaselineContents } from '../src/services/assessmentAuditBaseline.js'
import {
  assessmentIsSelectedForAuditActivation,
  readAssessmentAuditRolloutConfig,
} from '../src/services/assessmentAuditActivation.js'

describe('assessment audit baseline snapshot mapping', () => {
  it('whitelists effective assessment, scoring, eligibility and permission state', () => {
    const courseId = randomUUID()
    const participantId = randomUUID()
    const inactiveParticipantId = randomUUID()
    const userId = randomUUID()
    const contents = buildAssessmentBaselineContents({
      snapshot: {
        id: randomUUID(),
        name: 'Internal name',
        displayName: 'Assessment display name',
        description: 'Description',
        accessMode: 'RESTRICTED',
        status: 'DRAFT',
        reviewStatus: 'REVIEWED',
        availableFrom: null,
        isLiveQAEnabled: false,
        isConfusionFeedbackEnabled: false,
        isModerationEnabled: true,
        isGamificationEnabled: false,
        isAssessmentEnabled: true,
        areInstancesOutdated: false,
        pointsMultiplier: 2,
        defaultPoints: 10,
        defaultCorrectPoints: 5,
        maxBonusPoints: 45,
        timeToZeroBonus: 20,
        activeBlockId: null,
        courseId,
        pinCode: 'MUST_NOT_LEAK',
        blocks: [
          {
            id: 11,
            order: 0,
            timeLimit: 60,
            expiresAt: null,
            randomSelection: null,
            execution: 0,
            status: 'SCHEDULED',
            startedAt: null,
            closedAt: null,
            elements: [
              {
                id: 21,
                order: 0,
                elementId: 31,
                isVersionOutdated: false,
                options: { basePoints: true, pointsMultiplier: 3 },
                elementData: {
                  id: '31-v4',
                  elementId: 31,
                  type: 'SC',
                  name: 'Question',
                  content: 'Question content',
                  explanation: 'Explanation',
                  basePoints: true,
                  pointsMultiplier: 1,
                  options: {
                    hasSampleSolution: true,
                    hasAnswerFeedbacks: true,
                    displayMode: DisplayMode.LIST,
                    choices: [
                      {
                        ix: 1,
                        value: 'Wrong',
                        correct: false,
                        feedback: 'No',
                      },
                      {
                        ix: 0,
                        value: 'Correct',
                        correct: true,
                        feedback: 'Yes',
                      },
                    ],
                  },
                } as unknown as ElementData,
              },
            ],
          },
        ],
        participations: [
          { participantId, isActive: true },
          { participantId: inactiveParticipantId, isActive: false },
        ],
        permissions: [{ userId, permissionLevel: 'OWNER', effective: true }],
      },
      capturedMedia: [],
      limitations: [],
    })

    expect(contents).toHaveLength(6)
    expect(contents).toContainEqual({
      kind: 'PARTICIPANT_ELIGIBILITY',
      participantId,
      eligible: true,
    })
    expect(JSON.stringify(contents)).not.toContain(inactiveParticipantId)
    expect(contents).toContainEqual({
      kind: 'LECTURER_PERMISSION',
      userId,
      permission: 'OWNER',
      effective: true,
    })
    expect(contents).toContainEqual(
      expect.objectContaining({
        kind: 'SOLUTION_AND_SCORING',
        elementInstanceId: 21,
        scoring: {
          elementType: 'SC',
          basePointsEnabled: true,
          pointsMultiplier: 3,
          scoringRules: { kind: 'SC', correctOptionIds: [0] },
        },
      })
    )
    expect(JSON.stringify(contents)).not.toContain('MUST_NOT_LEAK')
  })
})

describe('assessment audit rollout configuration', () => {
  it('defaults to disabled and requires an explicit pilot allowlist', () => {
    expect(readAssessmentAuditRolloutConfig({})).toMatchObject({
      mode: 'disabled',
    })
    expect(() =>
      readAssessmentAuditRolloutConfig({ ASSESSMENT_AUDIT_ROLLOUT: 'pilot' })
    ).toThrow('ASSESSMENT_AUDIT_PILOT_LIVE_QUIZ_IDS is required')
  })

  it('selects only the pilot allowlist while all selects every quiz', () => {
    const selectedId = randomUUID()
    const otherId = randomUUID()
    const pilot = readAssessmentAuditRolloutConfig({
      ASSESSMENT_AUDIT_ROLLOUT: 'pilot',
      ASSESSMENT_AUDIT_PILOT_LIVE_QUIZ_IDS: selectedId,
    })

    expect(assessmentIsSelectedForAuditActivation(selectedId, pilot)).toBe(true)
    expect(assessmentIsSelectedForAuditActivation(otherId, pilot)).toBe(false)
    expect(
      assessmentIsSelectedForAuditActivation(
        otherId,
        readAssessmentAuditRolloutConfig({
          ASSESSMENT_AUDIT_ROLLOUT: 'all',
        })
      )
    ).toBe(true)
  })
})
