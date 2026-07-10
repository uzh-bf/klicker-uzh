import { prisma } from '@klicker-uzh/prisma'
import {
  AdaptiveAttemptSelectionPolicy,
  AdaptiveLevelMappingRule,
  AdaptivePracticeQuizPreset,
  ElementInstanceType,
  ElementOrderType,
  ElementStackType,
  ElementType,
  Locale,
  PermissionLevel,
  PracticeQuizMode,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import {
  getInitialInstanceResults,
  processElementData,
} from '@klicker-uzh/util'
import { EventEmitter } from 'node:events'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import { getAdaptivePracticeQuizPreview } from '../src/services/adaptivePracticeQuizConfig.js'
import {
  createCompetenceTree,
  linkCompetenceTreeToCourse,
  unlinkCompetenceTreeFromCourse,
  type CompetenceTreeInput,
} from '../src/services/competenceTreeManagement.js'
import { updateCourseSettings } from '../src/services/courses.js'
import { getPracticeQuizList } from '../src/services/participants.js'
import {
  getCoursePublishedPracticeQuizzes,
  getPracticeQuizData,
  manipulatePracticeQuiz,
  publishPracticeQuiz,
} from '../src/services/practiceQuizzes.js'
import { respondToQuestion } from '../src/services/stacks.js'

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
let nextCoursePin = 4100

describe('adaptive practice quiz configuration and publication', () => {
  let ownerCtx: ContextWithUser
  let readerCtx: ContextWithUser
  let scheduledTaskDelete: ReturnType<typeof vi.fn>
  let scheduledTaskCreate: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    await cleanup()
    await prisma.user.createMany({ data: [owner, reader] })

    scheduledTaskDelete = vi.fn().mockResolvedValue(undefined)
    scheduledTaskCreate = vi.fn().mockResolvedValue({
      metadata: { id: 'adaptive-publication-task' },
    })
    ownerCtx = contextFor(owner.id, scheduledTaskCreate, scheduledTaskDelete)
    readerCtx = contextFor(reader.id, scheduledTaskCreate, scheduledTaskDelete)
  })

  afterEach(cleanup)

  afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
  })

  it('keeps omitted mode on the standard path and isolates adaptive gamification', async () => {
    const course = await createCourse(owner.id)
    const standard = await manipulatePracticeQuiz(
      quizInput({ courseId: course.id, name: 'standard-quiz' }),
      ownerCtx
    )
    const fixture = await createTreeFixture(course.id, ownerCtx)
    const adaptive = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      name: 'adaptive-quiz',
    })
    await publishPracticeQuiz({ id: adaptive.id }, ownerCtx)
    await publishPracticeQuiz(
      { id: standard.id, availableFrom: new Date(Date.now() + 60_000) },
      ownerCtx
    )
    expect(scheduledTaskCreate).toHaveBeenCalledTimes(1)

    const participant = await prisma.participant.create({
      data: {
        username: 'adaptive-hidden-participant',
        password: 'not-used-in-service-test',
      },
    })
    await prisma.participation.create({
      data: {
        courseId: course.id,
        participantId: participant.id,
        isActive: true,
      },
    })
    const participantCtx = {
      ...ownerCtx,
      user: {
        ...ownerCtx.user,
        sub: participant.id,
        role: UserRole.PARTICIPANT,
      },
    }

    expect(
      await getCoursePublishedPracticeQuizzes({ courseId: course.id }, ownerCtx)
    ).toEqual([])
    await expect(getPracticeQuizList(participantCtx)).resolves.toEqual([])
    await expect(
      getPracticeQuizData({ id: adaptive.id }, participantCtx)
    ).resolves.toBeNull()
    await expect(
      getPracticeQuizData({ id: adaptive.id }, ownerCtx)
    ).resolves.toMatchObject({ id: adaptive.id, stacks: [] })

    const storedStandard = await prisma.practiceQuiz.findUniqueOrThrow({
      where: { id: standard.id },
    })
    expect(storedStandard).toMatchObject({
      mode: PracticeQuizMode.STANDARD,
      status: PublicationStatus.SCHEDULED,
      pointsMultiplier: 3,
      isGamificationEnabled: false,
    })

    await updateCourseSettings(
      {
        id: course.id,
        language: Locale.en,
        isGamificationEnabled: true,
      },
      ownerCtx
    )

    const [updatedStandard, updatedAdaptive] = await Promise.all([
      prisma.practiceQuiz.findUniqueOrThrow({ where: { id: standard.id } }),
      prisma.practiceQuiz.findUniqueOrThrow({ where: { id: adaptive.id } }),
    ])
    expect(updatedStandard.isGamificationEnabled).toBe(true)
    expect(updatedAdaptive).toMatchObject({
      mode: PracticeQuizMode.ADAPTIVE,
      pointsMultiplier: 0,
      isGamificationEnabled: false,
      isAssessmentEnabled: false,
    })
    await expect(
      prisma.practiceQuiz.update({
        where: { id: adaptive.id },
        data: { isGamificationEnabled: true },
      })
    ).rejects.toThrow()
  })

  it('rejects adaptive instances in the legacy stack response path', async () => {
    const course = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)
    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
    })
    const element = await prisma.element.findUniqueOrThrow({
      where: { id: fixture.elementIds[0] },
    })
    const elementData = processElementData(element)
    const stack = await prisma.elementStack.create({
      data: {
        practiceQuizId: quiz.id,
        type: ElementStackType.PRACTICE_QUIZ,
        order: 0,
        elements: {
          create: {
            elementId: element.id,
            ownerId: owner.id,
            order: 0,
            type: ElementInstanceType.PRACTICE_QUIZ,
            elementType: element.type,
            elementData,
            options: { pointsMultiplier: 0, resetTimeDays: 6 },
            results: getInitialInstanceResults(elementData),
            anonymousResults: getInitialInstanceResults(elementData),
          },
        },
      },
      include: { elements: true },
    })
    const preview = await getAdaptivePracticeQuizPreview(
      { id: quiz.id },
      ownerCtx
    )
    expect(preview?.readiness).toMatchObject({
      ready: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: 'ADAPTIVE_STACKS_FORBIDDEN' }),
      ]),
    })
    const participant = await prisma.participant.create({
      data: {
        username: 'blocked-adaptive-stack-participant',
        password: 'not-used-in-service-test',
      },
    })
    const participation = await prisma.participation.create({
      data: {
        courseId: course.id,
        participantId: participant.id,
        isActive: true,
      },
      include: { participant: true },
    })
    const participantCtx = {
      ...ownerCtx,
      user: {
        ...ownerCtx.user,
        sub: participant.id,
        role: UserRole.PARTICIPANT,
      },
    }

    await expect(
      respondToQuestion(
        {
          id: stack.elements[0]!.id,
          courseId: course.id,
          response: {
            choices: [
              { ix: 0, selected: true },
              { ix: 1, selected: false },
              { ix: 2, selected: false },
              { ix: 3, selected: false },
            ],
          },
          answerTime: 5,
          participation,
        },
        participantCtx
      )
    ).resolves.toBeNull()
    expect(
      await prisma.questionResponse.count({
        where: { participantId: participant.id },
      })
    ).toBe(0)
    expect(
      await prisma.leaderboardEntry.count({
        where: { participantId: participant.id },
      })
    ).toBe(0)
    expect(
      await prisma.participant.findUniqueOrThrow({
        where: { id: participant.id },
      })
    ).toMatchObject({ xp: 0 })
  })

  it('persists preset semantics and normalized quiz-specific root weights', async () => {
    const course = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)
    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      preset: AdaptivePracticeQuizPreset.PLACEMENT,
      nodeOverrides: rootWeightOverrides(fixture, [4, 1]),
    })

    let preview = await getAdaptivePracticeQuizPreview(
      { id: quiz.id },
      ownerCtx
    )
    expect(preview?.config).toMatchObject({
      preset: AdaptivePracticeQuizPreset.PLACEMENT,
      levelMappingRule: AdaptiveLevelMappingRule.MASTERY,
      attemptSelectionPolicy: AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED,
      defaultDiscrimination: 1.2,
      showFinalResult: true,
      showLiveEstimate: false,
    })
    expect(rootWeights(preview!)).toEqual([0.8, 0.2])
    expect(preview?.assignments.every(({ a }) => a === 1.2)).toBe(true)
    expect(preview?.assignments.filter(({ enabled }) => enabled)).toHaveLength(
      2
    )

    const assignmentWithDisabledCoverage =
      await prisma.competenceTreeElementAssignment.findUniqueOrThrow({
        where: { id: fixture.assignmentIds[0] },
      })
    const disabledCoverage =
      await prisma.competenceTreeLeafLevelCoverage.findFirstOrThrow({
        where: {
          treeId: fixture.treeId,
          leafNodeId: assignmentWithDisabledCoverage.leafNodeId,
          levelId: assignmentWithDisabledCoverage.levelId,
        },
      })
    await prisma.competenceTreeLeafLevelCoverage.update({
      where: { id: disabledCoverage.id },
      data: { enabled: false },
    })
    preview = await getAdaptivePracticeQuizPreview({ id: quiz.id }, ownerCtx)
    expect(
      preview?.assignments.find(
        ({ id }) => id === assignmentWithDisabledCoverage.id
      )?.enabled
    ).toBe(false)
    expect(preview?.readiness.ready).toBe(true)
    expect(preview?.readiness.errors).toEqual([])
    await prisma.competenceTreeLeafLevelCoverage.update({
      where: { id: disabledCoverage.id },
      data: { enabled: true },
    })

    await editAdaptiveQuiz({
      id: quiz.id,
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      preset: AdaptivePracticeQuizPreset.DIAGNOSTIC,
      nodeOverrides: rootWeightOverrides(fixture, [1, 1]),
    })
    preview = await getAdaptivePracticeQuizPreview({ id: quiz.id }, ownerCtx)
    expect(preview?.config).toMatchObject({
      preset: AdaptivePracticeQuizPreset.DIAGNOSTIC,
      levelMappingRule: AdaptiveLevelMappingRule.NEAREST,
      attemptSelectionPolicy: AdaptiveAttemptSelectionPolicy.LATEST_COMPLETED,
      showLiveEstimate: false,
    })

    await editAdaptiveQuiz({
      id: quiz.id,
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      preset: AdaptivePracticeQuizPreset.RESEARCH,
      researchSettings: {
        levelMappingRule: AdaptiveLevelMappingRule.MASTERY,
        attemptSelectionPolicy: AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED,
        defaultDiscrimination: 1.6,
        topInformationRatio: 0.6,
        showLiveEstimate: true,
      },
      elementOverrides: fixture.assignmentIds.map((assignmentId) => ({
        assignmentId,
        enabled: true,
        discrimination: 1.8,
      })),
    })
    preview = await getAdaptivePracticeQuizPreview({ id: quiz.id }, ownerCtx)
    expect(preview?.config).toMatchObject({
      preset: AdaptivePracticeQuizPreset.RESEARCH,
      levelMappingRule: AdaptiveLevelMappingRule.MASTERY,
      attemptSelectionPolicy: AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED,
      defaultDiscrimination: 1.6,
      topInformationRatio: 0.6,
      showLiveEstimate: true,
    })
    expect(preview?.assignments.every(({ a }) => a === 1.8)).toBe(true)
    expect(preview?.readiness.ready).toBe(true)
    expect(preview).toMatchObject({
      awardsPoints: false,
      awardsExperiencePoints: false,
    })

    await expect(
      unlinkCompetenceTreeFromCourse(
        { treeId: fixture.treeId, courseId: course.id },
        ownerCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'COMPETENCE_TREE_LINK_IN_USE' },
    })
  })

  it('requires a linked tree and course write access without leaving partial quizzes', async () => {
    const course = await createCourse(owner.id)
    const unlinkedCourse = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)

    await expect(
      createAdaptiveQuiz({
        courseId: unlinkedCourse.id,
        fixture,
        ctx: ownerCtx,
        name: 'unlinked-tree-quiz',
      })
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_COMPETENCE_TREE_UNAVAILABLE' },
    })

    await prisma.derivedPermission.create({
      data: {
        courseId: course.id,
        userId: reader.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await expect(
      createAdaptiveQuiz({
        courseId: course.id,
        fixture,
        ctx: readerCtx,
        name: 'read-only-course-quiz',
      })
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_COMPETENCE_TREE_UNAVAILABLE' },
    })

    expect(
      await prisma.practiceQuiz.count({
        where: {
          name: { in: ['unlinked-tree-quiz', 'read-only-course-quiz'] },
        },
      })
    ).toBe(0)

    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      name: 'preview-permission-quiz',
    })
    await prisma.derivedPermission.create({
      data: {
        practiceQuizId: quiz.id,
        userId: reader.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    const previewResolver = schema.getQueryType()!.getFields()
      .adaptivePracticeQuizPreview!.resolve!
    await expect(
      previewResolver({}, { id: quiz.id }, readerCtx, {
        fieldName: 'adaptivePracticeQuizPreview',
      } as never)
    ).resolves.toBeNull()

    await prisma.derivedPermission.update({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: quiz.id,
          userId: reader.id,
        },
      },
      data: { permissionLevel: PermissionLevel.WRITE },
    })
    await expect(
      previewResolver({}, { id: quiz.id }, readerCtx, {
        fieldName: 'adaptivePracticeQuizPreview',
      } as never)
    ).resolves.toMatchObject({ practiceQuizId: quiz.id })
  })

  it('keeps an unready adaptive quiz in draft and explains the blocking cell', async () => {
    const course = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)
    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      elementOverrides: [
        {
          assignmentId: fixture.assignmentIds[0]!,
          enabled: false,
        },
      ],
    })

    const preview = await getAdaptivePracticeQuizPreview(
      { id: quiz.id },
      ownerCtx
    )
    expect(preview?.readiness.ready).toBe(false)
    expect(preview?.readiness.errors).toContainEqual(
      expect.objectContaining({ code: 'ADAPTIVE_COVERAGE_CELL_EMPTY' })
    )

    await expect(
      publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_QUIZ_NOT_READY' },
    })
    expect(
      await prisma.practiceQuiz.findUniqueOrThrow({ where: { id: quiz.id } })
    ).toMatchObject({ status: PublicationStatus.DRAFT })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.count({
        where: { config: { practiceQuizId: quiz.id } },
      })
    ).toBe(0)
  })

  it('accepts an all-false KPRIM item as a controlled adaptive answer', async () => {
    const course = await createCourse(owner.id)
    const fixture = await createAllFalseKprimTreeFixture(course.id, ownerCtx)
    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
    })

    const preview = await getAdaptivePracticeQuizPreview(
      { id: quiz.id },
      ownerCtx
    )
    expect(preview?.readiness.ready).toBe(true)
    expect(preview?.assignments).toEqual([
      expect.objectContaining({
        elementType: ElementType.KPRIM,
        controlledAnswerReady: true,
      }),
    ])
    await publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    expect(
      await prisma.practiceQuizAdaptivePoolItem.count({
        where: { config: { practiceQuizId: quiz.id } },
      })
    ).toBe(1)
  })

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
      extensions: { code: 'ADAPTIVE_QUIZ_NOT_READY' },
    })
    await prisma.element.update({
      where: { id: fixture.elementIds[0] },
      data: { isDeleted: false },
    })

    await publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    const originalPool = await prisma.practiceQuizAdaptivePoolItem.findMany({
      where: { config: { practiceQuizId: quiz.id } },
      orderBy: { sourceAssignmentId: 'asc' },
    })
    expect(originalPool.map(({ elementName }) => elementName)).toEqual([
      'Reading SC',
      'Writing SC',
    ])

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
      where: { config: { practiceQuizId: quiz.id } },
      orderBy: { sourceAssignmentId: 'asc' },
    })
    expect(unchangedPool).toEqual(originalPool)
    await expect(
      publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_QUIZ_NOT_READY' },
    })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.findMany({
        where: { config: { practiceQuizId: quiz.id } },
        orderBy: { sourceAssignmentId: 'asc' },
      })
    ).toEqual(originalPool)

    await prisma.element.update({
      where: { id: fixture.elementIds[0] },
      data: { isDeleted: false },
    })

    await publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    const replacedPool = await prisma.practiceQuizAdaptivePoolItem.findMany({
      where: { config: { practiceQuizId: quiz.id } },
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

    await expect(
      prisma.adaptivePracticeQuizAttempt.create({
        data: {
          configId: config.id,
          practiceQuizId: foreignQuiz.id,
          courseId: course.id,
          participantId: participant.id,
          participationId: participation.id,
        },
      })
    ).rejects.toMatchObject({ code: 'P2003' })
    await expect(
      prisma.adaptivePracticeQuizAttempt.create({
        data: {
          configId: config.id,
          practiceQuizId: quiz.id,
          courseId: course.id,
          participantId: participant.id,
          participationId: participation.id,
          nextPoolItemId: foreignConfig.publishedPool[0]!.id,
        },
      })
    ).rejects.toMatchObject({ code: 'P2003' })

    const otherParticipant = await prisma.participant.create({
      data: {
        username: 'other-adaptive-participant',
        password: 'not-used-in-service-test',
      },
    })
    await expect(
      prisma.adaptivePracticeQuizAttempt.create({
        data: {
          configId: config.id,
          practiceQuizId: quiz.id,
          courseId: course.id,
          participantId: otherParticipant.id,
          participationId: participation.id,
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
          configId: config.id,
          practiceQuizId: quiz.id,
          courseId: otherCourse.id,
          participantId: participant.id,
          participationId: otherParticipation.id,
        },
      })
    ).rejects.toMatchObject({ code: 'P2003' })

    const attempt = await prisma.adaptivePracticeQuizAttempt.create({
      data: {
        configId: config.id,
        practiceQuizId: quiz.id,
        courseId: course.id,
        participantId: participant.id,
        participationId: participation.id,
      },
    })
    await expect(
      prisma.adaptivePracticeQuizResponse.create({
        data: {
          attemptId: attempt.id,
          configId: config.id,
          assignmentId: fixture.assignmentIds[0]!,
          poolItemId: foreignConfig.publishedPool[0]!.id,
          elementId: fixture.elementIds[0]!,
          order: 0,
          response: {},
          correct: false,
          thetaBefore: 0,
          thetaAfter: 0,
          standardErrorAfter: 1,
        },
      })
    ).rejects.toMatchObject({ code: 'P2003' })
    await expect(
      prisma.adaptivePracticeQuizResponse.create({
        data: {
          attemptId: attempt.id,
          configId: config.id,
          assignmentId: replacedPool[0]!.sourceAssignmentId,
          elementId: replacedPool[0]!.elementId,
          order: 0,
          response: {},
          correct: false,
          thetaBefore: 0,
          thetaAfter: 0,
          standardErrorAfter: 1,
        },
      })
    ).rejects.toThrow()
    await expect(
      prisma.adaptivePracticeQuizResponse.create({
        data: {
          attemptId: attempt.id,
          configId: config.id,
          assignmentId: fixture.assignmentIds[1]!,
          poolItemId: replacedPool[0]!.id,
          elementId: replacedPool[0]!.elementId,
          order: 0,
          response: {},
          correct: false,
          thetaBefore: 0,
          thetaAfter: 0,
          standardErrorAfter: 1,
        },
      })
    ).rejects.toMatchObject({ code: 'P2003' })
    await expect(
      prisma.adaptivePracticeQuizResponse.create({
        data: {
          attemptId: attempt.id,
          configId: config.id,
          assignmentId: replacedPool[0]!.sourceAssignmentId,
          poolItemId: replacedPool[0]!.id,
          elementId: replacedPool[0]!.elementId,
          order: 0,
          response: {},
          correct: false,
          thetaBefore: 0,
          thetaAfter: 0,
          standardErrorAfter: 1,
        },
      })
    ).resolves.toMatchObject({ configId: config.id })

    await expect(
      publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).rejects.toMatchObject({ extensions: { code: 'ADAPTIVE_POOL_LOCKED' } })
  })
})

