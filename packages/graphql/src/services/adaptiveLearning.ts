import {
  DEFAULT_DISCRIMINATION,
  DEFAULT_QUESTION_THRESHOLD,
  DEFAULT_STANDARD_ERROR_THRESHOLD,
  DEFAULT_THETA_RANGE,
  DEFAULT_TOP_INFORMATION_RATIO,
  aggregateInverseVariance,
  aggregateWeightedEstimates,
  deriveGuessingParameter,
  mapLevelsToTheta,
  mapThetaToLevel,
  matchResultMessages,
  selectNextItem,
  selectSubCompetence,
  updateTheta,
  validateEnabledStructure,
  type AdaptiveItem,
} from '@klicker-uzh/adaptive-learning'
import {
  gradeQuestionFreeText,
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionSC,
} from '@klicker-uzh/grading'
import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { Context, ContextWithUser } from '../lib/context.js'

export interface AdaptiveLevelInput {
  label: string
  order: number
}

export interface AdaptiveSubCompetenceInput {
  name: string
  tagName?: string | null
  enabled: boolean
  order: number
  questionThreshold?: number | null
  standardErrorThreshold?: number | null
}

export interface AdaptiveCompetenceInput {
  name: string
  tagName?: string | null
  enabled: boolean
  order: number
  weight?: number | null
  questionThreshold?: number | null
  standardErrorThreshold?: number | null
  subCompetences: AdaptiveSubCompetenceInput[]
}

export interface AdaptiveElementInput {
  elementId: number
  competenceName: string
  subCompetenceName: string
  levelLabel: string
  enabled: boolean
  discrimination?: number | null
}

export interface AdaptiveResultMessageInput {
  order: number
  message: string
  minTheta?: number | null
  maxTheta?: number | null
  levelLabel?: string | null
  isFallback: boolean
}

export interface UpsertAdaptiveAssessmentInput {
  id?: string | null
  courseId: string
  name: string
  displayName: string
  description?: string | null
  levels: AdaptiveLevelInput[]
  competences: AdaptiveCompetenceInput[]
  elements: AdaptiveElementInput[]
  resultMessages: AdaptiveResultMessageInput[]
  standardErrorThreshold?: number | null
  questionThreshold?: number | null
  discrimination?: number | null
  thetaMin?: number | null
  thetaMax?: number | null
  topInformationRatio?: number | null
  showTimer?: boolean | null
  showCompetenceNames?: boolean | null
  showFinalResult?: boolean | null
  showSolutions?: boolean | null
}

export interface AdaptiveAnswerInput {
  choicesResponse?: { ix: number; selected: boolean }[] | null
  freeTextResponse?: string | null
}

export type AdaptiveAssessmentWithConfig = DB.AdaptiveAssessment & {
  levels: DB.AdaptiveAssessmentLevel[]
  competences: Array<
    DB.AdaptiveAssessmentCompetence & {
      subCompetences?: DB.AdaptiveAssessmentSubCompetence[]
    }
  >
  elements: Array<
    DB.AdaptiveAssessmentElement & {
      element?: DB.Element
      competence?: DB.AdaptiveAssessmentCompetence
      subCompetence?: DB.AdaptiveAssessmentSubCompetence
      level?: DB.AdaptiveAssessmentLevel
    }
  >
  resultMessages: Array<
    DB.AdaptiveAssessmentResultMessage & {
      level?: DB.AdaptiveAssessmentLevel | null
    }
  >
}

export interface AdaptiveItemPoolPreviewRow {
  competenceName: string
  subCompetenceName: string
  levelLabel: string
  count: number
}

export interface PublishedAdaptiveAssessmentInfo {
  id: string
  courseName: string
  displayName: string
  description: string | null
  thetaMin: number
  thetaMax: number
  standardErrorThreshold: number
  levels: DB.AdaptiveAssessmentLevel[]
}

export interface AdaptiveAttemptProgress {
  answeredQuestions: number
  maxQuestions: number
  standardError: number
  theta: number
  levelLabel: string | null
  completed: boolean
  elapsedSeconds: number
  message: string | null
  messages: string[]
}

export interface AdaptiveAttemptState {
  attempt: DB.AdaptiveAssessmentAttempt
  assessment: AdaptiveAssessmentWithConfig
  nextElement: DB.Element | null
  nextAdaptiveElementId: number | null
  nextCompetenceName: string | null
  nextSubCompetenceName: string | null
  progress: AdaptiveAttemptProgress
}

export interface AdaptiveCompetenceEstimate {
  competenceId: number
  competenceName: string
  weight: number
  theta: number | null
  standardError: number | null
  levelLabel: string | null
  answeredQuestions: number
  subCompetences: AdaptiveSubCompetenceEstimate[]
}

export interface AdaptiveSubCompetenceEstimate {
  subCompetenceId: number
  subCompetenceName: string
  theta: number | null
  standardError: number | null
  levelLabel: string | null
  answeredQuestions: number
}

export interface AdaptiveLevelDistributionBin {
  levelLabel: string
  minTheta: number
  maxTheta: number
  count: number
}

export enum AdaptiveOverviewAttemptMode {
  BEST = 'BEST',
  LATEST = 'LATEST',
}

export interface AdaptiveStudentStanding {
  attemptId: string | null
  assessmentId: string
  assessmentName: string
  startedAt: Date | null
  completedAt: Date | null
  answeredQuestions: number
  theta: number
  standardError: number
  levelLabel: string | null
  message: string | null
  messages: string[]
  competences: AdaptiveCompetenceEstimate[]
}

export interface AdaptiveStudentResultRow extends AdaptiveStudentStanding {
  participantId: string
  participantUsername: string
  participantEmail: string | null
  attemptNumber: number
  isLatestAttempt: boolean
  status: DB.AdaptiveAssessmentAttemptStatus | null
}

export interface AdaptiveItemResultRow {
  adaptiveElementId: number
  elementId: number
  elementName: string
  competenceName: string
  subCompetenceName: string
  levelLabel: string
  difficulty: number
  discrimination: number
  guessing: number
  exposure: number
  responseCount: number
  correctCount: number
  accuracy: number | null
}

export interface AdaptiveAssessmentResults {
  assessmentId: string
  participantCount: number
  completedCount: number
  inProgressCount: number
  attemptCount: number
  completedAttemptCount: number
  completionRate: number
  classMeanTheta: number | null
  meanStandardError: number | null
  averageAnsweredQuestions: number | null
  distribution: AdaptiveLevelDistributionBin[]
  competences: AdaptiveCompetenceEstimate[]
  students: AdaptiveStudentResultRow[]
  items: AdaptiveItemResultRow[]
}

type AdaptiveResponseRecord = {
  correct: boolean
  adaptiveElement: DB.AdaptiveAssessmentElement & {
    element: DB.Element
    competence: DB.AdaptiveAssessmentCompetence
    subCompetence: DB.AdaptiveAssessmentSubCompetence
    level: DB.AdaptiveAssessmentLevel
  }
}

const assessmentInclude = {
  levels: { orderBy: { order: 'asc' as const } },
  competences: {
    orderBy: { order: 'asc' as const },
    include: {
      subCompetences: { orderBy: { order: 'asc' as const } },
    },
  },
  elements: {
    include: {
      element: true,
      competence: true,
      subCompetence: true,
      level: true,
    },
    orderBy: { id: 'asc' as const },
  },
  resultMessages: {
    include: { level: true },
    orderBy: { order: 'asc' as const },
  },
}

const attemptInclude = {
  assessment: { include: assessmentInclude },
  responses: {
    include: {
      adaptiveElement: {
        include: {
          element: true,
          competence: true,
          subCompetence: true,
          level: true,
        },
      },
      element: true,
    },
    orderBy: { order: 'asc' as const },
  },
}

const SUPPORTED_ADAPTIVE_ELEMENT_TYPES = new Set<DB.ElementType>([
  DB.ElementType.SC,
  DB.ElementType.MC,
  DB.ElementType.KPRIM,
  DB.ElementType.FREE_TEXT,
])

