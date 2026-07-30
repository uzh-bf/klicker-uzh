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
  Prisma,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import {
  getInitialInstanceResults,
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { EventEmitter } from 'node:events'
import { schema } from '../src/index.js'
import type { Context, ContextWithUser } from '../src/lib/context.js'
import {
  getAdaptivePracticeQuizPreview,
  getAdaptivePracticeQuizSetupPreview,
  getPracticeQuizPublicationPreview,
} from '../src/services/adaptivePracticeQuizConfig.js'
import { lockAdaptivePracticeQuizPublicationSources } from '../src/services/adaptivePracticeQuizPublicationAuthorization.js'
import {
  archiveCompetenceTree,
  createCompetenceTree,
  deleteCompetenceTree,
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
  unpublishPracticeQuiz,
} from '../src/services/practiceQuizzes.js'
import {
  removeUserFromGroup,
  revokeObjectAccess,
} from '../src/services/sharing.js'
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
const outsider = {
  id: '10000000-0000-4000-8000-000000000003',
  email: 'adaptive-outsider@example.com',
  shortname: 'adaptive-outsider',
}
let nextCoursePin = 4100

const adaptiveConfigFieldBehavior = {
  id: { kind: 'audit', consumer: 'attempt and pool config identity' },
  practiceQuizId: {
    kind: 'runtime',
    consumer: 'one-to-one practice quiz configuration lookup',
  },
  competenceTreeId: {
    kind: 'runtime',
    consumer: 'hierarchy and immutable pool identity',
  },
  preset: { kind: 'audit', consumer: 'preset policy resolution' },
  attemptSelectionPolicy: {
    kind: 'runtime',
    consumer: 'participant retake and cohort-attempt selection',
  },
  totalQuestionCap: {
    kind: 'runtime',
    consumer: 'global adaptive stopping cap',
  },
  perLeafQuestionCap: {
    kind: 'runtime',
    consumer: 'leaf candidate exclusion cap',
  },
  minQuestionsPerLeaf: {
    kind: 'readiness',
    consumer: 'breadth evidence requirement',
  },
  classificationZ: {
    kind: 'runtime',
    consumer: 'classification interval width',
  },
  topInformationRatio: {
    kind: 'runtime',
    consumer: 'randomesque information band',
  },
  defaultDiscrimination: {
    kind: 'runtime',
    consumer: 'immutable item-parameter publication',
  },
  levelMappingRule: {
    kind: 'runtime',
    consumer: 'level bands and result mapping',
  },
  showTimer: { kind: 'display', consumer: 'participant timer visibility' },
  poolPublishedAt: {
    kind: 'audit',
    consumer: 'published-pool availability marker',
  },
  createdAt: { kind: 'audit', consumer: 'configuration creation metadata' },
  updatedAt: { kind: 'audit', consumer: 'configuration change metadata' },
} as const satisfies Record<
  Prisma.PracticeQuizAdaptiveConfigScalarFieldEnum,
  {
    kind: 'runtime' | 'readiness' | 'display' | 'audit'
    consumer: string
  }
>

describe('adaptive practice quiz configuration and publication', () => {
  let ownerCtx: ContextWithUser
  let readerCtx: ContextWithUser
  let outsiderCtx: ContextWithUser
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
    readerCtx = contextFor(reader.id, scheduledTaskCreate, scheduledTaskDelete)
    outsiderCtx = contextFor(
      outsider.id,
      scheduledTaskCreate,
      scheduledTaskDelete
    )
  })

  afterEach(cleanup)

  afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
  })

  it('ties every remaining persisted and public setting to one behavior', () => {
    expect(Object.keys(adaptiveConfigFieldBehavior).sort()).toEqual(
      Object.values(Prisma.PracticeQuizAdaptiveConfigScalarFieldEnum).sort()
    )
    expect(
      Object.values(adaptiveConfigFieldBehavior).every(
        ({ consumer }) => consumer.trim().length > 0
      )
    ).toBe(true)

    expect(getSchemaFieldNames('AdaptivePracticeQuizConfig')).toEqual(
      [
        'attemptSelectionPolicy',
        'classificationZ',
        'competenceTreeId',
        'defaultDiscrimination',
        'levelMappingRule',
        'minQuestionsPerLeaf',
        'perLeafQuestionCap',
        'preset',
        'showTimer',
        'topInformationRatio',
        'totalQuestionCap',
      ].sort()
    )

    expect(getSchemaFieldNames('AdaptivePracticeQuizConfigInput')).toEqual(
      [
        'competenceTreeId',
        'elementOverrides',
        'nodeOverrides',
        'preset',
        'researchSettings',
        'showTimer',
        'classificationZ',
        'minQuestionsPerLeaf',
        'perLeafQuestionCap',
        'totalQuestionCap',
      ].sort()
    )

    expect(
      getSchemaFieldNames('AdaptivePracticeQuizResearchSettingsInput')
    ).toEqual(
      [
        'attemptSelectionPolicy',
        'defaultDiscrimination',
        'levelMappingRule',
        'topInformationRatio',
      ].sort()
    )
  })

  it('keeps the standard path isolated while exposing safe adaptive participant metadata', async () => {
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
    await prisma.permission.create({
      data: {
        userId: reader.id,
        practiceQuizId: adaptive.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions({ practiceQuizId: adaptive.id }, prisma)
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
    const unrelatedParticipant = await prisma.participant.create({
      data: {
        username: 'adaptive-unrelated-participant',
        password: 'not-used-in-service-test',
      },
    })
    const unrelatedParticipantCtx = {
      ...ownerCtx,
      user: {
        ...ownerCtx.user,
        sub: unrelatedParticipant.id,
        role: UserRole.PARTICIPANT,
      },
    }
    const publicCtx = { ...ownerCtx, user: undefined } as unknown as Context

    expect(
      await getCoursePublishedPracticeQuizzes({ courseId: course.id }, ownerCtx)
    ).toEqual([expect.objectContaining({ id: adaptive.id })])
    await expect(
      getCoursePublishedPracticeQuizzes({ courseId: course.id }, readerCtx)
    ).resolves.toEqual([expect.objectContaining({ id: adaptive.id })])
    await expect(
      getCoursePublishedPracticeQuizzes({ courseId: course.id }, participantCtx)
    ).resolves.toEqual([expect.objectContaining({ id: adaptive.id })])
    await expect(
      getCoursePublishedPracticeQuizzes({ courseId: course.id }, publicCtx)
    ).resolves.toEqual([])
    await expect(
      getCoursePublishedPracticeQuizzes(
        { courseId: course.id },
        unrelatedParticipantCtx
      )
    ).resolves.toEqual([])
    await expect(
      getCoursePublishedPracticeQuizzes({ courseId: course.id }, outsiderCtx)
    ).resolves.toEqual([])
    await expect(getPracticeQuizList(participantCtx)).resolves.toEqual([
      expect.objectContaining({
        id: course.id,
        practiceQuizzes: [expect.objectContaining({ id: adaptive.id })],
      }),
    ])
    await expect(
      getPracticeQuizData({ id: adaptive.id }, participantCtx)
    ).resolves.toMatchObject({
      id: adaptive.id,
      mode: PracticeQuizMode.ADAPTIVE,
      adaptiveMaximumQuestions: 50,
      isPreview: false,
      stacks: [],
    })
    await expect(
      getPracticeQuizData({ id: adaptive.id }, ownerCtx)
    ).resolves.toMatchObject({
      id: adaptive.id,
      isOwner: true,
      isPreview: true,
      stacks: [],
    })
    await expect(
      getPracticeQuizData({ id: adaptive.id }, readerCtx)
    ).resolves.toMatchObject({
      id: adaptive.id,
      isOwner: false,
      isPreview: true,
      stacks: [],
    })
    await expect(
      getPracticeQuizData({ id: adaptive.id }, unrelatedParticipantCtx)
    ).resolves.toBeNull()
    await expect(
      getPracticeQuizData({ id: adaptive.id }, outsiderCtx)
    ).resolves.toBeNull()
    await expect(
      getPracticeQuizData({ id: adaptive.id }, publicCtx)
    ).resolves.toBeNull()

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
    await expect(
      unpublishPracticeQuiz({ id: standard.id }, ownerCtx)
    ).resolves.toMatchObject({ status: PublicationStatus.DRAFT })
    expect(scheduledTaskDelete).toHaveBeenCalledWith(
      storedStandard.scheduledPublicationTaskId
    )
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
    })
    expect(rootWeights(preview!)).toEqual([0.8, 0.2])
    expect(preview?.assignments.every(({ a }) => a === 1.2)).toBe(true)
    expect(preview?.assignments.filter(({ enabled }) => enabled)).toHaveLength(
      20
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
    })
    expect(preview?.assignments.every(({ a }) => a === 1.8)).toBe(true)
    expect(preview?.readiness.ready).toBe(true)

    await expect(
      unlinkCompetenceTreeFromCourse(
        { treeId: fixture.treeId, courseId: course.id },
        ownerCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'COMPETENCE_TREE_LINK_IN_USE' },
    })
  })

  it('uses the competence-tree discrimination when Research omits its override', async () => {
    const course = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)
    await prisma.competenceTreeElementAssignment.updateMany({
      where: { treeId: fixture.treeId },
      data: { discrimination: null },
    })

    const setup = await getAdaptivePracticeQuizSetupPreview(
      {
        courseId: course.id,
        input: {
          competenceTreeId: fixture.treeId,
          preset: AdaptivePracticeQuizPreset.RESEARCH,
        },
      },
      ownerCtx
    )

    expect(setup.assignments.every(({ a }) => a === 1.7)).toBe(true)
  })

  it('round-trips direct overrides separately from ancestor-aware effective state', async () => {
    const course = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)
    const sourceAssignment =
      await prisma.competenceTreeElementAssignment.findUniqueOrThrow({
        where: { id: fixture.assignmentIds[0] },
        include: { leafNode: true },
      })
    const disabledRootId = sourceAssignment.leafNode.parentId!
    const enabledRootId = fixture.rootIds.find(
      (nodeId) => nodeId !== disabledRootId
    )!
    const nodeOverrides = [
      { nodeId: disabledRootId, enabled: false, weight: 1 },
      { nodeId: enabledRootId, enabled: true, weight: 1 },
    ]
    const elementOverrides = [
      {
        assignmentId: sourceAssignment.id,
        enabled: true,
        discrimination: 1.9,
      },
    ]
    const researchSettings = {
      levelMappingRule: AdaptiveLevelMappingRule.NEAREST,
      attemptSelectionPolicy: AdaptiveAttemptSelectionPolicy.LATEST_COMPLETED,
      defaultDiscrimination: 1.6,
      topInformationRatio: 0.7,
    }
    const input = {
      competenceTreeId: fixture.treeId,
      preset: AdaptivePracticeQuizPreset.RESEARCH,
      totalQuestionCap: 12,
      perLeafQuestionCap: 6,
      minQuestionsPerLeaf: 1,
      classificationZ: 1.28,
      showTimer: true,
      nodeOverrides,
      elementOverrides,
      researchSettings,
    }

    const setup = await getAdaptivePracticeQuizSetupPreview(
      { courseId: course.id, input },
      ownerCtx
    )
    expect(
      setup.nodes.find(({ id }) => id === sourceAssignment.leafNodeId)
    ).toMatchObject({
      overrideEnabled: true,
      effectiveEnabled: false,
      enabled: false,
    })
    expect(
      setup.assignments.find(({ id }) => id === sourceAssignment.id)
    ).toMatchObject({
      sourceEnabled: true,
      overrideEnabled: true,
      effectiveEnabled: false,
      enabled: false,
      overrideDiscrimination: 1.9,
      a: 1.9,
    })

    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      preset: AdaptivePracticeQuizPreset.RESEARCH,
      nodeOverrides,
      elementOverrides,
      researchSettings,
    })
    const stored = await getAdaptivePracticeQuizPreview(
      { id: quiz.id },
      ownerCtx
    )
    expect(
      stored?.nodes.find(({ id }) => id === sourceAssignment.leafNodeId)
    ).toMatchObject({ overrideEnabled: true, effectiveEnabled: false })
    expect(
      stored?.assignments.find(({ id }) => id === sourceAssignment.id)
    ).toMatchObject({
      sourceEnabled: true,
      overrideEnabled: true,
      effectiveEnabled: false,
      overrideDiscrimination: 1.9,
      a: 1.9,
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

  it('gates adaptive authoring and publication while preserving standard and remediation paths', async () => {
    const course = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)
    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      name: 'rollout-gated-adaptive-quiz',
    })
    const adaptiveConfig = {
      competenceTreeId: fixture.treeId,
      preset: AdaptivePracticeQuizPreset.DIAGNOSTIC,
      showTimer: true,
    }

    await prisma.course.update({
      where: { id: course.id },
      data: { isAdaptiveLearningEnabled: false },
    })

    await expect(
      getAdaptivePracticeQuizSetupPreview(
        { courseId: course.id, input: adaptiveConfig },
        ownerCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_COURSE_DISABLED' },
    })
    await expect(
      createAdaptiveQuiz({
        courseId: course.id,
        fixture,
        ctx: ownerCtx,
        name: 'blocked-adaptive-quiz',
      })
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_COURSE_DISABLED' },
    })
    await expect(
      editAdaptiveQuiz({
        id: quiz.id,
        courseId: course.id,
        fixture,
        ctx: ownerCtx,
      })
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_COURSE_DISABLED' },
    })

    await expect(
      getPracticeQuizPublicationPreview({ id: quiz.id }, ownerCtx)
    ).resolves.toMatchObject({
      canSchedule: false,
      readiness: {
        ready: false,
        errors: [expect.objectContaining({ code: 'ADAPTIVE_COURSE_DISABLED' })],
      },
    })
    await expect(
      publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_COURSE_DISABLED' },
    })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.count({
        where: { config: { practiceQuizId: quiz.id } },
      })
    ).toBe(0)
    expect(
      await prisma.practiceQuiz.count({
        where: { name: 'blocked-adaptive-quiz' },
      })
    ).toBe(0)

    const standard = await manipulatePracticeQuiz(
      quizInput({ courseId: course.id, name: 'rollout-standard-quiz' }),
      ownerCtx
    )
    await expect(
      publishPracticeQuiz({ id: standard.id }, ownerCtx)
    ).resolves.toMatchObject({ status: PublicationStatus.PUBLISHED })

    await prisma.course.update({
      where: { id: course.id },
      data: { isAdaptiveLearningEnabled: true },
    })
    await publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    await prisma.course.update({
      where: { id: course.id },
      data: { isAdaptiveLearningEnabled: false },
    })
    await expect(
      unpublishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).resolves.toMatchObject({ status: PublicationStatus.DRAFT })
    await expect(
      manipulatePracticeQuiz(
        {
          ...quizInput({
            courseId: course.id,
            name: 'rollout-remediated-standard-quiz',
          }),
          id: quiz.id,
          mode: PracticeQuizMode.STANDARD,
        },
        ownerCtx
      )
    ).resolves.toMatchObject({ mode: PracticeQuizMode.STANDARD })
    await expect(
      prisma.practiceQuizAdaptiveConfig.findUnique({
        where: { practiceQuizId: quiz.id },
      })
    ).resolves.toBeNull()
  })

  it('lets an executor inspect readiness without enabling adaptive scheduling', async () => {
    const course = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)
    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
    })
    await prisma.derivedPermission.create({
      data: {
        practiceQuizId: quiz.id,
        userId: reader.id,
        permissionLevel: PermissionLevel.EXECUTE,
      },
    })
    const executorCtx = {
      ...readerCtx,
      user: { ...readerCtx.user, scope: UserLoginScope.SESSION_EXEC },
    }
    const resolver = schema.getQueryType()!.getFields()
      .practiceQuizPublicationPreview!.resolve!

    await expect(
      resolver({}, { id: quiz.id }, executorCtx, {
        fieldName: 'practiceQuizPublicationPreview',
      } as never)
    ).resolves.toMatchObject({
      mode: PracticeQuizMode.ADAPTIVE,
      canSchedule: false,
      readiness: { ready: true, errors: [] },
      rootNodes: [
        expect.objectContaining({ name: 'Reading' }),
        expect.objectContaining({ name: 'Writing' }),
      ],
    })
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
      expect.objectContaining({
        code: 'ADAPTIVE_COVERAGE_BELOW_PRODUCT_MINIMUM',
      })
    )
    await expect(
      getPracticeQuizPublicationPreview({ id: quiz.id }, ownerCtx)
    ).resolves.toMatchObject({
      mode: PracticeQuizMode.ADAPTIVE,
      canSchedule: false,
      readiness: { ready: false },
    })

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

  it('keeps structurally unreachable Research quizzes editable but blocks publication', async () => {
    const course = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)
    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      preset: AdaptivePracticeQuizPreset.RESEARCH,
      totalQuestionCap: 3,
      minQuestionsPerLeaf: 2,
    })

    const preview = await getAdaptivePracticeQuizPreview(
      { id: quiz.id },
      ownerCtx
    )
    expect(preview?.readiness).toMatchObject({
      ready: false,
      errors: [],
    })
    expect(preview?.readiness.warnings).toContainEqual(
      expect.objectContaining({
        code: 'ADAPTIVE_GLOBAL_MINIMUM_EVIDENCE_CAPPED',
      })
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
    expect(preview?.assignments).toHaveLength(12)
    expect(
      preview?.assignments.every(
        ({ elementType, controlledAnswerReady }) =>
          elementType === ElementType.KPRIM && controlledAnswerReady
      )
    ).toBe(true)
    await publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    expect(
      await prisma.practiceQuizAdaptivePoolItem.count({
        where: { config: { practiceQuizId: quiz.id } },
      })
    ).toBe(12)
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
    ).toBe(0)
    expect(
      await prisma.practiceQuizAdaptiveConfig.findUniqueOrThrow({
        where: { practiceQuizId: quiz.id },
      })
    ).toMatchObject({ poolPublishedAt: null })
    expect(scheduledTaskDelete).not.toHaveBeenCalled()

    await publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    const originalPool = await prisma.practiceQuizAdaptivePoolItem.findMany({
      where: { config: { practiceQuizId: quiz.id } },
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
      where: { config: { practiceQuizId: quiz.id } },
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
          configId: config.id,
          competenceTreeId: config.competenceTreeId,
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
    ).rejects.toMatchObject({ code: 'P2003' })
    await expect(
      prisma.adaptivePracticeQuizResponse.create({
        data: {
          attemptId: attempt.id,
          configId: config.id,
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
        where: { config: { practiceQuizId: quiz.id } },
        orderBy: { sourceAssignmentId: 'asc' },
      })
    ).toEqual(replacedPool)

    await expect(
      unpublishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).resolves.toMatchObject({ status: PublicationStatus.DRAFT })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.findMany({
        where: { config: { practiceQuizId: quiz.id } },
        orderBy: { sourceAssignmentId: 'asc' },
      })
    ).toEqual(replacedPool)
    await expect(
      publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).resolves.toMatchObject({ status: PublicationStatus.PUBLISHED })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.findMany({
        where: { config: { practiceQuizId: quiz.id } },
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

  it('revalidates tree-owner access and preserves an authorized snapshot after revocation', async () => {
    const course = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)
    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      name: 'revoked-source-adaptive-quiz',
    })
    const sourceElementId = fixture.elementIds[0]!
    await prisma.element.update({
      where: { id: sourceElementId },
      data: { ownerId: reader.id },
    })
    const permission = await prisma.permission.create({
      data: {
        elementId: sourceElementId,
        userId: owner.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      {
        elementId: sourceElementId,
        userId: owner.id,
        updateAccessRequests: false,
      },
      prisma
    )

    await expect(
      getAdaptivePracticeQuizPreview({ id: quiz.id }, ownerCtx)
    ).resolves.toMatchObject({ readiness: { ready: true } })

    await revokeObjectAccess(
      { permissionId: permission.id, elementId: sourceElementId },
      readerCtx
    )
    const preview = await getAdaptivePracticeQuizPreview(
      { id: quiz.id },
      ownerCtx
    )
    expect(preview?.assignments).toContainEqual(
      expect.objectContaining({
        elementId: sourceElementId,
        available: false,
        availabilityReason: 'OWNER_ACCESS_REVOKED',
      })
    )
    expect(preview?.readiness.errors).toContainEqual(
      expect.objectContaining({ code: 'ADAPTIVE_ITEM_ACCESS_REVOKED' })
    )
    await expect(
      publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_SOURCE_ELEMENT_UNAVAILABLE' },
    })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.count({
        where: { config: { practiceQuizId: quiz.id } },
      })
    ).toBe(0)
    expect(
      await prisma.practiceQuiz.findUniqueOrThrow({ where: { id: quiz.id } })
    ).toMatchObject({ status: PublicationStatus.DRAFT })

    const restoredPermission = await prisma.permission.create({
      data: {
        elementId: sourceElementId,
        userId: owner.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      {
        elementId: sourceElementId,
        userId: owner.id,
        updateAccessRequests: false,
      },
      prisma
    )

    let releasePublicationLock!: () => void
    let markPublicationLocked!: () => void
    const publicationLocked = new Promise<void>((resolve) => {
      markPublicationLocked = resolve
    })
    const releasePublication = new Promise<void>((resolve) => {
      releasePublicationLock = resolve
    })
    const publicationBlocker = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "Element"
          WHERE "id" = ${sourceElementId}
          FOR SHARE
        `
        markPublicationLocked()
        await releasePublication
      },
      { timeout: 10_000 }
    )
    await publicationLocked

    const postPublicationRevocation = revokeObjectAccess(
      {
        permissionId: restoredPermission.id,
        elementId: sourceElementId,
      },
      readerCtx
    )
    const revocationState = await Promise.race([
      postPublicationRevocation.then(() => 'fulfilled'),
      new Promise<'pending'>((resolve) =>
        setTimeout(() => resolve('pending'), 100)
      ),
    ])
    try {
      await expect(
        publishPracticeQuiz({ id: quiz.id }, ownerCtx)
      ).resolves.toMatchObject({ status: PublicationStatus.PUBLISHED })
    } finally {
      releasePublicationLock()
    }
    await publicationBlocker
    await expect(postPublicationRevocation).resolves.toBe(restoredPermission.id)
    expect(revocationState).toBe('pending')
    const authorizedPool = await prisma.practiceQuizAdaptivePoolItem.findMany({
      where: { config: { practiceQuizId: quiz.id } },
      orderBy: { sourceAssignmentId: 'asc' },
    })
    expect(authorizedPool).toHaveLength(20)
    await expect(
      publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_SOURCE_ELEMENT_UNAVAILABLE' },
    })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.findMany({
        where: { config: { practiceQuizId: quiz.id } },
        orderBy: { sourceAssignmentId: 'asc' },
      })
    ).toEqual(authorizedPool)
  })

  it('serializes source-access revocation before concurrent publication', async () => {
    const course = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)
    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      name: 'concurrent-revocation-adaptive-quiz',
    })
    const sourceElementId = fixture.elementIds[0]!
    await prisma.element.update({
      where: { id: sourceElementId },
      data: { ownerId: reader.id },
    })
    const permission = await prisma.permission.create({
      data: {
        elementId: sourceElementId,
        userId: owner.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      {
        elementId: sourceElementId,
        userId: owner.id,
        updateAccessRequests: false,
      },
      prisma
    )

    let releasePermissionLock!: () => void
    let markPermissionLocked!: () => void
    const permissionLocked = new Promise<void>((resolve) => {
      markPermissionLocked = resolve
    })
    const releasePermission = new Promise<void>((resolve) => {
      releasePermissionLock = resolve
    })
    const permissionBlocker = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "Permission"
          WHERE "id" = ${permission.id}
          FOR UPDATE
        `
        markPermissionLocked()
        await releasePermission
      },
      { timeout: 10_000 }
    )
    await permissionLocked

    const revocation = revokeObjectAccess(
      { permissionId: permission.id, elementId: sourceElementId },
      readerCtx
    )
    let publication!: ReturnType<typeof publishPracticeQuiz>
    let publicationState = 'not-started'
    try {
      await waitForElementPermissionRevocationLock(sourceElementId)
      publication = publishPracticeQuiz({ id: quiz.id }, ownerCtx)
      publicationState = await Promise.race([
        publication.then(
          () => 'fulfilled',
          () => 'rejected'
        ),
        new Promise<'pending'>((resolve) =>
          setTimeout(() => resolve('pending'), 100)
        ),
      ])
    } finally {
      releasePermissionLock()
    }

    await permissionBlocker
    await expect(revocation).resolves.toBe(permission.id)
    await expect(publication).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_SOURCE_ELEMENT_UNAVAILABLE' },
    })
    expect(publicationState).toBe('pending')
    expect(
      await prisma.practiceQuizAdaptivePoolItem.count({
        where: { config: { practiceQuizId: quiz.id } },
      })
    ).toBe(0)
    expect(
      await prisma.practiceQuiz.findUniqueOrThrow({ where: { id: quiz.id } })
    ).toMatchObject({ status: PublicationStatus.DRAFT })
  })

  it('serializes group-based source-access removal with publication authorization', async () => {
    const course = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)
    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      name: 'group-revocation-adaptive-quiz',
    })
    const sourceElementId = fixture.elementIds[0]!
    await prisma.element.update({
      where: { id: sourceElementId },
      data: { ownerId: reader.id },
    })
    const group = await prisma.userGroup.create({
      data: {
        name: `adaptive-source-group-${crypto.randomUUID()}`,
        ownerId: reader.id,
        members: { connect: { id: owner.id } },
      },
    })
    await prisma.permission.create({
      data: {
        elementId: sourceElementId,
        userGroupId: group.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      {
        elementId: sourceElementId,
        userId: owner.id,
        updateAccessRequests: false,
      },
      prisma
    )
    let releasePublicationAuthorizationLock!: () => void
    let markPublicationAuthorizationLocked!: () => void
    const publicationAuthorizationLocked = new Promise<void>((resolve) => {
      markPublicationAuthorizationLocked = resolve
    })
    const releasePublicationAuthorization = new Promise<void>((resolve) => {
      releasePublicationAuthorizationLock = resolve
    })
    const publicationAuthorizationTransaction = prisma.$transaction(
      async (tx) => {
        await lockAdaptivePracticeQuizPublicationSources(quiz.id, tx)
        markPublicationAuthorizationLocked()
        await releasePublicationAuthorization
      },
      { timeout: 10_000 }
    )
    await publicationAuthorizationLocked

    const groupRemoval = removeUserFromGroup(
      { groupId: group.id, userId: owner.id },
      readerCtx
    )
    const removalState = await Promise.race([
      groupRemoval.then(() => 'fulfilled'),
      new Promise<'pending'>((resolve) =>
        setTimeout(() => resolve('pending'), 100)
      ),
    ])
    releasePublicationAuthorizationLock()

    await publicationAuthorizationTransaction
    await expect(groupRemoval).resolves.toBe(true)
    expect(removalState).toBe('pending')
    await expect(
      publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_SOURCE_ELEMENT_UNAVAILABLE' },
    })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.count({
        where: { config: { practiceQuizId: quiz.id } },
      })
    ).toBe(0)
  })

  it.each(['archive', 'delete'] as const)(
    'serializes competence-tree %s with publication authorization',
    async (stateChange) => {
      const course = await createCourse(owner.id)
      const fixture = await createTreeFixture(course.id, ownerCtx)
      const quiz = await createAdaptiveQuiz({
        courseId: course.id,
        fixture,
        ctx: ownerCtx,
        name: `${stateChange}-tree-publication-adaptive-quiz`,
      })

      let releasePublicationAuthorizationLock!: () => void
      let markPublicationAuthorizationLocked!: () => void
      const publicationAuthorizationLocked = new Promise<void>((resolve) => {
        markPublicationAuthorizationLocked = resolve
      })
      const releasePublicationAuthorization = new Promise<void>((resolve) => {
        releasePublicationAuthorizationLock = resolve
      })
      const publicationAuthorizationTransaction = prisma.$transaction(
        async (tx) => {
          await lockAdaptivePracticeQuizPublicationSources(quiz.id, tx)
          markPublicationAuthorizationLocked()
          await releasePublicationAuthorization
        },
        { timeout: 10_000 }
      )
      await publicationAuthorizationLocked

      const treeStateChange =
        stateChange === 'archive'
          ? archiveCompetenceTree({ id: fixture.treeId }, ownerCtx)
          : deleteCompetenceTree({ id: fixture.treeId }, ownerCtx)
      const stateChangeResult = await Promise.race([
        treeStateChange.then(() => 'fulfilled'),
        new Promise<'pending'>((resolve) =>
          setTimeout(() => resolve('pending'), 100)
        ),
      ])
      releasePublicationAuthorizationLock()

      await publicationAuthorizationTransaction
      await expect(treeStateChange).resolves.toBe(true)
      expect(stateChangeResult).toBe('pending')
      await expect(
        publishPracticeQuiz({ id: quiz.id }, ownerCtx)
      ).rejects.toMatchObject({
        extensions: { code: 'ADAPTIVE_COMPETENCE_TREE_UNAVAILABLE' },
      })
      expect(
        await prisma.practiceQuizAdaptivePoolItem.count({
          where: { config: { practiceQuizId: quiz.id } },
        })
      ).toBe(0)
      expect(
        await prisma.practiceQuiz.findUniqueOrThrow({ where: { id: quiz.id } })
      ).toMatchObject({ status: PublicationStatus.DRAFT })
    }
  )

  it('lets a quiz manager publish a linked tree without granting element access', async () => {
    const course = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)
    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      name: 'manager-publication-adaptive-quiz',
    })
    await prisma.derivedPermission.create({
      data: {
        practiceQuizId: quiz.id,
        userId: outsider.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    const resolver = schema.getMutationType()!.getFields().publishPracticeQuiz!
      .resolve!

    await expect(
      resolver({}, { id: quiz.id, availableFrom: null }, outsiderCtx, {
        fieldName: 'publishPracticeQuiz',
      } as never)
    ).resolves.toMatchObject({ status: PublicationStatus.PUBLISHED })
    expect(
      await prisma.derivedPermission.count({
        where: {
          userId: outsider.id,
          elementId: { in: fixture.elementIds },
        },
      })
    ).toBe(0)
  })
})

