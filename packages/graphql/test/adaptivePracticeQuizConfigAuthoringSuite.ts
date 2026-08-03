import { prisma } from '@klicker-uzh/prisma'
import {
  AdaptiveAttemptSelectionPolicy,
  AdaptiveLevelMappingRule,
  AdaptivePracticeQuizPreset,
  ElementInstanceType,
  ElementStackType,
  UserRole,
} from '@klicker-uzh/prisma/client'
import {
  getInitialInstanceResults,
  processElementData,
} from '@klicker-uzh/util'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  getAdaptivePracticeQuizPreview,
  getAdaptivePracticeQuizSetupPreview,
} from '../src/services/adaptivePracticeQuizConfig.js'
import { unlinkCompetenceTreeFromCourse } from '../src/services/competenceTreeManagement.js'
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

import {
  cleanup,
  contextFor,
  createAdaptiveQuiz,
  createCourse,
  createTreeFixture,
  editAdaptiveQuiz,
  rootWeightOverrides,
  rootWeights,
} from './adaptivePracticeQuizConfigTestSupport.js'

export function registerAdaptivePracticeQuizConfigAuthoringTests() {
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

  it('rejects zero enabled root weights and excludes disabled roots', async () => {
    const course = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)

    await expect(
      createAdaptiveQuiz({
        courseId: course.id,
        fixture,
        ctx: ownerCtx,
        name: 'invalid-zero-root-weight',
        nodeOverrides: rootWeightOverrides(fixture, [0, 1]),
      })
    ).rejects.toMatchObject({
      extensions: {
        code: 'ADAPTIVE_CONFIG_INVALID',
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'ADAPTIVE_ROOT_WEIGHT_INVALID',
            nodeId: fixture.rootIds[0],
          }),
        ]),
      },
    })

    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      name: 'disabled-zero-root-weight',
      nodeOverrides: [
        { nodeId: fixture.rootIds[0]!, enabled: false, weight: 0 },
        { nodeId: fixture.rootIds[1]!, enabled: true, weight: 1 },
      ],
    })
    const preview = await getAdaptivePracticeQuizPreview(
      { id: quiz.id },
      ownerCtx
    )
    expect(rootWeights(preview!)).toEqual([0, 1])
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
}
