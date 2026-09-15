import { randomUUID } from 'node:crypto'
import { DisplayMode, type ElementData } from '@klicker-uzh/types'
import { describe, expect, it, vi } from 'vitest'
import {
  prepareAssessmentAuditActivation,
  prepareReopeningAssessmentAuditActivation,
} from '../src/services/assessmentAuditActivation.js'
import type { AssessmentBaselineSnapshot } from '../src/services/assessmentAuditBaseline.js'
import { buildAssessmentMutationAuditDrafts } from '../src/services/assessmentAuditProducers.js'

// These sources intentionally have no reachable image data or storage credentials.
const urls = [
  'https://unreachable.blob.core.windows.net/old/image.png',
  'https://external.invalid/explanation.svg',
  'https://deleted.invalid/feedback.png',
]

function snapshot(): AssessmentBaselineSnapshot {
  const courseId = randomUUID()
  const participantId = randomUUID()
  const inactiveParticipantId = randomUUID()
  const userId = randomUUID()
  return {
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
              content: `![question](${urls[0]})`,
              explanation: `![explanation](${urls[1]})`,
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
                    feedback: `![feedback](${urls[2]})`,
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
  }
}

describe('URL-only assessment image evidence', () => {
  it.each([
    'CREATION',
    'REOPENING',
    'ROLLOUT_CONFIGURATION_CURRENT_STATE',
  ] as const)('prepares %s with image URLs and no media dependency', async (kind) => {
    const state = snapshot()
    const updateMany = vi.fn()
    const client = {
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue({ ...state, course: null }),
      },
      assessmentAuditScope: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({}),
        updateMany,
      },
      get mediaFile() {
        throw new Error(
          'URL-only evidence must not query image storage metadata'
        )
      },
    } as unknown as Parameters<
      typeof prepareAssessmentAuditActivation
    >[0]['client']
    const input = { client, liveQuizId: state.id }
    const prepared =
      kind === 'REOPENING'
        ? await prepareReopeningAssessmentAuditActivation(input)
        : await prepareAssessmentAuditActivation({
            ...input,
            baselineKind: kind,
          })
    const evidence = JSON.stringify(prepared.parts)
    for (const url of urls) expect(evidence).toContain(url)
    expect(prepared.capturedMedia).toEqual([])
    expect(prepared.limitations).toEqual([])
    expect(updateMany).not.toHaveBeenCalled()
    expect(evidence).not.toContain('MEDIA_REFERENCE')

    // Changing only the recorded URL must change the committed baseline hash.
    state.blocks[0]!.elements[0]!.elementData.content =
      '![changed](https://changed.invalid/image.png)'
    const changed =
      kind === 'REOPENING'
        ? await prepareReopeningAssessmentAuditActivation(input)
        : await prepareAssessmentAuditActivation({
            ...input,
            baselineKind: kind,
          })
    const originalElement = prepared.parts.find(
      (part) => part.content.kind === 'ELEMENT_INSTANCE'
    )!
    const changedElement = changed.parts.find(
      (part) => part.content.kind === 'ELEMENT_INSTANCE'
    )!
    expect(changedElement.content).not.toEqual(originalElement.content)
    if (
      originalElement.content.kind !== 'ELEMENT_INSTANCE' ||
      changedElement.content.kind !== 'ELEMENT_INSTANCE'
    )
      throw new Error('Missing element evidence')
    expect(changedElement.content.effectiveContentHash).not.toEqual(
      originalElement.content.effectiveContentHash
    )
  })
})

describe('image URL changes in instance refresh evidence', () => {
  it('preserves old and new URLs without capture events or limitations', () => {
    const before = snapshot()
    const after = structuredClone(before)
    const element = after.blocks[0]!.elements[0]!
    element.elementData.id = '31-v5'
    element.elementData.content = '![new](https://new.invalid/image.png)'
    const drafts = buildAssessmentMutationAuditDrafts({
      before,
      after,
      producerOperationId: randomUUID(),
    })
    const refresh = drafts.find(
      (draft) => draft.eventType === 'ASSESSMENT_ELEMENT_INSTANCE_REFRESHED'
    )
    expect(refresh).toBeDefined()
    expect(JSON.stringify(refresh)).toContain(urls[0])
    expect(JSON.stringify(refresh)).toContain('https://new.invalid/image.png')
    expect(JSON.stringify(refresh)).toContain(urls[1])
    expect(JSON.stringify(refresh)).toContain(urls[2])
    expect(
      drafts.some(
        (draft) =>
          draft.eventType === 'ASSESSMENT_MEDIA_CAPTURED' ||
          draft.eventType === 'ASSESSMENT_MEDIA_REPLACED'
      )
    ).toBe(false)
    expect(JSON.stringify(drafts)).not.toContain('EXTERNAL_MEDIA_NOT_CAPTURED')
  })
})