type TreeFixture = {
  treeId: string
  rootIds: number[]
  assignmentIds: number[]
  elementIds: number[]
}

function getSchemaFieldNames(typeName: string): string[] {
  const type = schema.getType(typeName) as
    | { getFields?: () => Record<string, unknown> }
    | undefined
  if (!type?.getFields) throw new Error(`Missing schema type ${typeName}.`)
  return Object.keys(type.getFields()).sort()
}

async function waitForElementPermissionRevocationLock(elementId: number) {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "Element"
          WHERE "id" = ${elementId}
          FOR SHARE NOWAIT
        `
      })
    } catch (error) {
      const metadata = (
        error as {
          meta?: {
            code?: string
            driverAdapterError?: {
              cause?: { code?: string; originalCode?: string }
            }
          }
        }
      ).meta
      const databaseCode =
        metadata?.code ??
        metadata?.driverAdapterError?.cause?.originalCode ??
        metadata?.driverAdapterError?.cause?.code
      if (databaseCode === '55P03') {
        return
      }
      throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Timed out waiting for the element revocation lock.')
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
      isAdaptiveLearningEnabled: true,
    },
  })
}

async function createTreeFixture(
  courseId: string,
  ctx: ContextWithUser,
  suffix = 'main'
): Promise<TreeFixture> {
  const elementSpecs = ['Reading', 'Writing'].flatMap((competence) =>
    ['basic', 'advanced'].flatMap((levelKey) =>
      Array.from({ length: 5 }, (_, index) => ({
        competence,
        levelKey,
        index,
      }))
    )
  )
  const elements = await Promise.all(
    elementSpecs.map(({ competence, levelKey, index }) =>
      createNumericalElement(
        `${competence} ${levelKey} numerical ${index + 1}${suffix === 'main' ? '' : ` ${suffix}`}`,
        ctx
      )
    )
  )
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
        targetItemCount: 5,
        enabled: true,
      },
      {
        leafKey: 'structure',
        levelKey: 'basic',
        targetItemCount: 5,
        enabled: true,
      },
      {
        leafKey: 'scanning',
        levelKey: 'advanced',
        targetItemCount: 5,
        enabled: true,
      },
      {
        leafKey: 'structure',
        levelKey: 'advanced',
        targetItemCount: 5,
        enabled: true,
      },
    ],
    assignments: elements.map((element, index) => ({
      elementId: element.id,
      leafKey:
        elementSpecs[index]!.competence === 'Reading'
          ? 'scanning'
          : 'structure',
      levelKey: elementSpecs[index]!.levelKey,
      enabled: true,
      discrimination: 2,
      enablePercentInput: false,
    })),
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
  const elementSpecs = ['basic', 'advanced'].flatMap((levelKey) =>
    Array.from({ length: 6 }, (_, index) => ({ levelKey, index }))
  )
  const elements = await Promise.all(
    elementSpecs.map(({ levelKey, index }) =>
      prisma.element.create({
        data: {
          type: ElementType.KPRIM,
          name: `All-false ${levelKey} KPRIM ${index + 1}`,
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
    )
  )
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
            targetItemCount: 6,
            enabled: true,
          },
          {
            leafKey: 'classification',
            levelKey: 'advanced',
            targetItemCount: 6,
            enabled: true,
          },
        ],
        assignments: elements.map((element, index) => ({
          elementId: element.id,
          leafKey: 'classification',
          levelKey: elementSpecs[index]!.levelKey,
          enabled: true,
          discrimination: 1.2,
          enablePercentInput: false,
        })),
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
    elementIds: elements.map(({ id }) => id),
  }
}

async function createNumericalElement(name: string, ctx: ContextWithUser) {
  return await prisma.element.create({
    data: {
      type: ElementType.NUMERICAL,
      name,
      content: 'Adaptive question',
      options: {
        exactSolutions: [0],
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
  totalQuestionCap,
  minQuestionsPerLeaf,
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
  }
  totalQuestionCap?: number
  minQuestionsPerLeaf?: number
}) {
  return await manipulatePracticeQuiz(
    {
      ...quizInput({ courseId, name }),
      mode: PracticeQuizMode.ADAPTIVE,
      adaptiveConfig: {
        competenceTreeId: fixture.treeId,
        preset,
        totalQuestionCap,
        minQuestionsPerLeaf,
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
  await prisma.participant.deleteMany()
  await prisma.practiceQuiz.deleteMany()
  await prisma.competenceTree.deleteMany()
  await prisma.element.deleteMany()
  await prisma.course.deleteMany()
  await prisma.user.deleteMany()
}
