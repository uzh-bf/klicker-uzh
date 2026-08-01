import { prisma } from '@klicker-uzh/prisma'
import {
  AdaptivePracticeQuizPreset,
  PracticeQuizMode,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../src/lib/context.js'
import { getAdaptivePracticeQuizPreview } from '../src/services/adaptivePracticeQuizConfig.js'
import {
  manipulatePracticeQuiz,
  publishPracticeQuiz,
  unpublishPracticeQuiz,
} from '../src/services/practiceQuizzes.js'

const owner = {
  id: '10000000-0000-4000-8000-000000000001',
  email: 'adaptive-owner@example.com',
  shortname: 'adaptive-owner',
}
const reader = {
  id: '10000000-0000-4000-8000-000000000002',
  email: 'adaptive-reader@example.com',
  shortname: 'adaptive-reader',
}
const outsider = {
  id: '10000000-0000-4000-8000-000000000003',
  email: 'adaptive-outsider@example.com',
  shortname: 'adaptive-outsider',
}

import {
  cleanup,
  contextFor,
  createAdaptiveQuiz,
  createCourse,
  createTreeFixture,
  quizInput,
} from './adaptivePracticeQuizConfigTestSupport.js'

export function registerAdaptivePracticeQuizConfigPublicationTests() {
  let ownerCtx: ContextWithUser
  let scheduledTaskDelete: ReturnType<typeof vi.fn>
  let scheduledTaskCreate: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    await cleanup()
    await prisma.user.createMany({ data: [owner, reader, outsider] })

    scheduledTaskDelete = vi.fn().mockResolvedValue(undefined)
    scheduledTaskCreate = vi.fn().mockResolvedValue({
      metadata: { id: 'adaptive-publication-task' },
    })
    ownerCtx = contextFor(owner.id, scheduledTaskCreate, scheduledTaskDelete)
    void contextFor(reader.id, scheduledTaskCreate, scheduledTaskDelete)
    void contextFor(outsider.id, scheduledTaskCreate, scheduledTaskDelete)
  })

  afterEach(cleanup)

  it('materializes immutable pools, rejects scheduling, and locks republish after attempts', async () => {
    const course = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)
    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      preset: AdaptivePracticeQuizPreset.DIAGNOSTIC,
    })

    await expect(
      publishPracticeQuiz(
        { id: quiz.id, availableFrom: new Date(Date.now() + 60_000) },
        ownerCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_SCHEDULING_UNAVAILABLE' },
    })
    expect(scheduledTaskCreate).not.toHaveBeenCalled()
    expect(
      await prisma.practiceQuiz.findUniqueOrThrow({ where: { id: quiz.id } })
    ).toMatchObject({ status: PublicationStatus.DRAFT })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.count({
        where: { config: { practiceQuizId: quiz.id } },
      })
    ).toBe(0)

    await prisma.element.update({
      where: { id: fixture.elementIds[0] },
      data: { isDeleted: true },
    })
    expect(
      (await getAdaptivePracticeQuizPreview({ id: quiz.id }, ownerCtx))
        ?.readiness.errors
    ).toContainEqual(
      expect.objectContaining({ code: 'ADAPTIVE_ITEM_UNAVAILABLE' })
    )
    await expect(
      publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_SOURCE_ELEMENT_UNAVAILABLE' },
    })
    await prisma.element.update({
      where: { id: fixture.elementIds[0] },
      data: { isDeleted: false },
    })

    await publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    await expect(
      unpublishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).resolves.toMatchObject({ status: PublicationStatus.DRAFT })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.count({
        where: { config: { practiceQuizId: quiz.id } },
      })
    ).toBe(20)
    expect(
      await prisma.practiceQuizAdaptivePublication.count({
        where: {
          config: { practiceQuizId: quiz.id },
          sealedAt: { not: null },
          supersededAt: null,
          unpublishedAt: null,
        },
      })
    ).toBe(0)
    expect(
      await prisma.practiceQuizAdaptiveConfig.findUniqueOrThrow({
        where: { practiceQuizId: quiz.id },
      })
    ).toMatchObject({ poolPublishedAt: null })
    expect(scheduledTaskDelete).not.toHaveBeenCalled()

    await publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    const originalPool = await prisma.practiceQuizAdaptivePoolItem.findMany({
      where: {
        config: { practiceQuizId: quiz.id },
        publication: { supersededAt: null, unpublishedAt: null },
      },
      orderBy: { sourceAssignmentId: 'asc' },
    })
    expect(originalPool).toHaveLength(20)
    expect(originalPool.map(({ elementName }) => elementName)).toEqual(
      expect.arrayContaining([
        'Reading basic numerical 1',
        'Reading advanced numerical 1',
        'Writing basic numerical 1',
        'Writing advanced numerical 1',
      ])
    )

    await prisma.element.update({
      where: { id: fixture.elementIds[0] },
      data: {
        name: 'Changed after publication',
        version: { increment: 1 },
        isDeleted: true,
      },
    })
    expect(
      await prisma.practiceQuiz.findUniqueOrThrow({ where: { id: quiz.id } })
    ).toMatchObject({ status: PublicationStatus.PUBLISHED })
    const unchangedPool = await prisma.practiceQuizAdaptivePoolItem.findMany({
      where: {
        config: { practiceQuizId: quiz.id },
        publication: { supersededAt: null, unpublishedAt: null },
      },
      orderBy: { sourceAssignmentId: 'asc' },
    })
    expect(unchangedPool).toEqual(originalPool)
    await expect(
      publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_SOURCE_ELEMENT_UNAVAILABLE' },
    })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.findMany({
        where: {
          config: { practiceQuizId: quiz.id },
          publication: { supersededAt: null, unpublishedAt: null },
        },
        orderBy: { sourceAssignmentId: 'asc' },
      })
    ).toEqual(originalPool)

    await prisma.element.update({
      where: { id: fixture.elementIds[0] },
      data: { isDeleted: false },
    })

    await publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    const replacedPool = await prisma.practiceQuizAdaptivePoolItem.findMany({
      where: {
        config: { practiceQuizId: quiz.id },
        publication: { supersededAt: null, unpublishedAt: null },
      },
      orderBy: { sourceAssignmentId: 'asc' },
    })
    expect(replacedPool[0]).toMatchObject({
      elementName: 'Changed after publication',
      elementVersion: 2,
    })

    const foreignTree = await createTreeFixture(course.id, ownerCtx, 'foreign')
    const config = await prisma.practiceQuizAdaptiveConfig.findUniqueOrThrow({
      where: { practiceQuizId: quiz.id },
      include: { nodeOverrides: { orderBy: { id: 'asc' } } },
    })
    await expect(
      prisma.practiceQuizAdaptiveNodeOverride.update({
        where: { id: config.nodeOverrides[0]!.id },
        data: { nodeId: foreignTree.rootIds[0] },
      })
    ).rejects.toMatchObject({ code: 'P2003' })

    const participant = await prisma.participant.create({
      data: {
        username: 'adaptive-participant',
        password: 'not-used-in-service-test',
      },
    })
    const participation = await prisma.participation.create({
      data: {
        courseId: course.id,
        participantId: participant.id,
        isActive: true,
      },
    })
    const foreignQuiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture: foreignTree,
      ctx: ownerCtx,
      name: 'foreign-adaptive-quiz',
    })
    await publishPracticeQuiz({ id: foreignQuiz.id }, ownerCtx)
    const foreignConfig =
      await prisma.practiceQuizAdaptiveConfig.findUniqueOrThrow({
        where: { practiceQuizId: foreignQuiz.id },
        include: { publishedPool: { take: 1 } },
      })
    const publication =
      await prisma.practiceQuizAdaptivePublication.findUniqueOrThrow({
        where: { id: replacedPool[0]!.publicationId },
      })
    const attemptPublicationIdentity = {
      publicationId: publication.id,
      scaleVersionId: publication.scaleVersionId,
      measurementVersion: publication.measurementVersion,
      estimatorImplementationVersion:
        publication.estimatorImplementationVersion,
      classificationPolicyVersion: publication.classificationPolicyVersion,
      calibrationPolicyVersion: publication.calibrationPolicyVersion,
    }

    await expect(
      prisma.adaptivePracticeQuizAttempt.create({
        data: {
          ...attemptPublicationIdentity,
          configId: config.id,
          competenceTreeId: config.competenceTreeId,
          practiceQuizId: foreignQuiz.id,
          courseId: course.id,
          participantId: participant.id,
          participationId: participation.id,
          nextPoolItemId: replacedPool[0]!.id,
        },
      })
    ).rejects.toMatchObject({ code: 'P2003' })
    await expect(
      prisma.adaptivePracticeQuizAttempt.create({
        data: {
          ...attemptPublicationIdentity,
          configId: config.id,
          competenceTreeId: config.competenceTreeId,
          practiceQuizId: quiz.id,
          courseId: course.id,
          participantId: participant.id,
          participationId: participation.id,
          nextPoolItemId: foreignConfig.publishedPool[0]!.id,
        },
      })
    ).rejects.toThrow(
      'Adaptive attempt next item must belong to its publication'
    )

    const otherParticipant = await prisma.participant.create({
      data: {
        username: 'other-adaptive-participant',
        password: 'not-used-in-service-test',
      },
    })
    await expect(
      prisma.adaptivePracticeQuizAttempt.create({
        data: {
          ...attemptPublicationIdentity,
          configId: config.id,
          competenceTreeId: config.competenceTreeId,
          practiceQuizId: quiz.id,
          courseId: course.id,
          participantId: otherParticipant.id,
          participationId: participation.id,
          nextPoolItemId: replacedPool[0]!.id,
        },
      })
    ).rejects.toMatchObject({ code: 'P2003' })

    const otherCourse = await createCourse(owner.id)
    const otherParticipation = await prisma.participation.create({
      data: {
        courseId: otherCourse.id,
        participantId: participant.id,
        isActive: true,
      },
    })
    await expect(
      prisma.adaptivePracticeQuizAttempt.create({
        data: {
          ...attemptPublicationIdentity,
          configId: config.id,
          competenceTreeId: config.competenceTreeId,
          practiceQuizId: quiz.id,
          courseId: otherCourse.id,
          participantId: participant.id,
          participationId: otherParticipation.id,
          nextPoolItemId: replacedPool[0]!.id,
        },
      })
    ).rejects.toMatchObject({ code: 'P2003' })

    const attempt = await prisma.adaptivePracticeQuizAttempt.create({
      data: {
        ...attemptPublicationIdentity,
        configId: config.id,
        competenceTreeId: config.competenceTreeId,
        practiceQuizId: quiz.id,
        courseId: course.id,
        participantId: participant.id,
        participationId: participation.id,
        nextPoolItemId: replacedPool[0]!.id,
      },
    })
    await expect(
      prisma.adaptivePracticeQuizResponse.create({
        data: {
          attemptId: attempt.id,
          configId: config.id,
          publicationId: attempt.publicationId,
          assignmentId: fixture.assignmentIds[0]!,
          poolItemId: foreignConfig.publishedPool[0]!.id,
          elementId: fixture.elementIds[0]!,
          order: 1,
          response: {},
          normalizedResponse: {},
          score: 0,
          correct: false,
          overallThetaBefore: 0,
          overallThetaAfter: 0,
          overallStandardErrorAfter: 1,
          elementSnapshot: foreignConfig.publishedPool[0]!.elementData,
        },
      })
    ).rejects.toThrow(
      'Adaptive response design identity must match the served pool item'
    )
    await expect(
      prisma.adaptivePracticeQuizResponse.create({
        data: {
          attemptId: attempt.id,
          configId: config.id,
          publicationId: attempt.publicationId,
          assignmentId: replacedPool[0]!.sourceAssignmentId,
          elementId: replacedPool[0]!.elementId,
          order: 1,
          response: {},
          normalizedResponse: {},
          score: 0,
          correct: false,
          overallThetaBefore: 0,
          overallThetaAfter: 0,
          overallStandardErrorAfter: 1,
          elementSnapshot: replacedPool[0]!.elementData,
        },
      })
    ).rejects.toThrow()
    await expect(
      prisma.adaptivePracticeQuizResponse.create({
        data: {
          attemptId: attempt.id,
          configId: config.id,
          publicationId: attempt.publicationId,
          assignmentId: fixture.assignmentIds[1]!,
          poolItemId: replacedPool[0]!.id,
          elementId: replacedPool[0]!.elementId,
          order: 1,
          response: {},
          normalizedResponse: {},
          score: 0,
          correct: false,
          overallThetaBefore: 0,
          overallThetaAfter: 0,
          overallStandardErrorAfter: 1,
          elementSnapshot: replacedPool[0]!.elementData,
        },
      })
    ).rejects.toMatchObject({ code: 'P2003' })
    await expect(
      prisma.adaptivePracticeQuizResponse.create({
        data: {
          attemptId: attempt.id,
          configId: config.id,
          publicationId: attempt.publicationId,
          assignmentId: replacedPool[0]!.sourceAssignmentId,
          poolItemId: replacedPool[0]!.id,
          elementId: replacedPool[0]!.elementId,
          order: 1,
          response: {},
          normalizedResponse: {},
          score: 0,
          correct: false,
          overallThetaBefore: 0,
          overallThetaAfter: 0,
          overallStandardErrorAfter: 1,
          elementSnapshot: replacedPool[0]!.elementData,
        },
      })
    ).resolves.toMatchObject({ configId: config.id })

    await expect(
      publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).resolves.toMatchObject({ status: PublicationStatus.PUBLISHED })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.findMany({
        where: {
          config: { practiceQuizId: quiz.id },
          publication: { supersededAt: null, unpublishedAt: null },
        },
        orderBy: { sourceAssignmentId: 'asc' },
      })
    ).toEqual(replacedPool)

    await expect(
      unpublishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).resolves.toMatchObject({ status: PublicationStatus.DRAFT })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.findMany({
        where: {
          config: { practiceQuizId: quiz.id },
          publication: { supersededAt: null, unpublishedAt: null },
        },
        orderBy: { sourceAssignmentId: 'asc' },
      })
    ).toEqual(replacedPool)
    await expect(
      publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).resolves.toMatchObject({ status: PublicationStatus.PUBLISHED })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.findMany({
        where: {
          config: { practiceQuizId: quiz.id },
          publication: { supersededAt: null, unpublishedAt: null },
        },
        orderBy: { sourceAssignmentId: 'asc' },
      })
    ).toEqual(replacedPool)

    await unpublishPracticeQuiz({ id: quiz.id }, ownerCtx)
    await expect(
      manipulatePracticeQuiz(
        {
          ...quizInput({ courseId: course.id, name: quiz.name }),
          id: quiz.id,
          mode: PracticeQuizMode.STANDARD,
        },
        ownerCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_CONFIG_LOCKED' },
    })
  })
}