type TreeFixture = {
  treeId: string
  rootIds: number[]
  assignmentIds: number[]
  elementIds: number[]
}

function contextFor(
  userId: string,
  scheduledTaskCreate: ReturnType<typeof vi.fn>,
  scheduledTaskDelete: ReturnType<typeof vi.fn>
): ContextWithUser {
  return {
    prisma,
    emitter: new EventEmitter(),
    user: {
      sub: userId,
      role: UserRole.USER,
      scope: UserLoginScope.FULL_ACCESS,
      catalystInstitutional: true,
      catalystIndividual: false,
    },
    tasks: {
      publishScheduledPracticeQuiz: { schedule: scheduledTaskCreate },
    },
    hatchet: { scheduled: { delete: scheduledTaskDelete } },
  } as unknown as ContextWithUser
}

async function createCourse(ownerId: string) {
  const startDate = new Date(Date.now() - 86_400_000)
  const endDate = new Date(Date.now() + 7 * 86_400_000)
  return await prisma.course.create({
    data: {
      name: `course-${crypto.randomUUID()}`,
      displayName: 'Adaptive course',
      ownerId,
      pinCode: nextCoursePin++,
      startDate,
      endDate,
      groupDeadlineDate: endDate,
      isGamificationEnabled: false,
      isAssessmentEnabled: false,
    },
  })
}

