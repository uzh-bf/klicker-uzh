import { prisma } from '@klicker-uzh/prisma'
import {
  Locale,
  PermissionLevel,
  PracticeQuizMode,
  Prisma,
  PublicationStatus,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import type { Context, ContextWithUser } from '../src/lib/context.js'
import { updateCourseSettings } from '../src/services/courses.js'
import { getPracticeQuizList } from '../src/services/participants.js'
import {
  getCoursePublishedPracticeQuizzes,
  getPracticeQuizData,
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
  scaleVersionId: {
    kind: 'runtime',
    consumer: 'immutable proficiency-scale identity',
  },
  measurementVersion: {
    kind: 'runtime',
    consumer: 'server-owned estimator dispatch',
  },
  calibrationPolicyVersion: {
    kind: 'audit',
    consumer: 'publication calibration-policy identity',
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

import {
  cleanup,
  contextFor,
  createAdaptiveQuiz,
  createCourse,
  createTreeFixture,
  getSchemaFieldNames,
  quizInput,
} from './adaptivePracticeQuizConfigTestSupport.js'

export function registerAdaptivePracticeQuizConfigContractTests() {
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
        'calibrationPolicyVersion',
        'classificationZ',
        'competenceTreeId',
        'defaultDiscrimination',
        'levelMappingRule',
        'measurementVersion',
        'minQuestionsPerLeaf',
        'perLeafQuestionCap',
        'preset',
        'scaleVersionId',
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
        'scaleVersionId',
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
}
