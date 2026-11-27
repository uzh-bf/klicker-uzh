import * as DB from '@klicker-uzh/prisma/client'
import type { ElementOptionsChoices } from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
import {
  createQuestionPoolLabelBackend,
  getQuestionPoolLabelDifficultyBand,
  type QuestionPoolLabelAiEstimate,
  type QuestionPoolLabelBackend,
  type QuestionPoolLabelFormat,
  type QuestionPoolLabelItem,
} from './questionPoolLabels.js'
import { checkAccess } from './sharing.js'

export const QUESTION_POOL_ELEMENT_NOT_FOUND_CODE =
  'QUESTION_POOL_ELEMENT_NOT_FOUND'
export const QUESTION_POOL_ELEMENT_TYPE_UNSUPPORTED_CODE =
  'QUESTION_POOL_ELEMENT_TYPE_UNSUPPORTED'
export const QUESTION_POOL_ELEMENT_VERSION_MISMATCH_CODE =
  'QUESTION_POOL_ELEMENT_VERSION_MISMATCH'

export interface QuestionPoolObservedLabels {
  fullCreditCount: number
  denominator: number
  rate: number
  band: number
}

export interface QuestionPoolAiLabels {
  rawRate: number
  rawBand: number
  calibratedRate: number | null
  calibratedBand: number | null
  bloom: string
}

export interface QuestionPoolLabelPreview {
  elementVersion: number
  observed: QuestionPoolObservedLabels | null
  ai: QuestionPoolAiLabels | null
}

type QuestionPoolLabelQuestion = QuestionPoolLabelBackend['label']

export interface QuestionPoolLabelPreviewDependencies {
  labelQuestion?: QuestionPoolLabelQuestion
}

interface FirstAttemptCounts {
  denominator: number
  fullCreditCount: number
}

function getQuestionPoolFormat(
  elementType: DB.ElementType
): QuestionPoolLabelFormat | null {
  if (elementType === DB.ElementType.SC) return 'SC'
  if (elementType === DB.ElementType.KPRIM) return 'KPRIM'
  return null
}

function getObservedBand({
  rate,
  format,
}: {
  rate: number
  format: QuestionPoolLabelFormat
}) {
  return getQuestionPoolLabelDifficultyBand(rate, format)
}

function projectQuestionPoolItem({
  content,
  options,
  type,
}: {
  content: string
  options: DB.Element['options']
  type: DB.ElementType
}): QuestionPoolLabelItem | null {
  const format = getQuestionPoolFormat(type)
  if (!format) return null

  const choicesOptions = options as Partial<ElementOptionsChoices>
  if (
    format === 'KPRIM' &&
    choicesOptions?.choices?.some(
      (choice) => typeof choice.correct !== 'boolean'
    )
  )
    return null

  const choices = Array.isArray(choicesOptions.choices)
    ? choicesOptions.choices.map((choice) => ({
        text: choice.value,
        key: choice.correct === true,
      }))
    : []

  return {
    format,
    stem: content,
    choices,
    graded: choicesOptions.hasSampleSolution === true,
  }
}

function isValidAiLabels(value: unknown): value is QuestionPoolLabelAiEstimate {
  if (!value || typeof value !== 'object') return false

  const estimate = value as Partial<QuestionPoolLabelAiEstimate>
  const rateIsValid = (rate: unknown): rate is number =>
    typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 && rate <= 1
  const bandIsValid = (band: unknown): band is number =>
    typeof band === 'number' && Number.isInteger(band) && band >= 1 && band <= 5
  const calibratedRateIsValid =
    estimate.calibratedRate === null || rateIsValid(estimate.calibratedRate)
  const calibratedBandIsValid =
    estimate.calibratedBand === null || bandIsValid(estimate.calibratedBand)

  return (
    rateIsValid(estimate.rawRate) &&
    bandIsValid(estimate.rawBand) &&
    calibratedRateIsValid &&
    calibratedBandIsValid &&
    (estimate.calibratedRate === null) === (estimate.calibratedBand === null) &&
    typeof estimate.bloom === 'string' &&
    estimate.bloom.trim().length > 0
  )
}

