import { prisma } from '@klicker-uzh/prisma'
import {
  AdaptivePracticeQuizPreset,
  ElementType,
  PermissionLevel,
  PracticeQuizMode,
  PublicationStatus,
  UserLoginScope,
} from '@klicker-uzh/prisma/client'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  getAdaptivePracticeQuizPreview,
  getAdaptivePracticeQuizSetupPreview,
  getPracticeQuizPublicationPreview,
} from '../src/services/adaptivePracticeQuizConfig.js'
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
  createAllFalseKprimTreeFixture,
  createCourse,
  createTreeFixture,
  editAdaptiveQuiz,
  quizInput,
} from './adaptivePracticeQuizConfigTestSupport.js'

export function registerAdaptivePracticeQuizConfigReadinessTests() {
  let ownerCtx: ContextWithUser
  let readerCtx: ContextWithUser
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
    void contextFor(outsider.id, scheduledTaskCreate, scheduledTaskDelete)
  })

  afterEach(cleanup)

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
}
