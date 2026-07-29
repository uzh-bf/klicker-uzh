import { prisma as prismaClient } from '@klicker-uzh/prisma'
import {
  CodeSubmissionStatus,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  PrismaClient,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type {
  CodeSubmissionResult,
  ElementData,
  HatchetHandlerGlobalContext,
  PreparedHatchetTasks,
} from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  processElementData,
} from '@klicker-uzh/util'
import { randomUUID } from 'node:crypto'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  getCodeSubmission,
  handleRecoverCodeSubmissions,
  processCodeSubmission,
  submitCodeResponse,
} from '../src/services/codeSubmissions.js'
import {
  computeStackEvaluation,
  getPreviousStackEvaluation,
} from '../src/services/stacks.js'

const executorResult: CodeSubmissionResult = {
  pointsPercentage: 1,
  publicTestResults: [
    {
      id: 'public',
      name: 'Public example',
      passed: true,
      actualOutput: 3,
      stdout: '',
      stderr: '',
    },
  ],
  hiddenTestResults: [{ id: 'hidden', passed: true }],
}

describe('CODE submission lifecycle', () => {
  let prisma: PrismaClient
  const ownerIds: string[] = []
  const participantIds: string[] = []

  beforeAll(() => {
    prisma = prismaClient
  })

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: ownerIds.splice(0) } } })
    await prisma.participant.deleteMany({
      where: { id: { in: participantIds.splice(0) } },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  async function fixture(
    activityKind: 'practiceQuiz' | 'microLearning' = 'practiceQuiz'
  ) {
    const ownerId = randomUUID()
    const participantId = randomUUID()
    ownerIds.push(ownerId)
    participantIds.push(participantId)

    const owner = await prisma.user.create({
      data: {
        id: ownerId,
        email: `${ownerId}@example.test`,
        shortname: `owner-${ownerId.slice(0, 8)}`,
      },
    })
    const participant = await prisma.participant.create({
      data: {
        id: participantId,
        username: `participant-${participantId}`,
        password: 'test',
      },
    })
    const now = new Date()
    const course = await prisma.course.create({
      data: {
        name: `course-${ownerId}`,
        displayName: 'CODE lifecycle test',
        startDate: new Date(now.getTime() - 86_400_000),
        endDate: new Date(now.getTime() + 86_400_000),
        groupDeadlineDate: new Date(now.getTime() + 86_400_000),
        pinCode:
          (Number.parseInt(ownerId.replaceAll('-', '').slice(0, 8), 16) %
            9_000) +
          1_000,
        ownerId: owner.id,
        participations: {
          create: { participantId: participant.id, isActive: true },
        },
      },
    })
    const codeOptions = {
      language: 'python' as const,
      starterCode: 'def solve(a, b):\n    pass',
      entrypoint: 'solve',
      executionLimits: { perTestTimeoutSeconds: 5 as const },
      testCases: [
        {
          id: 'public',
          name: 'Public example',
          args: [1, 2],
          expectedOutput: 3,
          visibility: 'public' as const,
          weight: 1,
        },
        {
          id: 'hidden',
          name: 'Hidden example',
          args: [2, 3],
          expectedOutput: 5,
          visibility: 'hidden' as const,
          weight: 1,
        },
      ],
    }
    const element = await prisma.element.create({
      data: {
        type: ElementType.CODE,
        name: 'CODE',
        content: 'Return a sum',
        explanation: 'Use addition.',
        options: codeOptions,
        ownerId: owner.id,
      },
    })
    const codeElementData = processElementData(element) as Extract<
      ElementData,
      { type: 'CODE' }
    >

    const stackData = {
      type:
        activityKind === 'practiceQuiz'
          ? ElementStackType.PRACTICE_QUIZ
          : ElementStackType.MICROLEARNING,
      order: 0,
      courseId: course.id,
      elements: {
        create: {
          type:
            activityKind === 'practiceQuiz'
              ? ElementInstanceType.PRACTICE_QUIZ
              : ElementInstanceType.MICROLEARNING,
          elementType: ElementType.CODE,
          order: 0,
          options: { pointsMultiplier: 1, resetTimeDays: 6 },
          elementData: codeElementData,
          results: getInitialInstanceResults(codeElementData),
          anonymousResults: getInitialInstanceResults(codeElementData),
          elementId: element.id,
          ownerId: owner.id,
          instanceStatistics: { create: {} },
        },
      },
    }
    const activity =
      activityKind === 'practiceQuiz'
        ? await prisma.practiceQuiz.create({
            data: {
              name: `quiz-${ownerId}`,
              displayName: 'CODE quiz',
              status: PublicationStatus.PUBLISHED,
              ownerId: owner.id,
              courseId: course.id,
              stacks: { create: stackData },
            },
            include: {
              stacks: { include: { elements: true } },
            },
          })
        : await prisma.microLearning.create({
            data: {
              name: `micro-${ownerId}`,
              displayName: 'CODE microlearning',
              status: PublicationStatus.PUBLISHED,
              scheduledStartAt: new Date(now.getTime() - 86_400_000),
              scheduledEndAt: new Date(now.getTime() + 86_400_000),
              ownerId: owner.id,
              courseId: course.id,
              stacks: { create: stackData },
            },
            include: {
              stacks: { include: { elements: true } },
            },
          })
    const instance = activity.stacks[0]!.elements[0]!
    const runNoWait = vi.fn().mockResolvedValue({ workflowRunId: randomUUID() })
    const publish = vi.fn()
    const ctx = {
      user: {
        sub: participant.id,
        role: UserRole.PARTICIPANT,
        scope: UserLoginScope.ACCOUNT_OWNER,
        catalystInstitutional: false,
        catalystIndividual: false,
      },
      prisma,
      tasks: {
        gradeCodeSubmission: { runNoWait },
      } as unknown as PreparedHatchetTasks,
    } as ContextWithUser
    const globalCtx = {
      prisma,
      pubSub: { publish },
    } as unknown as HatchetHandlerGlobalContext

    return {
      course,
      participant,
      instance,
      ctx,
      globalCtx,
      runNoWait,
      publish,
    }
  }

  async function submit(
    data: Awaited<ReturnType<typeof fixture>>,
    code = 'def solve(a, b):\n    return a + b'
  ) {
    return await submitCodeResponse(
      {
        instanceId: data.instance.id,
        courseId: data.course.id,
        code,
        timeSpent: 12,
      },
      data.ctx
    )
  }

  async function addParticipant(data: Awaited<ReturnType<typeof fixture>>) {
    const participant = await prisma.participant.create({
      data: {
        username: `participant-${randomUUID()}`,
        password: 'test',
      },
    })
    participantIds.push(participant.id)
    await prisma.participation.create({
      data: {
        courseId: data.course.id,
        participantId: participant.id,
        isActive: true,
      },
    })
    return {
      participant,
      ctx: {
        ...data.ctx,
        user: { ...data.ctx.user, sub: participant.id },
      } as ContextWithUser,
    }
  }

  it('returns one active receipt for concurrent resubmissions', async () => {
    const data = await fixture()
    const [first, second] = await Promise.all([
      submit(data),
      submit(data, 'def solve(a, b):\n    return 0'),
    ])

    expect(second.id).toBe(first.id)
    expect(data.runNoWait).toHaveBeenCalledTimes(2)
    expect(
      await prisma.codeSubmission.count({
        where: { elementInstanceId: data.instance.id },
      })
    ).toBe(1)
  })

  it('keeps a pending receipt for recovery when enqueueing fails', async () => {
    const data = await fixture()
    data.runNoWait.mockRejectedValueOnce(new Error('workflow unavailable'))

    const receipt = await submit(data)
    expect(
      await prisma.codeSubmission.findUniqueOrThrow({
        where: { id: receipt.id },
      })
    ).toMatchObject({
      status: CodeSubmissionStatus.PENDING,
      failureCode: 'ENQUEUE_FAILED',
    })
  })

  it('rejects an inactive participation', async () => {
    const data = await fixture()
    await prisma.participation.update({
      where: {
        courseId_participantId: {
          courseId: data.course.id,
          participantId: data.participant.id,
        },
      },
      data: { isActive: false },
    })

    await expect(submit(data)).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    })
    expect(data.runNoWait).not.toHaveBeenCalled()
  })

  it('finalizes all response side effects exactly once', async () => {
    const data = await fixture()
    const receipt = await submit(data)
    const execute = vi.fn().mockResolvedValue(executorResult)

    expect(
      await processCodeSubmission(
        { submissionId: receipt.id },
        data.globalCtx,
        execute
      )
    ).toBe(true)
    expect(
      await processCodeSubmission(
        { submissionId: receipt.id },
        data.globalCtx,
        execute
      )
    ).toBe(false)

    const [
      submission,
      response,
      details,
      instance,
      participant,
      leaderboard,
      timeline,
    ] = await Promise.all([
      prisma.codeSubmission.findUniqueOrThrow({
        where: { id: receipt.id },
      }),
      prisma.questionResponse.findUniqueOrThrow({
        where: {
          participantId_elementInstanceId: {
            participantId: data.participant.id,
            elementInstanceId: data.instance.id,
          },
        },
      }),
      prisma.questionResponseDetail.count({
        where: { elementInstanceId: data.instance.id },
      }),
      prisma.elementInstance.findUniqueOrThrow({
        where: { id: data.instance.id },
        include: { instanceStatistics: true },
      }),
      prisma.participant.findUniqueOrThrow({
        where: { id: data.participant.id },
      }),
      prisma.leaderboardEntry.findUniqueOrThrow({
        where: {
          type_participantId_courseId: {
            type: 'COURSE',
            participantId: data.participant.id,
            courseId: data.course.id,
          },
        },
      }),
      prisma.timelineEntry.findFirstOrThrow({
        where: {
          participation: { participantId: data.participant.id },
          courseId: data.course.id,
        },
      }),
    ])

    expect(submission.status).toBe(CodeSubmissionStatus.COMPLETED)
    expect(response.trialsCount).toBe(1)
    expect(response.totalScore).toBe(10)
    expect(response.totalXpAwarded).toBe(10)
    expect(response.interval).toBe(2)
    expect(response.nextDueAt).not.toBeNull()
    expect(details).toBe(1)
    expect(instance.results).toMatchObject({
      total: 1,
      tests: {
        public: { passed: 1, total: 1 },
        hidden: { passed: 1, total: 1 },
      },
      submissions: { [receipt.id]: true },
    })
    expect(instance.instanceStatistics).toMatchObject({
      correctCount: 1,
      uniqueParticipantCount: 1,
      averageTimeSpent: 12,
    })
    expect(participant.xp).toBe(10)
    expect(leaderboard.score).toBe(10)
    expect(timeline.collectedPoints).toBe(10)
    expect(timeline.collectedXp).toBe(10)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(data.publish).toHaveBeenCalledTimes(1)
    expect(await getCodeSubmission({ id: receipt.id }, data.ctx)).toEqual({
      id: receipt.id,
      gradingStatus: CodeSubmissionStatus.COMPLETED,
      feedback: {
        pointsPercentage: 1,
        publicTestResults: executorResult.publicTestResults,
      },
    })
    expect(data.publish.mock.calls[0]![1]).not.toHaveProperty(
      'receipt.feedback.hiddenTestResults'
    )
  })

  it('serializes concurrent participant aggregate updates', async () => {
    const data = await fixture()
    const other = await addParticipant(data)
    const first = await submit(data)
    const second = await submitCodeResponse(
      {
        instanceId: data.instance.id,
        courseId: data.course.id,
        code: 'def solve(a, b):\n    return a + b',
        timeSpent: 12,
      },
      other.ctx
    )
    let executions = 0
    let releaseExecutions!: () => void
    const executionsReady = new Promise<void>((resolve) => {
      releaseExecutions = resolve
    })
    const execute = vi.fn().mockImplementation(async () => {
      executions += 1
      if (executions === 2) releaseExecutions()
      await executionsReady
      return executorResult
    })

    await Promise.all([
      processCodeSubmission(
        { submissionId: first.id },
        data.globalCtx,
        execute
      ),
      processCodeSubmission(
        { submissionId: second.id },
        data.globalCtx,
        execute
      ),
    ])

    const instance = await prisma.elementInstance.findUniqueOrThrow({
      where: { id: data.instance.id },
      include: { instanceStatistics: true },
    })
    expect(instance.results).toMatchObject({
      total: 2,
      tests: {
        public: { passed: 2, total: 2 },
        hidden: { passed: 2, total: 2 },
      },
      submissions: {
        [first.id]: true,
        [second.id]: true,
      },
    })
    expect(instance.instanceStatistics).toMatchObject({
      correctCount: 2,
      uniqueParticipantCount: 2,
      averageTimeSpent: 12,
    })
    expect(
      await prisma.questionResponseDetail.count({
        where: { elementInstanceId: data.instance.id },
      })
    ).toBe(2)

    const retry = await submit(data)
    expect(
      await processCodeSubmission(
        { submissionId: retry.id },
        data.globalCtx,
        vi.fn().mockResolvedValue(executorResult)
      )
    ).toBe(true)
    const [firstResponse, secondResponse, retriedInstance] = await Promise.all([
      prisma.questionResponse.findUniqueOrThrow({
        where: {
          participantId_elementInstanceId: {
            participantId: data.participant.id,
            elementInstanceId: data.instance.id,
          },
        },
      }),
      prisma.questionResponse.findUniqueOrThrow({
        where: {
          participantId_elementInstanceId: {
            participantId: other.participant.id,
            elementInstanceId: data.instance.id,
          },
        },
      }),
      prisma.elementInstance.findUniqueOrThrow({
        where: { id: data.instance.id },
      }),
    ])
    expect(firstResponse.aggregatedResponses).toMatchObject({
      total: 2,
      submissions: { [first.id]: true, [retry.id]: true },
    })
    expect(firstResponse.aggregatedResponses).not.toHaveProperty(
      `submissions.${second.id}`
    )
    expect(secondResponse.aggregatedResponses).toMatchObject({
      total: 1,
      submissions: { [second.id]: true },
    })
    expect(secondResponse.aggregatedResponses).not.toHaveProperty(
      `submissions.${first.id}`
    )
    expect(retriedInstance.results).toMatchObject({
      total: 3,
      submissions: {
        [first.id]: true,
        [second.id]: true,
        [retry.id]: true,
      },
    })
  })

  it('retries a failed attempt without leaking partial side effects', async () => {
    const data = await fixture()
    const receipt = await submit(data)

    await expect(
      processCodeSubmission(
        { submissionId: receipt.id },
        data.globalCtx,
        vi.fn().mockRejectedValue(new Error('temporary failure'))
      )
    ).rejects.toThrow('temporary failure')
    expect(
      await prisma.codeSubmission.findUniqueOrThrow({
        where: { id: receipt.id },
      })
    ).toMatchObject({
      status: CodeSubmissionStatus.PENDING,
      claimAttempts: 1,
    })
    expect(await prisma.questionResponseDetail.count()).toBe(0)

    expect(
      await processCodeSubmission(
        { submissionId: receipt.id },
        data.globalCtx,
        vi.fn().mockResolvedValue(executorResult)
      )
    ).toBe(true)
    expect(await prisma.questionResponseDetail.count()).toBe(1)
  })

  it('reclaims an expired worker claim', async () => {
    const data = await fixture()
    const receipt = await submit(data)
    await prisma.codeSubmission.update({
      where: { id: receipt.id },
      data: {
        status: CodeSubmissionStatus.RUNNING,
        claimToken: randomUUID(),
        claimExpiresAt: new Date(Date.now() - 1_000),
        claimAttempts: 1,
      },
    })

    expect(
      await processCodeSubmission(
        { submissionId: receipt.id },
        data.globalCtx,
        vi.fn().mockResolvedValue(executorResult)
      )
    ).toBe(true)
    expect(
      await prisma.codeSubmission.findUniqueOrThrow({
        where: { id: receipt.id },
      })
    ).toMatchObject({
      status: CodeSubmissionStatus.COMPLETED,
      claimAttempts: 2,
    })
  })

  it('does not overlap an unexpired worker claim', async () => {
    const data = await fixture()
    const receipt = await submit(data)
    const claimToken = randomUUID()
    await prisma.codeSubmission.update({
      where: { id: receipt.id },
      data: {
        status: CodeSubmissionStatus.RUNNING,
        claimToken,
        claimExpiresAt: new Date(Date.now() + 60_000),
        claimAttempts: 1,
      },
    })
    const execute = vi.fn().mockResolvedValue(executorResult)

    expect(
      await processCodeSubmission(
        { submissionId: receipt.id },
        data.globalCtx,
        execute
      )
    ).toBe(false)
    expect(execute).not.toHaveBeenCalled()
    expect(
      await prisma.codeSubmission.findUniqueOrThrow({
        where: { id: receipt.id },
      })
    ).toMatchObject({
      status: CodeSubmissionStatus.RUNNING,
      claimToken,
      claimAttempts: 1,
    })
  })

  it('fails after the retry budget and allows a new receipt', async () => {
    const data = await fixture()
    const receipt = await submit(data)
    const fail = vi.fn().mockRejectedValue(new Error('sandbox unavailable'))

    await expect(
      processCodeSubmission({ submissionId: receipt.id }, data.globalCtx, fail)
    ).rejects.toThrow()
    await expect(
      processCodeSubmission({ submissionId: receipt.id }, data.globalCtx, fail)
    ).rejects.toThrow()
    expect(
      await processCodeSubmission(
        { submissionId: receipt.id },
        data.globalCtx,
        fail
      )
    ).toBe(false)
    expect(
      await prisma.codeSubmission.findUniqueOrThrow({
        where: { id: receipt.id },
      })
    ).toMatchObject({
      status: CodeSubmissionStatus.FAILED,
      claimAttempts: 3,
    })
    expect(await prisma.questionResponseDetail.count()).toBe(0)

    const retry = await submit(data)
    expect(retry.id).not.toBe(receipt.id)
  })

  it('recovers pending work and fails expired exhausted work', async () => {
    const pendingData = await fixture()
    const pending = await submit(pendingData)
    const exhaustedData = await fixture()
    const exhausted = await submit(exhaustedData)
    await prisma.codeSubmission.update({
      where: { id: exhausted.id },
      data: {
        status: CodeSubmissionStatus.RUNNING,
        claimToken: randomUUID(),
        claimExpiresAt: new Date(Date.now() - 1_000),
        claimAttempts: 3,
      },
    })

    const recovered = await handleRecoverCodeSubmissions(
      {},
      exhaustedData.globalCtx,
      {} as Parameters<typeof handleRecoverCodeSubmissions>[2]
    )

    expect(recovered).toContain(pending.id)
    expect(recovered).not.toContain(exhausted.id)
    expect(
      await prisma.codeSubmission.findUniqueOrThrow({
        where: { id: exhausted.id },
      })
    ).toMatchObject({
      status: CodeSubmissionStatus.FAILED,
      failureCode: 'GRADING_ATTEMPTS_EXHAUSTED',
    })
    expect(exhaustedData.publish).toHaveBeenCalledWith(
      'codeSubmissionUpdated',
      expect.objectContaining({
        participantId: exhaustedData.participant.id,
        receipt: expect.objectContaining({
          id: exhausted.id,
          gradingStatus: CodeSubmissionStatus.FAILED,
        }),
      })
    )
  })

  it('finalizes a microlearning receipt and closes resubmission', async () => {
    const data = await fixture('microLearning')
    const receipt = await submit(data)

    expect(
      await processCodeSubmission(
        { submissionId: receipt.id },
        data.globalCtx,
        vi.fn().mockResolvedValue(executorResult)
      )
    ).toBe(true)
    await expect(submit(data)).rejects.toMatchObject({
      extensions: { code: 'BAD_USER_INPUT' },
    })
    expect(
      await prisma.questionResponse.findUnique({
        where: {
          participantId_elementInstanceId: {
            participantId: data.participant.id,
            elementInstanceId: data.instance.id,
          },
        },
      })
    ).not.toBeNull()

    const previousEvaluation = await getPreviousStackEvaluation(
      { stackId: data.instance.elementStackId! },
      data.ctx
    )
    expect(previousEvaluation).toMatchObject({
      status: 'correct',
      score: 10,
      evaluations: [
        {
          elementType: ElementType.CODE,
          instanceId: data.instance.id,
          correctness: 1,
          lastResponse: {
            code: 'def solve(a, b):\n    return a + b',
          },
          testResults: [
            {
              id: 'public',
              name: 'Public example',
              passedCount: 1,
              totalCount: 1,
            },
          ],
        },
      ],
    })

    const persistedStack = await prisma.elementStack.findUniqueOrThrow({
      where: { id: data.instance.elementStackId! },
      include: { elements: true },
    })
    expect(computeStackEvaluation([persistedStack])).toMatchObject([
      {
        instances: [
          {
            results: {
              totalAnswers: 1,
              testResults: [
                {
                  id: 'public',
                  name: 'Public example',
                  passedCount: 1,
                  totalCount: 1,
                },
                {
                  id: 'hidden',
                  name: 'Hidden example',
                  passedCount: 1,
                  totalCount: 1,
                },
              ],
            },
          },
        ],
      },
    ])
  })

  it('does not expose another participant submission', async () => {
    const data = await fixture()
    const receipt = await submit(data)
    const otherParticipant = await prisma.participant.create({
      data: {
        username: `other-${randomUUID()}`,
        password: 'test',
      },
    })
    participantIds.push(otherParticipant.id)
    const otherCtx = {
      ...data.ctx,
      user: { ...data.ctx.user, sub: otherParticipant.id },
    }

    expect(await getCodeSubmission({ id: receipt.id }, otherCtx)).toBeNull()
  })
})