async function createTreeFixture(
  courseId: string,
  ctx: ContextWithUser,
  suffix = 'main'
): Promise<TreeFixture> {
  const elements = await Promise.all([
    createSingleChoiceElement(
      `Reading SC${suffix === 'main' ? '' : ` ${suffix}`}`,
      ctx
    ),
    createSingleChoiceElement(
      `Writing SC${suffix === 'main' ? '' : ` ${suffix}`}`,
      ctx
    ),
  ])
  const input: CompetenceTreeInput = {
    name: `adaptive-tree-${suffix}-${crypto.randomUUID()}`,
    displayName: `Adaptive tree ${suffix}`,
    maxDepth: 5,
    thetaMin: -3,
    thetaMax: 3,
    defaultDiscrimination: 1.7,
    levelMappingRule: AdaptiveLevelMappingRule.NEAREST,
    levels: [
      { key: 'basic', label: 'Basic', order: 0 },
      { key: 'advanced', label: 'Advanced', order: 1 },
    ],
    nodes: [
      {
        key: 'reading',
        kind: 'COMPETENCE',
        name: 'Reading',
        order: 0,
        weight: 2,
      },
      {
        key: 'scanning',
        parentKey: 'reading',
        kind: 'SUBCOMPETENCE',
        name: 'Scanning',
        order: 0,
      },
      {
        key: 'writing',
        kind: 'COMPETENCE',
        name: 'Writing',
        order: 1,
        weight: 1,
      },
      {
        key: 'structure',
        parentKey: 'writing',
        kind: 'SUBCOMPETENCE',
        name: 'Structure',
        order: 0,
      },
    ],
    coverages: [
      {
        leafKey: 'scanning',
        levelKey: 'basic',
        targetItemCount: 1,
        enabled: true,
      },
      {
        leafKey: 'structure',
        levelKey: 'basic',
        targetItemCount: 1,
        enabled: true,
      },
    ],
    assignments: [
      {
        elementId: elements[0].id,
        leafKey: 'scanning',
        levelKey: 'basic',
        enabled: true,
        discrimination: 2,
        enablePercentInput: false,
      },
      {
        elementId: elements[1].id,
        leafKey: 'structure',
        levelKey: 'basic',
        enabled: true,
        discrimination: 2,
        enablePercentInput: false,
      },
    ],
  }
  const tree = await createCompetenceTree({ input }, ctx)
  await linkCompetenceTreeToCourse({ treeId: tree.id, courseId }, ctx)

  return {
    treeId: tree.id,
    rootIds: tree.nodes
      .filter(({ parentId }) => parentId === null)
      .map(({ id }) => id),
    assignmentIds: tree.elementAssignments.map(({ id }) => id),
    elementIds: elements.map(({ id }) => id),
  }
}