async function getFirstAttemptCounts({
  courseId,
  elementId,
  elementVersion,
  ctx,
}: {
  courseId: string
  elementId: number
  elementVersion: number
  ctx: ContextWithUser
}): Promise<FirstAttemptCounts> {
  const snapshotId = `${elementId}-v${elementVersion}`
  const [counts] = await ctx.prisma.$queryRaw<FirstAttemptCounts[]>(
    DB.Prisma.sql`
      WITH compatible_instances AS (
        SELECT instance."id"
        FROM "ElementInstance" instance
        LEFT JOIN "ElementStack" stack
          ON stack."id" = instance."elementStackId"
        LEFT JOIN "PracticeQuiz" practice_quiz
          ON practice_quiz."id" = stack."practiceQuizId"
        LEFT JOIN "MicroLearning" micro_learning
          ON micro_learning."id" = stack."microLearningId"
        LEFT JOIN "ElementBlock" block
          ON block."id" = instance."elementBlockId"
        LEFT JOIN "LiveQuiz" live_quiz
          ON live_quiz."id" = block."liveQuizId"
        WHERE instance."elementId" = ${elementId}
          AND instance."elementData" ->> 'id' = ${snapshotId}
          AND COALESCE(
            (instance."elementData" -> 'options' ->> 'hasSampleSolution')::boolean,
            false
          )
          AND (
            (
              practice_quiz."courseId" = ${courseId}::uuid
              AND practice_quiz."isDeleted" = false
            )
            OR (
              micro_learning."courseId" = ${courseId}::uuid
              AND micro_learning."isDeleted" = false
            )
            OR (
              live_quiz."courseId" = ${courseId}::uuid
              AND live_quiz."isDeleted" = false
            )
          )
      ),
      first_attempts AS (
        SELECT
          response."elementInstanceId" AS instance_id,
          response."participantId" AS participant_id,
          response."firstResponseCorrectness" AS correctness
        FROM "QuestionResponse" response
        JOIN compatible_instances instance
          ON instance."id" = response."elementInstanceId"
        WHERE response."courseId" = ${courseId}::uuid
          AND response."trialsCount" > 0

        UNION ALL

        SELECT
          ranked_live_response.instance_id,
          ranked_live_response.participant_id,
          ranked_live_response.correctness
        FROM (
          SELECT
            response."instanceId" AS instance_id,
            response."participantId" AS participant_id,
            response."correctness" AS correctness,
            ROW_NUMBER() OVER (
              PARTITION BY response."instanceId", response."participantId"
              ORDER BY response."submittedAt" ASC, response."id" ASC
            ) AS attempt_number
          FROM "LiveQuizResponse" response
          JOIN compatible_instances instance
            ON instance."id" = response."instanceId"
          WHERE response."correctionOnly" = false
            AND response."response" IS NOT NULL
        ) ranked_live_response
        WHERE ranked_live_response.attempt_number = 1
      )
      SELECT
        CAST(COUNT(*) AS integer) AS denominator,
        CAST(
          COUNT(*) FILTER (
            WHERE first_attempts.correctness::text = 'CORRECT'
          ) AS integer
        ) AS "fullCreditCount"
      FROM first_attempts
    `
  )

  return counts ?? { denominator: 0, fullCreditCount: 0 }
}

export async function requestQuestionPoolLabelPreview(
  {
    elementId,
    courseId,
    elementVersion,
  }: {
    elementId: number
    courseId: string
    elementVersion: number
  },
  ctx: ContextWithUser,
  { labelQuestion }: QuestionPoolLabelPreviewDependencies = {}
): Promise<QuestionPoolLabelPreview> {
  const hasAccess = await checkAccess(
    [
      {
        courseId,
        minimumPermissionLevel: DB.PermissionLevel.ADMIN,
      },
      {
        elementId,
        minimumPermissionLevel: DB.PermissionLevel.READ,
      },
    ],
    ctx
  )

  if (!hasAccess) {
    throw new GraphQLError('FORBIDDEN', {
      extensions: { code: 'FORBIDDEN' },
    })
  }

  const element = await ctx.prisma.element.findUnique({
    where: { id: elementId, isDeleted: false },
    select: {
      id: true,
      version: true,
      type: true,
      content: true,
      options: true,
    },
  })

  if (!element) {
    throw new GraphQLError('Question pool element not found', {
      extensions: { code: QUESTION_POOL_ELEMENT_NOT_FOUND_CODE },
    })
  }

  const format = getQuestionPoolFormat(element.type)
  if (!format) {
    throw new GraphQLError(
      'Question pool label previews support SC and KPRIM elements only',
      {
        extensions: { code: QUESTION_POOL_ELEMENT_TYPE_UNSUPPORTED_CODE },
      }
    )
  }

  if (element.version !== elementVersion) {
    throw new GraphQLError('Question pool element version has changed', {
      extensions: { code: QUESTION_POOL_ELEMENT_VERSION_MISMATCH_CODE },
    })
  }

  const { denominator, fullCreditCount } = await getFirstAttemptCounts({
    courseId,
    elementId,
    elementVersion,
    ctx,
  })
  const rate = denominator > 0 ? fullCreditCount / denominator : null
  const observed =
    rate === null
      ? null
      : {
          fullCreditCount,
          denominator,
          rate,
          band: getObservedBand({ rate, format }),
        }

  let ai: QuestionPoolAiLabels | null = null
  try {
    const item = projectQuestionPoolItem(element)
    if (item) {
      const label = labelQuestion ?? createQuestionPoolLabelBackend().label
      const estimate = await label({
        courseId,
        item,
      })
      ai = isValidAiLabels(estimate) ? estimate : null
    }
  } catch {
    console.warn('Question-pool label estimate provider unavailable')
  }

  return {
    elementVersion: element.version,
    observed,
    ai,
  }
}