export async function getAdaptiveAssessments(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  await requireCourseOwner(courseId, ctx)

  return ctx.prisma.adaptiveAssessment.findMany({
    where: { courseId, isDeleted: false },
    include: assessmentInclude,
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getAdaptiveAssessment(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const assessment = await ctx.prisma.adaptiveAssessment.findUnique({
    where: { id },
    include: assessmentInclude,
  })

  if (!assessment || assessment.isDeleted) return null
  await requireCourseOwner(assessment.courseId, ctx)
  return assessment
}

export async function getPublishedAdaptiveAssessments(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  return ctx.prisma.adaptiveAssessment.findMany({
    where: {
      courseId,
      isDeleted: false,
      status: DB.PublicationStatus.PUBLISHED,
    },
    include: assessmentInclude,
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getPublishedAdaptiveAssessmentInfos(
  {
    courseId,
  }: {
    courseId: string
  },
  ctx: Context
) {
  const assessments = await ctx.prisma.adaptiveAssessment.findMany({
    where: {
      courseId,
      isDeleted: false,
      status: DB.PublicationStatus.PUBLISHED,
    },
    select: {
      id: true,
      displayName: true,
      description: true,
      thetaMin: true,
      thetaMax: true,
      standardErrorThreshold: true,
      course: { select: { name: true } },
      levels: { orderBy: { order: 'asc' } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return assessments.map(({ course, ...assessment }) => ({
    ...assessment,
    courseName: course.name,
  }))
}

export async function upsertAdaptiveAssessment(
  input: UpsertAdaptiveAssessmentInput,
  ctx: ContextWithUser
) {
  validateAdaptiveAssessmentInput(input)
  const course = await requireCourseOwner(input.courseId, ctx)

  const assessment = await ctx.prisma.$transaction(async (prisma) => {
    if (input.id) {
      const existing = await prisma.adaptiveAssessment.findUnique({
        where: { id: input.id },
      })

      if (!existing || existing.courseId !== input.courseId) {
        throw new Error('Adaptive assessment not found.')
      }

      await prisma.adaptiveAssessmentResponse.deleteMany({
        where: { attempt: { assessmentId: input.id } },
      })
      await prisma.adaptiveAssessmentAttempt.deleteMany({
        where: { assessmentId: input.id },
      })
      await prisma.adaptiveAssessmentResultMessage.deleteMany({
        where: { assessmentId: input.id },
      })
      await prisma.adaptiveAssessmentElement.deleteMany({
        where: { assessmentId: input.id },
      })
      await prisma.adaptiveAssessmentSubCompetence.deleteMany({
        where: { assessmentId: input.id },
      })
      await prisma.adaptiveAssessmentCompetence.deleteMany({
        where: { assessmentId: input.id },
      })
      await prisma.adaptiveAssessmentLevel.deleteMany({
        where: { assessmentId: input.id },
      })

      return prisma.adaptiveAssessment.update({
        where: { id: input.id },
        data: assessmentData(input, course.ownerId),
      })
    }

    return prisma.adaptiveAssessment.create({
      data: {
        ...assessmentData(input, course.ownerId),
        courseId: input.courseId,
      },
    })
  })

  await createAdaptiveAssessmentConfig(assessment.id, input, ctx)

  return ctx.prisma.adaptiveAssessment.findUnique({
    where: { id: assessment.id },
    include: assessmentInclude,
  })
}

export async function publishAdaptiveAssessment(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const assessment = await getAdaptiveAssessment({ id }, ctx)
  if (!assessment) throw new Error('Adaptive assessment not found.')

  return ctx.prisma.adaptiveAssessment.update({
    where: { id },
    data: { status: DB.PublicationStatus.PUBLISHED },
    include: assessmentInclude,
  })
}

export async function archiveAdaptiveAssessment(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const assessment = await getAdaptiveAssessment({ id }, ctx)
  if (!assessment) throw new Error('Adaptive assessment not found.')

  return ctx.prisma.adaptiveAssessment.update({
    where: { id },
    data: { status: DB.PublicationStatus.ENDED, isDeleted: true },
    include: assessmentInclude,
  })
}

export async function getAdaptiveAssessmentItemPoolPreview(
  { assessmentId }: { assessmentId: string },
  ctx: ContextWithUser
) {
  const assessment = await getAdaptiveAssessment({ id: assessmentId }, ctx)
  if (!assessment) return []

  const rows = new Map<string, AdaptiveItemPoolPreviewRow>()
  for (const item of assessment.elements.filter(
    isEffectivelyEnabledAdaptiveElement
  )) {
    const key = `${item.competence?.name ?? '-'}|${item.subCompetence?.name ?? '-'}|${item.level?.label ?? '-'}`
    const existing = rows.get(key)

    if (existing) {
      existing.count += 1
    } else {
      rows.set(key, {
        competenceName: item.competence?.name ?? '-',
        subCompetenceName: item.subCompetence?.name ?? '-',
        levelLabel: item.level?.label ?? '-',
        count: 1,
      })
    }
  }

  return Array.from(rows.values()).sort((a, b) =>
    `${a.competenceName}-${a.subCompetenceName}-${a.levelLabel}`.localeCompare(
      `${b.competenceName}-${b.subCompetenceName}-${b.levelLabel}`
    )
  )
}

export async function getAdaptiveAssessmentResults(
  {
    assessmentId,
    attemptMode = AdaptiveOverviewAttemptMode.BEST,
  }: { assessmentId: string; attemptMode?: AdaptiveOverviewAttemptMode },
  ctx: ContextWithUser
): Promise<AdaptiveAssessmentResults | null> {
  const assessment = await getAdaptiveAssessment({ id: assessmentId }, ctx)
  if (!assessment) return null

  const participations = await ctx.prisma.participation.findMany({
    where: { courseId: assessment.courseId },
    include: {
      participant: {
        select: { id: true, username: true, email: true },
      },
      adaptiveAssessmentAttempts: {
        where: { assessmentId },
        include: attemptInclude,
        orderBy: { startedAt: 'desc' },
      },
    },
    orderBy: { id: 'asc' },
  })

  const attempts = participations.flatMap(
    (participation) => participation.adaptiveAssessmentAttempts
  )
  const completedAttempts = attempts.filter(
    (attempt) => attempt.status === DB.AdaptiveAssessmentAttemptStatus.COMPLETED
  )
  const overviewAttempts = participations
    .map((participation) =>
      selectOverviewAttempt(
        participation.adaptiveAssessmentAttempts,
        attemptMode
      )
    )
    .filter(
      (attempt): attempt is NonNullable<typeof attempt> => attempt != null
    )
  const inProgressCount = participations.filter((participation) =>
    participation.adaptiveAssessmentAttempts.some(
      (attempt) =>
        attempt.status === DB.AdaptiveAssessmentAttemptStatus.IN_PROGRESS
    )
  ).length
  const students = participations.flatMap((participation) =>
    buildStudentResultRows({
      assessment,
      participantId: participation.participant.id,
      participantUsername: participation.participant.username,
      participantEmail: participation.participant.email,
      attempts: participation.adaptiveAssessmentAttempts,
    })
  )

  return {
    assessmentId,
    participantCount: participations.length,
    completedCount: overviewAttempts.length,
    inProgressCount,
    attemptCount: attempts.length,
    completedAttemptCount: completedAttempts.length,
    completionRate:
      participations.length > 0
        ? overviewAttempts.length / participations.length
        : 0,
    classMeanTheta: average(
      overviewAttempts.map((attempt) => attempt.finalTheta ?? null)
    ),
    meanStandardError: average(
      overviewAttempts.map((attempt) => attempt.finalStandardError ?? null)
    ),
    averageAnsweredQuestions: average(
      overviewAttempts.map((attempt) => attempt.responses.length)
    ),
    distribution: buildDistribution(overviewAttempts, assessment),
    competences: buildClassCompetenceEstimates(overviewAttempts, assessment),
    students,
    items: buildItemResults(assessment, attempts),
  }
}

export async function getAdaptiveStudentStanding(
  { assessmentId }: { assessmentId: string },
  ctx: ContextWithUser
): Promise<AdaptiveStudentStanding | null> {
  const assessment = await ctx.prisma.adaptiveAssessment.findUnique({
    where: { id: assessmentId },
    include: assessmentInclude,
  })
  if (
    !assessment ||
    assessment.isDeleted ||
    assessment.status !== DB.PublicationStatus.PUBLISHED
  ) {
    throw new Error('Published adaptive assessment not found.')
  }

  await requireCourseParticipation(assessment.courseId, ctx)

  const attempt = await ctx.prisma.adaptiveAssessmentAttempt.findFirst({
    where: {
      assessmentId,
      participantId: ctx.user.sub,
      status: DB.AdaptiveAssessmentAttemptStatus.COMPLETED,
    },
    include: attemptInclude,
    orderBy: { completedAt: 'desc' },
  })

  if (!attempt) return null
  return buildStudentStanding(attempt)
}

export async function startAdaptiveAssessmentAttempt(
  { assessmentId }: { assessmentId: string },
  ctx: ContextWithUser
) {
  const assessment = await ctx.prisma.adaptiveAssessment.findUnique({
    where: { id: assessmentId },
    include: assessmentInclude,
  })
  if (
    !assessment ||
    assessment.isDeleted ||
    assessment.status !== DB.PublicationStatus.PUBLISHED
  ) {
    throw new Error('Published adaptive assessment not found.')
  }

  const participation = await requireCourseParticipation(
    assessment.courseId,
    ctx
  )
  const existingAttempt = await ctx.prisma.adaptiveAssessmentAttempt.findFirst({
    where: {
      assessmentId,
      participantId: ctx.user.sub,
      status: DB.AdaptiveAssessmentAttemptStatus.IN_PROGRESS,
    },
    orderBy: { startedAt: 'desc' },
  })

  if (existingAttempt) {
    return getAdaptiveAttemptState({ attemptId: existingAttempt.id }, ctx)
  }

  const latestCompletedAttempt =
    await ctx.prisma.adaptiveAssessmentAttempt.findFirst({
      where: {
        assessmentId,
        participantId: ctx.user.sub,
        status: DB.AdaptiveAssessmentAttemptStatus.COMPLETED,
      },
      orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
      select: {
        currentTheta: true,
        currentStandardError: true,
        finalTheta: true,
        finalStandardError: true,
      },
    })
  const initialTheta = clampAssessmentTheta(
    latestCompletedAttempt?.finalTheta ??
      latestCompletedAttempt?.currentTheta ??
      (assessment.thetaMin + assessment.thetaMax) / 2,
    assessment
  )
  const initialStandardError =
    latestCompletedAttempt?.finalStandardError ??
    latestCompletedAttempt?.currentStandardError ??
    null
  const attempt = await ctx.prisma.adaptiveAssessmentAttempt.create({
    data: {
      assessmentId,
      participantId: ctx.user.sub,
      participationId: participation.id,
      currentTheta: initialTheta,
      currentStandardError: initialStandardError,
      thetaHistory: [initialTheta],
      standardErrorHistory:
        initialStandardError != null ? [initialStandardError] : [],
    },
  })

  return getAdaptiveAttemptState({ attemptId: attempt.id }, ctx)
}

export async function getAdaptiveAttemptState(
  { attemptId }: { attemptId: string },
  ctx: ContextWithUser
) {
  const attempt = await ctx.prisma.adaptiveAssessmentAttempt.findUnique({
    where: { id: attemptId },
    include: attemptInclude,
  })

  if (!attempt || attempt.participantId !== ctx.user.sub) {
    throw new Error('Adaptive attempt not found.')
  }

  return buildAttemptState(attempt)
}

export async function submitAdaptiveAssessmentAnswer(
  {
    attemptId,
    adaptiveElementId,
    response,
  }: {
    attemptId: string
    adaptiveElementId: number
    response: AdaptiveAnswerInput
  },
  ctx: ContextWithUser
) {
  const attempt = await ctx.prisma.adaptiveAssessmentAttempt.findUnique({
    where: { id: attemptId },
    include: attemptInclude,
  })

  if (!attempt || attempt.participantId !== ctx.user.sub) {
    throw new Error('Adaptive attempt not found.')
  }
  if (attempt.status !== DB.AdaptiveAssessmentAttemptStatus.IN_PROGRESS) {
    return buildAttemptState(attempt)
  }

  const adaptiveElement = attempt.assessment.elements.find(
    (element) => element.id === adaptiveElementId
  )
  if (!adaptiveElement) throw new Error('Adaptive element not found.')
  if (!isEffectivelyEnabledAdaptiveElement(adaptiveElement)) {
    throw new Error('Adaptive element is inactive.')
  }

  const correctness = gradeAdaptiveAnswer(adaptiveElement.element, response)
  const nextResponseRecords = [
    ...attempt.responses,
    {
      adaptiveElement:
        adaptiveElement as AdaptiveResponseRecord['adaptiveElement'],
      correct: correctness,
    },
  ]
  const nextState = buildOverallEstimateFromRecords({
    assessment: attempt.assessment,
    records: nextResponseRecords,
    initialTheta: initialThetaForAttempt(attempt),
  })
  const elapsedSeconds = elapsedSince(attempt.startedAt)

  await ctx.prisma.$transaction([
    ctx.prisma.adaptiveAssessmentResponse.create({
      data: {
        attemptId,
        adaptiveElementId,
        elementId: adaptiveElement.elementId,
        order: attempt.responses.length,
        response: response as DB.Prisma.InputJsonValue,
        correct: correctness,
        thetaBefore: attempt.currentTheta,
        thetaAfter: nextState.theta,
        standardErrorAfter: nextState.standardError,
        elapsedSeconds,
      },
    }),
    ctx.prisma.adaptiveAssessmentElement.update({
      where: { id: adaptiveElementId },
      data: { exposure: { increment: 1 } },
    }),
  ])

  const updatedAttempt = await ctx.prisma.adaptiveAssessmentAttempt.findUnique({
    where: { id: attemptId },
    include: attemptInclude,
  })
  if (!updatedAttempt) throw new Error('Adaptive attempt not found.')

  const shouldFinalize =
    allCompetencesStopped(updatedAttempt) ||
    !selectNextAdaptiveElement(updatedAttempt)

  if (shouldFinalize) {
    const level = mapThetaToLevel(
      nextState.theta,
      updatedAttempt.assessment.levels,
      {
        min: updatedAttempt.assessment.thetaMin,
        max: updatedAttempt.assessment.thetaMax,
      }
    )

    await ctx.prisma.adaptiveAssessmentAttempt.update({
      where: { id: attemptId },
      data: {
        status: DB.AdaptiveAssessmentAttemptStatus.COMPLETED,
        currentTheta: nextState.theta,
        currentStandardError: nextState.standardError,
        finalTheta: nextState.theta,
        finalStandardError: nextState.standardError,
        finalLevelLabel: level?.label ?? null,
        elapsedSeconds,
        completedAt: new Date(),
        thetaHistory: thetaHistoryForAttempt(updatedAttempt),
        standardErrorHistory: standardErrorHistoryForAttempt(updatedAttempt),
      },
    })
  } else {
    await ctx.prisma.adaptiveAssessmentAttempt.update({
      where: { id: attemptId },
      data: {
        currentTheta: nextState.theta,
        currentStandardError: nextState.standardError,
        thetaHistory: thetaHistoryForAttempt(updatedAttempt),
        standardErrorHistory: standardErrorHistoryForAttempt(updatedAttempt),
      },
    })
  }

  return getAdaptiveAttemptState({ attemptId }, ctx)
}

async function requireCourseOwner(courseId: string, ctx: ContextWithUser) {
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, ownerId: true },
  })

  if (!course || course.ownerId !== ctx.user.sub) {
    throw new Error('Course not found or permission denied.')
  }

  return course
}

async function requireCourseParticipation(
  courseId: string,
  ctx: ContextWithUser
) {
  const participation = await ctx.prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId,
        participantId: ctx.user.sub,
      },
    },
  })

  if (!participation) {
    throw new GraphQLError('Course participation required.', {
      extensions: { code: 'FORBIDDEN' },
    })
  }

  return participation
}

function assessmentData(input: UpsertAdaptiveAssessmentInput, ownerId: string) {
  return {
    name: input.name,
    displayName: input.displayName,
    description: input.description ?? null,
    ownerId,
    standardErrorThreshold:
      input.standardErrorThreshold ?? DEFAULT_STANDARD_ERROR_THRESHOLD,
    questionThreshold: input.questionThreshold ?? DEFAULT_QUESTION_THRESHOLD,
    discrimination: input.discrimination ?? DEFAULT_DISCRIMINATION,
    thetaMin: input.thetaMin ?? DEFAULT_THETA_RANGE.min,
    thetaMax: input.thetaMax ?? DEFAULT_THETA_RANGE.max,
    topInformationRatio:
      input.topInformationRatio ?? DEFAULT_TOP_INFORMATION_RATIO,
    showTimer: input.showTimer ?? true,
    showCompetenceNames: input.showCompetenceNames ?? true,
    showFinalResult: input.showFinalResult ?? true,
    showSolutions: input.showSolutions ?? false,
  }
}

function adaptiveResultMessageRules(assessment: AdaptiveAssessmentWithConfig) {
  return assessment.resultMessages.map((rule) => ({
    order: rule.order,
    message: rule.message,
    isFallback: rule.isFallback,
    levelLabel: rule.level?.label ?? null,
    minTheta: rule.minTheta,
    maxTheta: rule.maxTheta,
  }))
}

function clampAssessmentTheta(
  theta: number,
  assessment: Pick<DB.AdaptiveAssessment, 'thetaMin' | 'thetaMax'>
) {
  return Math.min(assessment.thetaMax, Math.max(assessment.thetaMin, theta))
}

function initialThetaForAttempt(
  attempt: Pick<
    DB.AdaptiveAssessmentAttempt,
    'currentTheta' | 'thetaHistory'
  > & {
    assessment: Pick<DB.AdaptiveAssessment, 'thetaMin' | 'thetaMax'>
    responses?: unknown[]
  }
) {
  const history = numericJsonArray(attempt.thetaHistory)
  const firstResponse = attempt.responses?.[0] as
    | { thetaBefore?: unknown }
    | undefined
  const firstResponseTheta = firstResponse?.thetaBefore
  const theta =
    typeof firstResponseTheta === 'number'
      ? firstResponseTheta
      : (history[0] ?? attempt.currentTheta)

  return clampAssessmentTheta(theta, attempt.assessment)
}

function thetaHistoryForAttempt(
  attempt: Pick<
    DB.AdaptiveAssessmentAttempt,
    'currentTheta' | 'thetaHistory'
  > & {
    assessment: Pick<DB.AdaptiveAssessment, 'thetaMin' | 'thetaMax'>
    responses: Array<
      Pick<DB.AdaptiveAssessmentResponse, 'thetaBefore' | 'thetaAfter'>
    >
  }
) {
  return [
    initialThetaForAttempt(attempt),
    ...attempt.responses.map((response) => response.thetaAfter),
  ]
}

function standardErrorHistoryForAttempt(attempt: {
  responses: Array<Pick<DB.AdaptiveAssessmentResponse, 'standardErrorAfter'>>
}) {
  return attempt.responses.map((response) => response.standardErrorAfter)
}

function numericJsonArray(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.filter(
    (entry): entry is number =>
      typeof entry === 'number' && Number.isFinite(entry)
  )
}

async function createAdaptiveAssessmentConfig(
  assessmentId: string,
  input: UpsertAdaptiveAssessmentInput,
  ctx: Context
) {
  await ctx.prisma.$transaction(async (prisma) => {
    await prisma.adaptiveAssessmentLevel.createMany({
      data: input.levels.map((level) => ({
        assessmentId,
        label: level.label,
        order: level.order,
      })),
    })

    for (const competence of input.competences) {
      const createdCompetence =
        await prisma.adaptiveAssessmentCompetence.create({
          data: {
            assessmentId,
            name: competence.name,
            tagName: competence.tagName ?? null,
            enabled: competence.enabled,
            order: competence.order,
            weight: competence.weight ?? 1,
            questionThreshold: competence.questionThreshold ?? null,
            standardErrorThreshold: competence.standardErrorThreshold ?? null,
          },
        })

      await prisma.adaptiveAssessmentSubCompetence.createMany({
        data: competence.subCompetences.map((subCompetence) => ({
          assessmentId,
          competenceId: createdCompetence.id,
          name: subCompetence.name,
          tagName: subCompetence.tagName ?? null,
          enabled: subCompetence.enabled,
          order: subCompetence.order,
          questionThreshold: subCompetence.questionThreshold ?? null,
          standardErrorThreshold: subCompetence.standardErrorThreshold ?? null,
        })),
      })
    }

    const levels = await prisma.adaptiveAssessmentLevel.findMany({
      where: { assessmentId },
    })
    const competences = await prisma.adaptiveAssessmentCompetence.findMany({
      where: { assessmentId },
      include: { subCompetences: true },
    })
    const levelByLabel = new Map(levels.map((level) => [level.label, level]))
    const competenceByName = new Map(
      competences.map((competence) => [competence.name, competence])
    )
    const selectedElements = await prisma.element.findMany({
      where: {
        id: {
          in: [...new Set(input.elements.map((element) => element.elementId))],
        },
      },
      select: { id: true, type: true },
    })
    const selectedElementById = new Map(
      selectedElements.map((element) => [element.id, element])
    )

    await prisma.adaptiveAssessmentElement.createMany({
      data: input.elements.map((element) => {
        const competence = competenceByName.get(element.competenceName)
        const subCompetence = competence?.subCompetences.find(
          (entry) => entry.name === element.subCompetenceName
        )
        const level = levelByLabel.get(element.levelLabel)
        const selectedElement = selectedElementById.get(element.elementId)

        if (!competence || !subCompetence || !level || !selectedElement) {
          throw new Error('Invalid adaptive item mapping.')
        }
        if (!isSupportedAdaptiveElementType(selectedElement.type)) {
          throw new Error(
            'Adaptive assessments support only single choice, multiple choice, and free-text elements.'
          )
        }

        return {
          assessmentId,
          elementId: element.elementId,
          competenceId: competence.id,
          subCompetenceId: subCompetence.id,
          levelId: level.id,
          enabled: element.enabled,
          discrimination: element.discrimination ?? null,
        }
      }),
    })

    await prisma.adaptiveAssessmentResultMessage.createMany({
      data: input.resultMessages.map((message) => ({
        assessmentId,
        order: message.order,
        message: message.message,
        minTheta: message.minTheta ?? null,
        maxTheta: message.maxTheta ?? null,
        isFallback: message.isFallback,
        levelId: message.levelLabel
          ? levelByLabel.get(message.levelLabel)?.id
          : null,
      })),
    })
  })
}

function validateAdaptiveAssessmentInput(input: UpsertAdaptiveAssessmentInput) {
  if (input.levels.length < 2) {
    throw new Error('At least two levels are required.')
  }

  const enabledStructure = validateEnabledStructure(input.competences)
  if (!enabledStructure.valid) {
    throw new Error(enabledStructure.message ?? 'Invalid enabled structure.')
  }

  if (input.elements.length === 0) {
    throw new Error('At least one question must be mapped.')
  }

  if (
    input.resultMessages.filter((message) => message.isFallback).length !== 1
  ) {
    throw new Error('Exactly one fallback result message is required.')
  }

  const thetaMin = input.thetaMin ?? DEFAULT_THETA_RANGE.min
  const thetaMax = input.thetaMax ?? DEFAULT_THETA_RANGE.max

  if (thetaMin >= thetaMax) {
    throw new Error('Theta max must be larger than theta min.')
  }

  validateResultMessageIntervals(input.resultMessages, thetaMin, thetaMax)
}

function validateResultMessageIntervals(
  resultMessages: AdaptiveResultMessageInput[],
  thetaMin: number,
  thetaMax: number
) {
  const intervals = resultMessages
    .map((message) => {
      if (
        message.isFallback ||
        message.levelLabel ||
        (message.minTheta == null && message.maxTheta == null)
      ) {
        return null
      }

      if (message.minTheta == null || message.maxTheta == null) {
        throw new Error('Interval result messages require min and max theta.')
      }

      if (message.minTheta < thetaMin || message.maxTheta > thetaMax) {
        throw new Error(
          'Interval result messages must stay within theta bounds.'
        )
      }

      if (message.minTheta >= message.maxTheta) {
        throw new Error(
          'Interval result message max theta must be larger than min theta.'
        )
      }

      return {
        minTheta: message.minTheta,
        maxTheta: message.maxTheta,
      }
    })
    .filter(
      (interval): interval is { minTheta: number; maxTheta: number } =>
        interval != null
    )
    .sort((a, b) => a.minTheta - b.minTheta)

  for (let index = 1; index < intervals.length; index += 1) {
    const previous = intervals[index - 1]!
    const current = intervals[index]!
    if (current.minTheta < previous.maxTheta) {
      throw new Error('Interval result message ranges cannot overlap.')
    }
  }
}

function buildAttemptState(
  attempt: DB.AdaptiveAssessmentAttempt & {
    assessment: AdaptiveAssessmentWithConfig
    responses: Array<
      DB.AdaptiveAssessmentResponse & {
        adaptiveElement: DB.AdaptiveAssessmentElement & {
          element: DB.Element
          competence: DB.AdaptiveAssessmentCompetence
          subCompetence: DB.AdaptiveAssessmentSubCompetence
          level: DB.AdaptiveAssessmentLevel
        }
      }
    >
  }
): AdaptiveAttemptState {
  const selectedElement =
    attempt.status === DB.AdaptiveAssessmentAttemptStatus.IN_PROGRESS
      ? selectNextAdaptiveElement(attempt)
      : null
  const level = mapThetaToLevel(
    attempt.currentTheta,
    attempt.assessment.levels,
    {
      min: attempt.assessment.thetaMin,
      max: attempt.assessment.thetaMax,
    }
  )
  const messages =
    attempt.status === DB.AdaptiveAssessmentAttemptStatus.COMPLETED
      ? matchResultMessages({
          theta: attempt.finalTheta ?? attempt.currentTheta,
          levelLabel: attempt.finalLevelLabel ?? level?.label ?? null,
          rules: adaptiveResultMessageRules(attempt.assessment),
        })
      : []
  const message = messages[0] ?? null

  return {
    attempt,
    assessment: attempt.assessment,
    nextElement: adaptiveAttemptElement(
      selectedElement?.element,
      attempt.assessment.showSolutions
    ),
    nextAdaptiveElementId: selectedElement?.id ?? null,
    nextCompetenceName: selectedElement?.competence?.name ?? null,
    nextSubCompetenceName: selectedElement?.subCompetence?.name ?? null,
    progress: {
      answeredQuestions: attempt.responses.length,
      maxQuestions: effectiveAttemptQuestionThreshold(attempt.assessment),
      standardError:
        attempt.currentStandardError ??
        attempt.finalStandardError ??
        attempt.assessment.thetaMax - attempt.assessment.thetaMin,
      theta: attempt.currentTheta,
      levelLabel: level?.label ?? null,
      completed:
        attempt.status === DB.AdaptiveAssessmentAttemptStatus.COMPLETED,
      elapsedSeconds: attempt.elapsedSeconds ?? elapsedSince(attempt.startedAt),
      message,
      messages,
    },
  }
}

function effectiveAttemptQuestionThreshold(
  assessment: AdaptiveAssessmentWithConfig
) {
  const enabledCompetences = assessment.competences.filter(
    (competence) => competence.enabled
  )

  if (enabledCompetences.length === 0) {
    return assessment.questionThreshold
  }

  return enabledCompetences.reduce((sum, competence) => {
    const enabledSubCompetences = (competence.subCompetences ?? []).filter(
      (subCompetence) => subCompetence.enabled
    )

    return (
      sum +
      enabledSubCompetences.reduce(
        (subSum, subCompetence) =>
          subSum +
          (subCompetence.questionThreshold ?? assessment.questionThreshold),
        0
      )
    )
  }, 0)
}

function adaptiveAttemptElement(
  element: DB.Element | undefined,
  showSolutions: boolean
) {
  if (!element || showSolutions) return element ?? null

  if (
    element.type === DB.ElementType.SC ||
    element.type === DB.ElementType.MC ||
    element.type === DB.ElementType.KPRIM
  ) {
    const options = element.options as
      | { choices?: Record<string, unknown>[] }
      | undefined

    return {
      ...element,
      options: {
        ...(options ?? {}),
        choices:
          options?.choices?.map((choice) => {
            const { correct, ...sanitizedChoice } = choice
            return sanitizedChoice
          }) ?? [],
      },
    }
  }

  if (element.type === DB.ElementType.FREE_TEXT) {
    const options = (element.options ?? {}) as Record<string, unknown>
    const { solutions, ...sanitizedOptions } = options

    return {
      ...element,
      options: sanitizedOptions,
    }
  }

  return element
}

function buildStudentStanding(
  attempt: DB.AdaptiveAssessmentAttempt & {
    assessment: AdaptiveAssessmentWithConfig
    responses: Array<
      DB.AdaptiveAssessmentResponse & {
        adaptiveElement: DB.AdaptiveAssessmentElement & {
          element: DB.Element
          competence: DB.AdaptiveAssessmentCompetence
          subCompetence: DB.AdaptiveAssessmentSubCompetence
          level: DB.AdaptiveAssessmentLevel
        }
      }
    >
  }
): AdaptiveStudentStanding {
  const state = buildAttemptState(attempt)
  const theta = attempt.finalTheta ?? attempt.currentTheta
  const standardError =
    attempt.finalStandardError ??
    attempt.currentStandardError ??
    state.progress.standardError
  const level = mapThetaToLevel(theta, attempt.assessment.levels, {
    min: attempt.assessment.thetaMin,
    max: attempt.assessment.thetaMax,
  })

  return {
    attemptId: attempt.id,
    assessmentId: attempt.assessmentId,
    assessmentName: attempt.assessment.displayName,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    answeredQuestions: attempt.responses.length,
    theta,
    standardError,
    levelLabel: attempt.finalLevelLabel ?? level?.label ?? null,
    message: state.progress.message,
    messages: state.progress.messages,
    competences: buildAttemptCompetenceEstimates(attempt),
  }
}

function buildStudentResultRows({
  assessment,
  participantId,
  participantUsername,
  participantEmail,
  attempts,
}: {
  assessment: AdaptiveAssessmentWithConfig
  participantId: string
  participantUsername: string
  participantEmail: string | null
  attempts: Array<
    DB.AdaptiveAssessmentAttempt & {
      assessment: AdaptiveAssessmentWithConfig
      responses: Array<
        DB.AdaptiveAssessmentResponse & {
          adaptiveElement: DB.AdaptiveAssessmentElement & {
            element: DB.Element
            competence: DB.AdaptiveAssessmentCompetence
            subCompetence: DB.AdaptiveAssessmentSubCompetence
            level: DB.AdaptiveAssessmentLevel
          }
        }
      >
    }
  >
}): AdaptiveStudentResultRow[] {
  if (attempts.length === 0) {
    return [
      emptyStudentResultRow({
        assessment,
        participantId,
        participantUsername,
        participantEmail,
      }),
    ]
  }

  const oldestFirst = attempts.slice().sort((a, b) => {
    return a.startedAt.getTime() - b.startedAt.getTime()
  })
  const attemptNumberById = new Map(
    oldestFirst.map((attempt, index) => [attempt.id, index + 1])
  )
  const latestAttemptId = attempts[0]?.id

  return attempts.map((attempt) => ({
    ...buildStudentStanding(attempt),
    participantId,
    participantUsername,
    participantEmail,
    attemptNumber: attemptNumberById.get(attempt.id) ?? 1,
    isLatestAttempt: attempt.id === latestAttemptId,
    status: attempt.status,
  }))
}

function selectOverviewAttempt<T extends DB.AdaptiveAssessmentAttempt>(
  attempts: T[],
  attemptMode: AdaptiveOverviewAttemptMode
) {
  const completedAttempts = attempts.filter(
    (attempt) => attempt.status === DB.AdaptiveAssessmentAttemptStatus.COMPLETED
  )

  if (attemptMode === AdaptiveOverviewAttemptMode.LATEST) {
    return completedAttempts[0] ?? null
  }

  const bestAttempts = completedAttempts
    .slice()
    .sort((a, b) => (b.finalTheta ?? -Infinity) - (a.finalTheta ?? -Infinity))
  return bestAttempts[0] ?? null
}

function emptyStudentResultRow({
  assessment,
  participantId,
  participantUsername,
  participantEmail,
}: {
  assessment: AdaptiveAssessmentWithConfig
  participantId: string
  participantUsername: string
  participantEmail: string | null
}): AdaptiveStudentResultRow {
  return {
    attemptId: null,
    assessmentId: assessment.id,
    assessmentName: assessment.displayName,
    participantId,
    participantUsername,
    participantEmail,
    attemptNumber: 0,
    isLatestAttempt: false,
    status: null,
    startedAt: null,
    completedAt: null,
    answeredQuestions: 0,
    theta: 0,
    standardError: assessment.thetaMax - assessment.thetaMin,
    levelLabel: null,
    message: null,
    messages: [],
    competences: assessment.competences.map((competence) => ({
      competenceId: competence.id,
      competenceName: competence.name,
      weight: competence.weight,
      theta: null,
      standardError: null,
      levelLabel: null,
      answeredQuestions: 0,
      subCompetences: (competence.subCompetences ?? [])
        .filter((subCompetence) => subCompetence.enabled)
        .map((subCompetence) => ({
          subCompetenceId: subCompetence.id,
          subCompetenceName: subCompetence.name,
          theta: null,
          standardError: null,
          levelLabel: null,
          answeredQuestions: 0,
        })),
    })),
  }
}

function buildAttemptCompetenceEstimates(
  attempt: DB.AdaptiveAssessmentAttempt & {
    assessment: AdaptiveAssessmentWithConfig
    responses: Array<
      DB.AdaptiveAssessmentResponse & {
        adaptiveElement: DB.AdaptiveAssessmentElement & {
          element: DB.Element
          competence: DB.AdaptiveAssessmentCompetence
          subCompetence: DB.AdaptiveAssessmentSubCompetence
          level: DB.AdaptiveAssessmentLevel
        }
      }
    >
  }
): AdaptiveCompetenceEstimate[] {
  return attempt.assessment.competences.map((competence) => {
    const subCompetences = buildAttemptSubCompetenceEstimates(
      attempt,
      competence
    )
    const responses = attempt.responses.filter(
      (response) =>
        response.adaptiveElement.competenceId === competence.id &&
        isEffectivelyEnabledAdaptiveElement(response.adaptiveElement)
    )

    if (responses.length === 0) {
      return {
        competenceId: competence.id,
        competenceName: competence.name,
        weight: competence.weight,
        theta: null,
        standardError: null,
        levelLabel: null,
        answeredQuestions: 0,
        subCompetences,
      }
    }

    const state = updateTheta({
      responses: responses.map((response) => ({
        item: itemFromAdaptiveElement(
          attempt.assessment,
          response.adaptiveElement
        ),
        correct: response.correct,
      })),
      range: {
        min: attempt.assessment.thetaMin,
        max: attempt.assessment.thetaMax,
      },
    })
    const level = mapThetaToLevel(state.theta, attempt.assessment.levels, {
      min: attempt.assessment.thetaMin,
      max: attempt.assessment.thetaMax,
    })

    return {
      competenceId: competence.id,
      competenceName: competence.name,
      weight: competence.weight,
      theta: state.theta,
      standardError: state.standardError,
      levelLabel: level?.label ?? null,
      answeredQuestions: responses.length,
      subCompetences,
    }
  })
}

function buildAttemptSubCompetenceEstimates(
  attempt: DB.AdaptiveAssessmentAttempt & {
    assessment: AdaptiveAssessmentWithConfig
    responses: Array<
      DB.AdaptiveAssessmentResponse & {
        adaptiveElement: DB.AdaptiveAssessmentElement & {
          element: DB.Element
          competence: DB.AdaptiveAssessmentCompetence
          subCompetence: DB.AdaptiveAssessmentSubCompetence
          level: DB.AdaptiveAssessmentLevel
        }
      }
    >
  },
  competence: AdaptiveAssessmentWithConfig['competences'][number]
): AdaptiveSubCompetenceEstimate[] {
  return (competence.subCompetences ?? [])
    .filter((subCompetence) => subCompetence.enabled)
    .map((subCompetence) => {
      const responses = attempt.responses.filter(
        (response) =>
          response.adaptiveElement.subCompetenceId === subCompetence.id &&
          isEffectivelyEnabledAdaptiveElement(response.adaptiveElement)
      )

      if (responses.length === 0) {
        return {
          subCompetenceId: subCompetence.id,
          subCompetenceName: subCompetence.name,
          theta: null,
          standardError: null,
          levelLabel: null,
          answeredQuestions: 0,
        }
      }

      const state = updateTheta({
        responses: responses.map((response) => ({
          item: itemFromAdaptiveElement(
            attempt.assessment,
            response.adaptiveElement
          ),
          correct: response.correct,
        })),
        range: {
          min: attempt.assessment.thetaMin,
          max: attempt.assessment.thetaMax,
        },
      })
      const level = mapThetaToLevel(state.theta, attempt.assessment.levels, {
        min: attempt.assessment.thetaMin,
        max: attempt.assessment.thetaMax,
      })

      return {
        subCompetenceId: subCompetence.id,
        subCompetenceName: subCompetence.name,
        theta: state.theta,
        standardError: state.standardError,
        levelLabel: level?.label ?? null,
        answeredQuestions: responses.length,
      }
    })
}

function buildClassCompetenceEstimates(
  attempts: Array<
    DB.AdaptiveAssessmentAttempt & {
      assessment: AdaptiveAssessmentWithConfig
      responses: Array<
        DB.AdaptiveAssessmentResponse & {
          adaptiveElement: DB.AdaptiveAssessmentElement & {
            element: DB.Element
            competence: DB.AdaptiveAssessmentCompetence
            subCompetence: DB.AdaptiveAssessmentSubCompetence
            level: DB.AdaptiveAssessmentLevel
          }
        }
      >
    }
  >,
  assessment: AdaptiveAssessmentWithConfig
): AdaptiveCompetenceEstimate[] {
  const estimatesByAttempt = attempts.map((attempt) =>
    buildAttemptCompetenceEstimates(attempt)
  )

  return assessment.competences.map((competence) => {
    const estimates = estimatesByAttempt
      .flat()
      .filter(
        (estimate) =>
          estimate.competenceId === competence.id &&
          estimate.theta != null &&
          estimate.standardError != null
      ) as Array<
      AdaptiveCompetenceEstimate & {
        theta: number
        standardError: number
      }
    >
    const aggregate = aggregateInverseVariance(estimates)
    const level =
      aggregate &&
      mapThetaToLevel(aggregate.theta, assessment.levels, {
        min: assessment.thetaMin,
        max: assessment.thetaMax,
      })

    return {
      competenceId: competence.id,
      competenceName: competence.name,
      weight: competence.weight,
      theta: aggregate?.theta ?? null,
      standardError: aggregate?.standardError ?? null,
      levelLabel: level?.label ?? null,
      answeredQuestions: estimates.reduce(
        (sum, estimate) => sum + estimate.answeredQuestions,
        0
      ),
      subCompetences: buildClassSubCompetenceEstimates({
        assessment,
        competence,
        estimatesByAttempt,
      }),
    }
  })
}

function buildClassSubCompetenceEstimates({
  assessment,
  competence,
  estimatesByAttempt,
}: {
  assessment: AdaptiveAssessmentWithConfig
  competence: AdaptiveAssessmentWithConfig['competences'][number]
  estimatesByAttempt: AdaptiveCompetenceEstimate[][]
}): AdaptiveSubCompetenceEstimate[] {
  return (competence.subCompetences ?? [])
    .filter((subCompetence) => subCompetence.enabled)
    .map((subCompetence) => {
      const estimates = estimatesByAttempt
        .flat()
        .filter((estimate) => estimate.competenceId === competence.id)
        .flatMap((estimate) => estimate.subCompetences)
        .filter(
          (estimate) =>
            estimate.subCompetenceId === subCompetence.id &&
            estimate.theta != null &&
            estimate.standardError != null
        ) as Array<
        AdaptiveSubCompetenceEstimate & {
          theta: number
          standardError: number
        }
      >
      const aggregate = aggregateInverseVariance(estimates)
      const level =
        aggregate &&
        mapThetaToLevel(aggregate.theta, assessment.levels, {
          min: assessment.thetaMin,
          max: assessment.thetaMax,
        })

      return {
        subCompetenceId: subCompetence.id,
        subCompetenceName: subCompetence.name,
        theta: aggregate?.theta ?? null,
        standardError: aggregate?.standardError ?? null,
        levelLabel: level?.label ?? null,
        answeredQuestions: estimates.reduce(
          (sum, estimate) => sum + estimate.answeredQuestions,
          0
        ),
      }
    })
}

function buildDistribution(
  attempts: Array<
    DB.AdaptiveAssessmentAttempt & {
      assessment: AdaptiveAssessmentWithConfig
    }
  >,
  assessment: AdaptiveAssessmentWithConfig
): AdaptiveLevelDistributionBin[] {
  const mappedLevels = mapLevelsToTheta(assessment.levels, {
    min: assessment.thetaMin,
    max: assessment.thetaMax,
  })

  return mappedLevels.map((level) => ({
    levelLabel: level.label,
    minTheta: Number.isFinite(level.lowerBound)
      ? level.lowerBound
      : assessment.thetaMin,
    maxTheta: Number.isFinite(level.upperBound)
      ? level.upperBound
      : assessment.thetaMax,
    count: attempts.filter((attempt) => {
      const theta = attempt.finalTheta ?? attempt.currentTheta
      const attemptLevel = mapThetaToLevel(theta, assessment.levels, {
        min: assessment.thetaMin,
        max: assessment.thetaMax,
      })
      return attemptLevel?.label === level.label
    }).length,
  }))
}

function buildItemResults(
  assessment: AdaptiveAssessmentWithConfig,
  attempts: Array<
    DB.AdaptiveAssessmentAttempt & {
      responses: Array<
        DB.AdaptiveAssessmentResponse & {
          adaptiveElement: DB.AdaptiveAssessmentElement & {
            element: DB.Element
            competence: DB.AdaptiveAssessmentCompetence
            subCompetence: DB.AdaptiveAssessmentSubCompetence
            level: DB.AdaptiveAssessmentLevel
          }
        }
      >
    }
  >
): AdaptiveItemResultRow[] {
  const responses = attempts.flatMap((attempt) => attempt.responses)
  const mappedLevels = mapLevelsToTheta(assessment.levels, {
    min: assessment.thetaMin,
    max: assessment.thetaMax,
  })

  return assessment.elements
    .filter(isEffectivelyEnabledAdaptiveElement)
    .map((element) => {
      const item = itemFromAdaptiveElement(assessment, element, mappedLevels)
      const itemResponses = responses.filter(
        (response) => response.adaptiveElementId === element.id
      )
      const correctCount = itemResponses.filter(
        (response) => response.correct
      ).length

      return {
        adaptiveElementId: element.id,
        elementId: element.elementId,
        elementName: element.element?.name ?? `Element #${element.elementId}`,
        competenceName: element.competence?.name ?? '-',
        subCompetenceName: element.subCompetence?.name ?? '-',
        levelLabel: element.level?.label ?? '-',
        difficulty: item.b,
        discrimination: item.a ?? assessment.discrimination,
        guessing: item.c ?? 0,
        exposure: element.exposure,
        responseCount: itemResponses.length,
        correctCount,
        accuracy:
          itemResponses.length > 0 ? correctCount / itemResponses.length : null,
      }
    })
}

function average(values: Array<number | null | undefined>) {
  const finiteValues = values.filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value)
  )

  if (finiteValues.length === 0) return null
  return (
    finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length
  )
}

function estimateRecords({
  assessment,
  records,
  initialTheta,
}: {
  assessment: AdaptiveAssessmentWithConfig
  records: AdaptiveResponseRecord[]
  initialTheta: number
}) {
  return updateTheta({
    responses: records
      .filter((record) =>
        isEffectivelyEnabledAdaptiveElement(record.adaptiveElement)
      )
      .map((record) => ({
        item: itemFromAdaptiveElement(assessment, record.adaptiveElement),
        correct: record.correct,
      })),
    range: {
      min: assessment.thetaMin,
      max: assessment.thetaMax,
    },
    initialTheta,
  })
}

function buildOverallEstimateFromRecords({
  assessment,
  records,
  initialTheta,
}: {
  assessment: AdaptiveAssessmentWithConfig
  records: AdaptiveResponseRecord[]
  initialTheta: number
}) {
  const competenceEstimates = assessment.competences
    .filter((competence) => competence.enabled)
    .flatMap((competence) => {
      const competenceRecords = recordsForCompetence(records, competence.id)
      if (competenceRecords.length === 0) return []

      const state = estimateRecords({
        assessment,
        records: competenceRecords,
        initialTheta,
      })

      return [
        {
          theta: state.theta,
          standardError: state.standardError,
          weight: competence.weight,
        },
      ]
    })
  const aggregate = aggregateWeightedEstimates(competenceEstimates)

  if (!aggregate) {
    return {
      theta: clampAssessmentTheta(initialTheta, assessment),
      standardError: Infinity,
    }
  }

  return {
    theta: clampAssessmentTheta(Number(aggregate.theta.toFixed(4)), assessment),
    standardError: aggregate.standardError,
  }
}

function allCompetencesStopped(attempt: {
  currentTheta: number
  thetaHistory: unknown
  assessment: AdaptiveAssessmentWithConfig
  responses: AdaptiveResponseRecord[]
}) {
  const answeredItemIds = new Set(
    attempt.responses.map((response) => response.adaptiveElement.id)
  )
  const availableElements = attempt.assessment.elements.filter(
    (element) =>
      !answeredItemIds.has(element.id) &&
      isEffectivelyEnabledAdaptiveElement(element)
  )
  const initialTheta = initialThetaForAttempt(attempt)
  const enabledCompetences = attempt.assessment.competences.filter(
    (competence) => competence.enabled
  )

  return (
    enabledCompetences.length === 0 ||
    enabledCompetences.every((competence) =>
      isCompetenceStopped({
        assessment: attempt.assessment,
        competence,
        records: attempt.responses,
        availableElements,
        initialTheta,
      })
    )
  )
}

function isCompetenceStopped({
  assessment,
  competence,
  records,
  availableElements,
  initialTheta,
}: {
  assessment: AdaptiveAssessmentWithConfig
  competence: AdaptiveAssessmentWithConfig['competences'][number]
  records: AdaptiveResponseRecord[]
  availableElements: AdaptiveAssessmentWithConfig['elements']
  initialTheta: number
}) {
  if (!competence.enabled) return true

  const enabledSubCompetences = (competence.subCompetences ?? []).filter(
    (subCompetence) => subCompetence.enabled
  )
  if (enabledSubCompetences.length === 0) return true
  if (remainingCompetenceCoverage(availableElements, competence.id) === 0) {
    return true
  }

  return enabledSubCompetences.every((subCompetence) =>
    isSubCompetenceStopped({
      assessment,
      competence,
      subCompetence,
      records,
      availableElements,
      initialTheta,
    })
  )
}

function isSubCompetenceStopped({
  assessment,
  competence,
  subCompetence,
  records,
  availableElements,
  initialTheta,
}: {
  assessment: AdaptiveAssessmentWithConfig
  competence: AdaptiveAssessmentWithConfig['competences'][number]
  subCompetence: DB.AdaptiveAssessmentSubCompetence
  records: AdaptiveResponseRecord[]
  availableElements: AdaptiveAssessmentWithConfig['elements']
  initialTheta: number
}) {
  if (!competence.enabled || !subCompetence.enabled) return true

  const subCompetenceRecords = recordsForSubCompetence(
    records,
    subCompetence.id
  )
  const subCompetenceState = estimateRecords({
    assessment,
    records: subCompetenceRecords,
    initialTheta,
  })
  const questionThreshold =
    subCompetence.questionThreshold ?? assessment.questionThreshold
  const standardErrorThreshold =
    subCompetence.standardErrorThreshold ?? assessment.standardErrorThreshold

  return (
    subCompetenceRecords.length >= questionThreshold ||
    subCompetenceState.standardError <= standardErrorThreshold ||
    remainingLevelCoverage(availableElements, subCompetence.id) === 0
  )
}

function recordsForCompetence(
  records: AdaptiveResponseRecord[],
  competenceId: number
) {
  return records.filter(
    (record) =>
      record.adaptiveElement.competenceId === competenceId &&
      isEffectivelyEnabledAdaptiveElement(record.adaptiveElement)
  )
}

function recordsForSubCompetence(
  records: AdaptiveResponseRecord[],
  subCompetenceId: number
) {
  return records.filter(
    (record) =>
      record.adaptiveElement.subCompetenceId === subCompetenceId &&
      isEffectivelyEnabledAdaptiveElement(record.adaptiveElement)
  )
}

function countRecords(records: AdaptiveResponseRecord[]) {
  return records.length
}

function remainingLevelCoverage(
  availableElements: AdaptiveAssessmentWithConfig['elements'],
  subCompetenceId: number
) {
  return new Set(
    availableElements
      .filter((element) => element.subCompetenceId === subCompetenceId)
      .map((element) => element.level?.label)
      .filter(Boolean)
  ).size
}

function remainingCompetenceCoverage(
  availableElements: AdaptiveAssessmentWithConfig['elements'],
  competenceId: number
) {
  return availableElements.filter(
    (element) => element.competenceId === competenceId
  ).length
}

function selectNextAdaptiveElement(
  attempt: DB.AdaptiveAssessmentAttempt & {
    assessment: AdaptiveAssessmentWithConfig
    responses: AdaptiveResponseRecord[]
  }
) {
  const mappedLevels = mapLevelsToTheta(attempt.assessment.levels, {
    min: attempt.assessment.thetaMin,
    max: attempt.assessment.thetaMax,
  })
  const answeredItemIds = new Set(
    attempt.responses.map((response) => response.adaptiveElement.id)
  )
  const availableElements = attempt.assessment.elements.filter(
    (element) =>
      !answeredItemIds.has(element.id) &&
      isEffectivelyEnabledAdaptiveElement(element)
  )

  if (availableElements.length === 0) return null

  const initialTheta = initialThetaForAttempt(attempt)

  for (const competence of attempt.assessment.competences) {
    if (
      isCompetenceStopped({
        assessment: attempt.assessment,
        competence,
        records: attempt.responses,
        availableElements,
        initialTheta,
      })
    ) {
      continue
    }

    const selectedSubCompetence = selectSubCompetence({
      candidates: (competence.subCompetences ?? []).map((subCompetence) => ({
        competenceId: String(competence.id),
        subCompetenceId: String(subCompetence.id),
        enabled:
          competence.enabled &&
          subCompetence.enabled &&
          !isSubCompetenceStopped({
            assessment: attempt.assessment,
            competence,
            subCompetence,
            records: attempt.responses,
            availableElements,
            initialTheta,
          }),
        answeredQuestions: countRecords(
          recordsForSubCompetence(attempt.responses, subCompetence.id)
        ),
        questionThreshold:
          subCompetence.questionThreshold ??
          attempt.assessment.questionThreshold,
        coverage: remainingLevelCoverage(availableElements, subCompetence.id),
      })),
    })

    if (!selectedSubCompetence) continue

    const candidateElements = availableElements.filter(
      (element) =>
        element.subCompetenceId ===
        Number(selectedSubCompetence.subCompetenceId)
    )
    const subCompetenceRecords = recordsForSubCompetence(
      attempt.responses,
      Number(selectedSubCompetence.subCompetenceId)
    )
    const subCompetenceState = estimateRecords({
      assessment: attempt.assessment,
      records: subCompetenceRecords,
      initialTheta,
    })
    const selectedItem = selectNextItem({
      theta: subCompetenceState.theta,
      answeredItemIds,
      items: candidateElements.map((element) =>
        itemFromAdaptiveElement(attempt.assessment, element, mappedLevels)
      ),
    })

    const selectedElement =
      candidateElements.find((element) => element.id === selectedItem?.id) ??
      null

    if (selectedElement) return selectedElement
  }

  return null
}

function itemFromAdaptiveElement(
  assessment: AdaptiveAssessmentWithConfig,
  adaptiveElement: DB.AdaptiveAssessmentElement & {
    element?: DB.Element
    level?: DB.AdaptiveAssessmentLevel
  },
  mappedLevels = mapLevelsToTheta(assessment.levels, {
    min: assessment.thetaMin,
    max: assessment.thetaMax,
  })
): AdaptiveItem {
  const elementType = adaptiveElement.element?.type
  const elementOptions = adaptiveElement.element?.options as
    | { choices?: unknown[] }
    | undefined
  const choiceCount =
    elementType === DB.ElementType.SC ||
    elementType === DB.ElementType.MC ||
    elementType === DB.ElementType.KPRIM
      ? (elementOptions?.choices?.length ?? 4)
      : undefined
  const itemType = adaptiveItemType(elementType)
  if (!itemType) {
    throw new Error(`Unsupported adaptive element type: ${elementType ?? '-'}.`)
  }
  const levelTheta =
    mappedLevels.find((level) => level.label === adaptiveElement.level?.label)
      ?.theta ?? 0

  return {
    id: adaptiveElement.id,
    type: itemType,
    a: adaptiveElement.discrimination ?? assessment.discrimination,
    b: levelTheta,
    c: deriveGuessingParameter({ type: itemType, choiceCount }),
    choiceCount,
    enabled: adaptiveElement.enabled,
    exposure: adaptiveElement.exposure,
    levelLabel: adaptiveElement.level?.label,
  }
}

function gradeAdaptiveAnswer(
  element: DB.Element,
  response: AdaptiveAnswerInput
) {
  if (!isSupportedAdaptiveElementType(element.type)) {
    throw new Error(`Unsupported adaptive element type: ${element.type}.`)
  }

  if (
    element.type === DB.ElementType.SC ||
    element.type === DB.ElementType.MC ||
    element.type === DB.ElementType.KPRIM
  ) {
    const options = element.options as {
      choices?: { ix: number; correct?: boolean }[]
    }
    const solution =
      options.choices?.reduce<number[]>((acc, choice) => {
        if (choice.correct) return [...acc, choice.ix]
        return acc
      }, []) ?? []
    const choicesResponse = response.choicesResponse ?? []
    const score =
      element.type === DB.ElementType.SC
        ? gradeQuestionSC({
            responseCount: options.choices?.length ?? choicesResponse.length,
            response: choicesResponse,
            solution,
          })
        : element.type === DB.ElementType.KPRIM
          ? gradeQuestionKPRIM({
              responseCount: options.choices?.length ?? choicesResponse.length,
              response: choicesResponse,
              solution,
            })
          : gradeQuestionMC({
              responseCount: options.choices?.length ?? choicesResponse.length,
              response: choicesResponse,
              solution,
            })

    return (score ?? 0) >= 1
  }

  if (element.type === DB.ElementType.FREE_TEXT) {
    const options = element.options as { solutions?: string[] | null }
    const score = gradeQuestionFreeText({
      response: response.freeTextResponse ?? '',
      solutions: options.solutions,
    })

    return (score ?? 0) >= 1
  }

  throw new Error('Unsupported adaptive element type.')
}

function isSupportedAdaptiveElement(
  adaptiveElement: DB.AdaptiveAssessmentElement & {
    element?: DB.Element | null
  }
) {
  return isSupportedAdaptiveElementType(adaptiveElement.element?.type)
}

function isEffectivelyEnabledAdaptiveElement(
  adaptiveElement: DB.AdaptiveAssessmentElement & {
    element?: DB.Element | null
    competence?: DB.AdaptiveAssessmentCompetence | null
    subCompetence?: DB.AdaptiveAssessmentSubCompetence | null
  }
) {
  return (
    adaptiveElement.enabled &&
    adaptiveElement.competence?.enabled !== false &&
    adaptiveElement.subCompetence?.enabled !== false &&
    isSupportedAdaptiveElement(adaptiveElement)
  )
}

function isSupportedAdaptiveElementType(type?: DB.ElementType | null) {
  return type != null && SUPPORTED_ADAPTIVE_ELEMENT_TYPES.has(type)
}

function adaptiveItemType(type?: DB.ElementType | null): AdaptiveItem['type'] {
  if (type === DB.ElementType.SC) return 'SC'
  if (type === DB.ElementType.MC) return 'MC'
  if (type === DB.ElementType.KPRIM) return 'KPRIM'
  if (type === DB.ElementType.FREE_TEXT) return 'FREE_TEXT'
  return undefined
}

function elapsedSince(date: Date) {
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 1000))
}