async function createAllFalseKprimTreeFixture(
  courseId: string,
  ctx: ContextWithUser
): Promise<TreeFixture> {
  const element = await prisma.element.create({
    data: {
      type: ElementType.KPRIM,
      name: 'All-false KPRIM',
      content: 'Select every statement that is correct.',
      options: {
        choices: Array.from({ length: 4 }, (_, ix) => ({
          ix,
          value: `Statement ${ix + 1}`,
          correct: false,
        })),
      },
      ownerId: ctx.user.sub,
    },
  })
  const tree = await createCompetenceTree(
    {
      input: {
        name: `kprim-tree-${crypto.randomUUID()}`,
        displayName: 'KPRIM tree',
        maxDepth: 5,
        thetaMin: -3,
        thetaMax: 3,
        defaultDiscrimination: 1.2,
        levelMappingRule: AdaptiveLevelMappingRule.NEAREST,
        levels: [
          { key: 'basic', label: 'Basic', order: 0 },
          { key: 'advanced', label: 'Advanced', order: 1 },
        ],
        nodes: [
          {
            key: 'reasoning',
            kind: 'COMPETENCE',
            name: 'Reasoning',
            order: 0,
            weight: 1,
          },
          {
            key: 'classification',
            parentKey: 'reasoning',
            kind: 'SUBCOMPETENCE',
            name: 'Classification',
            order: 0,
          },
        ],
        coverages: [
          {
            leafKey: 'classification',
            levelKey: 'basic',
            targetItemCount: 1,
            enabled: true,
          },
        ],
        assignments: [
          {
            elementId: element.id,
            leafKey: 'classification',
            levelKey: 'basic',
            enabled: true,
            discrimination: 1.2,
            enablePercentInput: false,
          },
        ],
      },
    },
    ctx
  )
  await linkCompetenceTreeToCourse({ treeId: tree.id, courseId }, ctx)
  return {
    treeId: tree.id,
    rootIds: tree.nodes
      .filter(({ parentId }) => parentId === null)
      .map(({ id }) => id),
    assignmentIds: tree.elementAssignments.map(({ id }) => id),
    elementIds: [element.id],
  }
}

