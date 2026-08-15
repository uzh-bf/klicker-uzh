import {
  CorrelatedLiveQuizExportSizeError,
  createCorrelatedLiveQuizResponseCsv,
  DEFAULT_CORRELATED_LIVE_QUIZ_EXPORT_MAX_BYTES,
  getCorrelatedLiveQuizResponseCsvHeaderByteLength,
} from '@klicker-uzh/export/correlated-live-quiz-responses'
import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'

const MAX_CORRELATED_EXPORT_RESPONSE_COUNT = 25_000n
const MAX_CORRELATED_EXPORT_RESPONSE_BYTES = BigInt(
  DEFAULT_CORRELATED_LIVE_QUIZ_EXPORT_MAX_BYTES
)
const MAX_CORRELATED_EXPORT_MATRIX_CELLS = 1_000_000n
const MIN_CSV_BYTES_PER_COLUMN_AND_RESPONDENT = 3n
const MIN_CSV_BYTES_PER_RESPONDENT_ROW = 2n
// These response-side values intentionally overestimate CSV expansion. The
// exact builder still enforces the final limit, but this preflight must reject
// an oversized combined output before loading response rows into memory.
const MAX_CSV_BYTES_PER_COLUMN_AND_RESPONDENT = 64n
const MAX_CSV_BYTES_PER_RESPONDENT_LABEL = 32n
const MAX_CSV_BYTES_PER_RESPONSE_MULTIPLIER = 8n
const MAX_CSV_BYTES_PER_RESPONSE_OVERHEAD = 64n

