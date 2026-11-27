import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { activityInputContainsElementType } from '../src/services/activities.js'
import { manipulateGroupActivity } from '../src/services/groups.js'
import { manipulateLiveQuiz } from '../src/services/liveQuizzes.js'
import { manipulateMicroLearning } from '../src/services/microLearning.js'
import { manipulatePracticeQuiz } from '../src/services/practiceQuizzes.js'
import { createLiveQuizFromTemplate } from '../src/services/templates.js'

const qrElementId = 42
const qrElement = {
  id: qrElementId,
  type: DB.ElementType.QR_SCAN,
}
const qrStack = {
  order: 0,
  elements: [
    {
      order: 0,
      elementId: qrElementId,
      existingInstanceId: null,
      duplicateInstance: false,
    },
  ],
}

function createPlacementContext({
  existingGroupActivity = null,
}: {
  existingGroupActivity?: { status: DB.PublicationStatus } | null
} = {}) {
  const groupActivityUpdate = vi.fn()
  const ctx = {
    user: { sub: 'qr-placement-owner' },
    prisma: {
      course: {
        findUnique: vi.fn().mockResolvedValue({
          isGamificationEnabled: false,
          isAssessmentEnabled: false,
        }),
      },
      elementInstance: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      element: {
        findMany: vi.fn().mockResolvedValue([qrElement]),
      },
      groupActivity: {
        findUnique: vi.fn().mockResolvedValue(existingGroupActivity),
        update: groupActivityUpdate,
      },
    },
  } as unknown as ContextWithUser

  return { ctx, groupActivityUpdate }
}

function expectQrPlacementRejection(
  action: () => Promise<unknown>,
  message = 'QR scan questions are only supported in escape room activities'
) {
  return expect(action()).rejects.toMatchObject({
    message,
    extensions: { code: 'BAD_USER_INPUT' },
  })
}

describe('QR scan activity placement guards', () => {
  it('detects new, retained, and duplicated QR scan placements', () => {
    expect(
      activityInputContainsElementType({
        stacksOrBlocks: [qrStack],
        persistentInstances: [],
        duplicationInstances: [],
        elementMap: { [qrElementId]: qrElement },
        type: DB.ElementType.QR_SCAN,
      })
    ).toBe(true)

    const retainedStack = {
      order: 0,
      elements: [
        {
          order: 0,
          elementId: qrElementId,
          existingInstanceId: 7,
          duplicateInstance: false,
        },
      ],
    }
    expect(
      activityInputContainsElementType({
        stacksOrBlocks: [retainedStack],
        persistentInstances: [{ id: 7, elementType: DB.ElementType.QR_SCAN }],
        duplicationInstances: [],
        elementMap: {},
        type: DB.ElementType.QR_SCAN,
      })
    ).toBe(true)

    expect(
      activityInputContainsElementType({
        stacksOrBlocks: [retainedStack],
        persistentInstances: [],
        duplicationInstances: [{ id: 7, elementType: DB.ElementType.QR_SCAN }],
        elementMap: {},
        type: DB.ElementType.QR_SCAN,
      })
    ).toBe(true)
  })

  it('rejects QR scans in practice quizzes', async () => {
    const { ctx } = createPlacementContext()

    await expectQrPlacementRejection(
      () =>
        manipulatePracticeQuiz(
          {
            name: 'Practice quiz',
            displayName: 'Practice quiz',
            stacks: [qrStack],
            courseId: 'course-id',
            multiplier: 1,
            order: DB.ElementOrderType.SEQUENTIAL,
            resetTimeDays: 1,
          },
          ctx
        ),
      'QR scan questions are only supported in escape room activities'
    )
  })

  it('rejects QR scans in microlearnings', async () => {
    const { ctx } = createPlacementContext()

    await expectQrPlacementRejection(
      () =>
        manipulateMicroLearning(
          {
            name: 'Microlearning',
            displayName: 'Microlearning',
            stacks: [qrStack],
            courseId: 'course-id',
            multiplier: 1,
            startDate: new Date(),
            endDate: new Date(Date.now() + 60_000),
          },
          ctx
        ),
      'QR scan questions are only supported in escape room activities'
    )
  })

  it('rejects QR scans in non-escape-room group activities before edit side effects', async () => {
    const { ctx, groupActivityUpdate } = createPlacementContext({
      existingGroupActivity: { status: DB.PublicationStatus.DRAFT },
    })

    await expectQrPlacementRejection(
      () =>
        manipulateGroupActivity(
          {
            id: 'group-activity-id',
            name: 'Group activity',
            displayName: 'Group activity',
            stack: qrStack,
            clues: [],
            courseId: 'course-id',
            multiplier: 1,
            startDate: new Date(),
            endDate: new Date(Date.now() + 60_000),
          },
          ctx
        ),
      'QR scan questions are only supported in escape room activities'
    )
    expect(groupActivityUpdate).not.toHaveBeenCalled()
  })

  it('rejects QR scans in non-escape-room live quizzes', async () => {
    const { ctx } = createPlacementContext()

    await expectQrPlacementRejection(() =>
      manipulateLiveQuiz(
        {
          name: 'Live quiz',
          displayName: 'Live quiz',
          blocks: [qrStack],
          multiplier: 1,
          isGamificationEnabled: false,
          isPinProtected: false,
          isConfusionFeedbackEnabled: false,
          isLiveQAEnabled: false,
          isModerationEnabled: false,
        },
        ctx
      )
    )
  })

  it('rejects new QR scans in live-quiz template input before database access', async () => {
    const databaseAccess = vi.fn(() => {
      throw new Error('database accessed')
    })
    const ctx = {
      user: { sub: 'qr-placement-owner' },
      prisma: new Proxy(
        {},
        {
          get: databaseAccess,
        }
      ),
    } as unknown as ContextWithUser

    await expectQrPlacementRejection(() =>
      createLiveQuizFromTemplate(
        {
          templateId: 'template-id',
          name: 'Template quiz',
          displayName: 'Template quiz',
          isGamificationEnabled: false,
          blocks: [
            {
              order: 0,
              elements: [
                {
                  order: 0,
                  useExistingElement: false,
                  useNewElement: true,
                  newElement: {
                    type: DB.ElementType.QR_SCAN,
                    name: 'QR scan',
                    content: 'Scan this code',
                  },
                },
              ],
            },
          ],
        },
        ctx
      )
    )
    expect(databaseAccess).not.toHaveBeenCalled()
  })
})