async function createSingleChoiceElement(name: string, ctx: ContextWithUser) {
  return await prisma.element.create({
    data: {
      type: ElementType.SC,
      name,
      content: 'Adaptive question',
      options: {
        choices: [
          { ix: 0, value: 'A', correct: true },
          { ix: 1, value: 'B', correct: false },
          { ix: 2, value: 'C', correct: false },
          { ix: 3, value: 'D', correct: false },
        ],
      },
      ownerId: ctx.user.sub,
    },
  })
}

function quizInput({ courseId, name }: { courseId: string; name: string }) {
  return {
    name,
    displayName: name,
    description: null,
    stacks: [],
    courseId,
    multiplier: 3,
    order: ElementOrderType.SEQUENTIAL,
    resetTimeDays: 6,
  }
}

async function createAdaptiveQuiz({
  courseId,
  fixture,
  ctx,
  name = 'adaptive-quiz',
  preset = AdaptivePracticeQuizPreset.DIAGNOSTIC,
  nodeOverrides,
  elementOverrides,
  researchSettings,
}: {
  courseId: string
  fixture: TreeFixture
  ctx: ContextWithUser
  name?: string
  preset?: AdaptivePracticeQuizPreset
  nodeOverrides?: Array<{
    nodeId: number
    enabled: boolean
    weight?: number
  }>
  elementOverrides?: Array<{
    assignmentId: number
    enabled: boolean
    discrimination?: number
  }>
  researchSettings?: {
    levelMappingRule: AdaptiveLevelMappingRule
    attemptSelectionPolicy: AdaptiveAttemptSelectionPolicy
    defaultDiscrimination: number
    topInformationRatio: number
    showLiveEstimate: boolean
  }
}) {
  return await manipulatePracticeQuiz(
    {
      ...quizInput({ courseId, name }),
      mode: PracticeQuizMode.ADAPTIVE,
      adaptiveConfig: {
        competenceTreeId: fixture.treeId,
        preset,
        totalQuestionCap: 12,
        perLeafQuestionCap: 6,
        minQuestionsPerLeaf: 1,
        classificationZ: 1.28,
        standardErrorThreshold: null,
        showTimer: true,
        nodeOverrides,
        elementOverrides,
        researchSettings,
      },
    },
    ctx
  )
}