export async function getCorrelatedLiveQuizResponseExport(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  try {
    const exportData = await ctx.prisma.$transaction(
      async (prisma) => {
        const [liveQuiz] = await prisma.$queryRaw<
          Pick<
            DB.LiveQuiz,
            | 'displayName'
            | 'isAssessmentEnabled'
            | 'publicationGeneration'
            | 'responseCollectionMode'
            | 'status'
          >[]
        >`
          SELECT
            "displayName",
            "isAssessmentEnabled",
            "publicationGeneration",
            "responseCollectionMode"::text AS "responseCollectionMode",
            "status"::text AS "status"
          FROM "public"."LiveQuiz"
          WHERE "id" = ${id}::uuid AND "isDeleted" = false
          FOR UPDATE
        `

        if (!liveQuiz) {
          throw new GraphQLError('LIVE_QUIZ_NOT_FOUND', {
            extensions: { code: 'NOT_FOUND' },
          })
        }
        if (liveQuiz.status !== DB.PublicationStatus.ENDED) {
          throw new GraphQLError('LIVE_QUIZ_CORRELATED_EXPORT_NOT_READY', {
            extensions: { code: 'BAD_USER_INPUT' },
          })
        }
        if (
          liveQuiz.isAssessmentEnabled ||
          liveQuiz.responseCollectionMode !==
            DB.LiveQuizResponseCollectionMode.CORRELATED_EXPORT
        ) {
          throw new GraphQLError('LIVE_QUIZ_CORRELATED_EXPORT_UNAVAILABLE', {
            extensions: { code: 'BAD_USER_INPUT' },
          })
        }

        const respondents = await prisma.liveQuizRespondent.findMany({
          where: {
            liveQuizId: id,
            publicationGeneration: liveQuiz.publicationGeneration,
          },
          select: { id: true, exportLabel: true, finalizedAt: true },
        })
        if (
          respondents.some(
            (respondent) =>
              respondent.exportLabel === null || respondent.finalizedAt === null
          )
        ) {
          throw new GraphQLError('LIVE_QUIZ_CORRELATED_EXPORT_NOT_READY', {
            extensions: { code: 'BAD_USER_INPUT' },
          })
        }
        const respondentLabelById = new Map(
          respondents.map((respondent) => [
            respondent.id,
            respondent.exportLabel!,
          ])
        )

        const activeBindingCount = await prisma.liveQuizRespondentBinding.count(
          {
            where: {
              liveQuizId: id,
              publicationGeneration: liveQuiz.publicationGeneration,
            },
          }
        )
        if (activeBindingCount > 0) {
          throw new GraphQLError('LIVE_QUIZ_CORRELATED_EXPORT_NOT_READY', {
            extensions: { code: 'BAD_USER_INPUT' },
          })
        }

        const pendingResponseCount = await prisma.liveQuizPendingResponse.count(
          {
            where: {
              liveQuizId: id,
              publicationGeneration: liveQuiz.publicationGeneration,
              OR: [
                { settledAt: null },
                { eventPayload: { not: null } },
                { nextDeliveryAt: { not: null } },
              ],
            },
          }
        )
        if (pendingResponseCount > 0) {
          throw new GraphQLError('LIVE_QUIZ_CORRELATED_EXPORT_NOT_READY', {
            extensions: { code: 'BAD_USER_INPUT' },
          })
        }

        const blocks = await prisma.elementBlock.findMany({
          where: {
            liveQuizId: id,
            status: {
              in: [
                DB.ElementBlockStatus.EXECUTED,
                DB.ElementBlockStatus.ACTIVE,
              ],
            },
          },
          orderBy: { order: 'asc' },
          select: {
            execution: true,
            order: true,
            elements: {
              where: {
                elementType: { not: DB.ElementType.FREE_TEXT },
              },
              orderBy: { order: 'asc' },
              select: { id: true, order: true, elementType: true },
            },
          },
        })
        const questions = blocks.flatMap((block) =>
          block.elements
            .filter(
              (instance) => instance.elementType !== DB.ElementType.FREE_TEXT
            )
            .map((instance) => ({
              blockOrder: block.order,
              questionOrder: instance.order,
              instanceId: instance.id,
              executions: Array.from(
                { length: block.execution + 1 },
                (_, index) => index
              ),
            }))
        )
        const exportedColumnCount = questions.reduce(
          (count, question) => count + BigInt(question.executions.length),
          0n
        )
        const headerBytes = BigInt(
          getCorrelatedLiveQuizResponseCsvHeaderByteLength({ questions })
        )
        const [responseSize] = await prisma.$queryRaw<
          {
            responseBytes: bigint
            responseCount: bigint
            respondentCount: bigint
            invalidResponseCount: bigint
          }[]
        >`
          SELECT
            COALESCE(
              SUM(octet_length(response."response"::text)) FILTER (
                WHERE response."participantId" IS NULL
                  AND response."respondentId" IS NOT NULL
                  AND respondent."id" IS NOT NULL
              ),
              0
            )::bigint AS "responseBytes",
            COUNT(*) FILTER (
              WHERE response."participantId" IS NULL
                AND response."respondentId" IS NOT NULL
                AND respondent."id" IS NOT NULL
            )::bigint AS "responseCount",
            COUNT(DISTINCT response."respondentId") FILTER (
              WHERE response."participantId" IS NULL
                AND response."respondentId" IS NOT NULL
                AND respondent."id" IS NOT NULL
            )::bigint AS "respondentCount",
            COUNT(*) FILTER (
              WHERE response."participantId" IS NOT NULL
                OR response."respondentId" IS NULL
                OR respondent."id" IS NULL
            )::bigint AS "invalidResponseCount"
          FROM "public"."LiveQuizResponse" AS response
          INNER JOIN "public"."ElementInstance" AS instance
            ON instance."id" = response."instanceId"
          INNER JOIN "public"."ElementBlock" AS block
            ON block."id" = instance."elementBlockId"
          LEFT JOIN "public"."LiveQuizRespondent" AS respondent
            ON respondent."id" = response."respondentId"
            AND respondent."liveQuizId" = ${id}::uuid
            AND respondent."publicationGeneration" = ${liveQuiz.publicationGeneration}
            AND respondent."exportLabel" IS NOT NULL
            AND respondent."finalizedAt" IS NOT NULL
          WHERE
            block."liveQuizId" = ${id}::uuid
            AND response."correctionOnly" = false
            AND instance."elementType" <> 'FREE_TEXT'
        `
        const matrixCellCount =
          (responseSize?.respondentCount ?? 0n) * exportedColumnCount
        const minimumCsvBytes =
          (responseSize?.respondentCount ?? 0n) *
          (exportedColumnCount * MIN_CSV_BYTES_PER_COLUMN_AND_RESPONDENT +
            MIN_CSV_BYTES_PER_RESPONDENT_ROW)
        const maximumCsvBytes = responseSize
          ? headerBytes +
            responseSize.respondentCount *
              (MAX_CSV_BYTES_PER_RESPONDENT_LABEL +
                MIN_CSV_BYTES_PER_RESPONDENT_ROW) +
            responseSize.respondentCount *
              exportedColumnCount *
              MAX_CSV_BYTES_PER_COLUMN_AND_RESPONDENT +
            responseSize.responseBytes * MAX_CSV_BYTES_PER_RESPONSE_MULTIPLIER +
            responseSize.responseCount * MAX_CSV_BYTES_PER_RESPONSE_OVERHEAD
          : 0n
        if (responseSize && responseSize.invalidResponseCount > 0n) {
          throw new GraphQLError(
            'LIVE_QUIZ_CORRELATED_EXPORT_INVALID_RESPONSE',
            { extensions: { code: 'INTERNAL_SERVER_ERROR' } }
          )
        }
        if (
          !responseSize ||
          responseSize.responseCount > MAX_CORRELATED_EXPORT_RESPONSE_COUNT ||
          responseSize.responseBytes > MAX_CORRELATED_EXPORT_RESPONSE_BYTES ||
          headerBytes > MAX_CORRELATED_EXPORT_RESPONSE_BYTES ||
          matrixCellCount > MAX_CORRELATED_EXPORT_MATRIX_CELLS ||
          minimumCsvBytes > MAX_CORRELATED_EXPORT_RESPONSE_BYTES ||
          maximumCsvBytes > MAX_CORRELATED_EXPORT_RESPONSE_BYTES
        ) {
          throw new CorrelatedLiveQuizExportSizeError(
            'Correlated live quiz export exceeds the bounded response input size'
          )
        }
        const responses = await prisma.liveQuizResponse.findMany({
          where: {
            correctionOnly: false,
            participantId: null,
            respondentId: { in: respondents.map(({ id }) => id) },
            instance: {
              elementBlock: { liveQuizId: id },
              elementType: { not: DB.ElementType.FREE_TEXT },
            },
          },
          select: {
            basePoints: true,
            bonusPoints: true,
            correctness: true,
            correctnessPoints: true,
            elementBlockExecution: true,
            respondentId: true,
            response: true,
            instanceId: true,
          },
          orderBy: [
            { instance: { elementBlock: { order: 'asc' } } },
            { instance: { order: 'asc' } },
            { elementBlockExecution: 'asc' },
            { id: 'asc' },
          ],
        })
        if (responses.length === 0) {
          throw new GraphQLError('LIVE_QUIZ_CORRELATED_EXPORT_EMPTY', {
            extensions: { code: 'BAD_USER_INPUT' },
          })
        }

        const mappedResponses = responses.map((response) => {
          const respondentLabel = response.respondentId
            ? respondentLabelById.get(response.respondentId)
            : undefined
          if (respondentLabel === undefined) {
            throw new GraphQLError(
              'LIVE_QUIZ_CORRELATED_EXPORT_INVALID_RESPONSE',
              {
                extensions: { code: 'INTERNAL_SERVER_ERROR' },
              }
            )
          }

          return {
            respondentLabel,
            instanceId: response.instanceId,
            blockExecution: response.elementBlockExecution,
            response: response.response,
            correctness: response.correctness,
            basePoints: response.basePoints,
            correctnessPoints: response.correctnessPoints,
            bonusPoints: response.bonusPoints,
          }
        })

        return {
          displayName: liveQuiz.displayName,
          questions,
          responses: mappedResponses,
        }
      },
      { timeout: 60000 }
    )

    const result = createCorrelatedLiveQuizResponseCsv({
      quizName: exportData.displayName,
      questions: exportData.questions,
      responses: exportData.responses,
    })

    return {
      filename: result.filename,
      content: result.csv,
      warning: result.warning,
    }
  } catch (error) {
    if (error instanceof CorrelatedLiveQuizExportSizeError) {
      throw new GraphQLError('LIVE_QUIZ_CORRELATED_EXPORT_TOO_LARGE', {
        extensions: { code: 'BAD_USER_INPUT' },
      })
    }
    throw error
  }
}