async function editAdaptiveQuiz({
  id,
  ...input
}: Parameters<typeof createAdaptiveQuiz>[0] & { id: string }) {
  return await manipulatePracticeQuiz(
    {
      ...quizInput({
        courseId: input.courseId,
        name: 'adaptive-quiz-edited',
      }),
      id,
      mode: PracticeQuizMode.ADAPTIVE,
      adaptiveConfig: {
        competenceTreeId: input.fixture.treeId,
        preset: input.preset ?? AdaptivePracticeQuizPreset.DIAGNOSTIC,
        totalQuestionCap: 12,
        perLeafQuestionCap: 6,
        minQuestionsPerLeaf: 1,
        classificationZ: 1.28,
        standardErrorThreshold: null,
        showTimer: true,
        nodeOverrides: input.nodeOverrides,
        elementOverrides: input.elementOverrides,
        researchSettings: input.researchSettings,
      },
    },
    input.ctx
  )
}

function rootWeightOverrides(fixture: TreeFixture, weights: number[]) {
  return fixture.rootIds.map((nodeId, index) => ({
    nodeId,
    enabled: true,
    weight: weights[index]!,
  }))
}

function rootWeights(
  preview: NonNullable<
    Awaited<ReturnType<typeof getAdaptivePracticeQuizPreview>>
  >
) {
  return preview.nodes
    .filter(({ parentId }) => parentId === null)
    .map(({ weight }) => weight)
}

async function cleanup() {
  await prisma.practiceQuiz.deleteMany()
  await prisma.competenceTree.deleteMany()
  await prisma.element.deleteMany()
  await prisma.course.deleteMany()
  await prisma.participant.deleteMany()
  await prisma.user.deleteMany()
}
