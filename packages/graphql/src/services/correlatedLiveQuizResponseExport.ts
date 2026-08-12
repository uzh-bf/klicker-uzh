import { createHmac } from 'node:crypto'
import {
  CorrelatedLiveQuizExportSizeError,
  createCorrelatedLiveQuizResponseCsv,
  DEFAULT_CORRELATED_LIVE_QUIZ_EXPORT_MAX_BYTES,
  getCorrelatedLiveQuizResponseCsvHeaderByteLength,
} from '@klicker-uzh/export/correlated-live-quiz-responses'
import * as DB from '@klicker-uzh/prisma/client'
import { buildLiveQuizResponseIdentityKey } from '@klicker-uzh/util'
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
            | 'exportSalt'
            | 'isAssessmentEnabled'
            | 'responseCollectionMode'
            | 'status'
          >[]
        >`
          SELECT
            "displayName",
            "exportSalt",
            "isAssessmentEnabled",
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
            DB.LiveQuizResponseCollectionMode.CORRELATED_EXPORT ||
          !liveQuiz.exportSalt
        ) {
          throw new GraphQLError('LIVE_QUIZ_CORRELATED_EXPORT_UNAVAILABLE', {
            extensions: { code: 'BAD_USER_INPUT' },
          })
        }

        const pendingResponseCount = await prisma.liveQuizPendingResponse.count(
          {
            where: { liveQuizId: id, settledAt: null },
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
          }[]
        >`
          SELECT
            COALESCE(SUM(octet_length(response."response"::text)), 0)::bigint AS "responseBytes",
            COUNT(*)::bigint AS "responseCount",
            (
              COUNT(DISTINCT response."participantId") +
              COUNT(DISTINCT response."respondentId")
            )::bigint AS "respondentCount"
          FROM "public"."LiveQuizResponse" AS response
          INNER JOIN "public"."ElementInstance" AS instance
            ON instance."id" = response."instanceId"
          INNER JOIN "public"."ElementBlock" AS block
            ON block."id" = instance."elementBlockId"
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
            participantId: true,
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
          const identityKey = response.participantId
            ? buildLiveQuizResponseIdentityKey({
                kind: 'participant',
                id: response.participantId,
              })
            : response.respondentId
              ? buildLiveQuizResponseIdentityKey({
                  kind: 'anonymous',
                  id: response.respondentId,
                })
              : null
          if (!identityKey) {
            throw new GraphQLError(
              'LIVE_QUIZ_CORRELATED_EXPORT_INVALID_RESPONSE',
              {
                extensions: { code: 'INTERNAL_SERVER_ERROR' },
              }
            )
          }

          return {
            identityKey,
            instanceId: response.instanceId,
            blockExecution: response.elementBlockExecution,
            response: response.response,
            correctness: response.correctness,
            basePoints: response.basePoints,
            correctnessPoints: response.correctnessPoints,
            bonusPoints: response.bonusPoints,
          }
        })
        const identities = [
          ...new Set(mappedResponses.map((response) => response.identityKey)),
        ].map((identityKey) => ({
          identityKey,
          identityHash: createHmac('sha256', liveQuiz.exportSalt!)
            .update(identityKey)
            .digest('hex'),
        }))
        const identityHashByIdentityKey = new Map(
          identities.map(({ identityKey, identityHash }) => [
            identityKey,
            identityHash,
          ])
        )

        const existingLabels =
          await prisma.liveQuizResponseExportLabel.findMany({
            where: { liveQuizId: id },
            select: { identityHash: true, label: true },
          })
        const labelByIdentityHash = new Map(
          existingLabels.map(({ identityHash, label }) => [identityHash, label])
        )
        let nextLabel = existingLabels.reduce(
          (maximum, { label }) => Math.max(maximum, label),
          0
        )
        const newLabels = identities
          .filter(({ identityHash }) => !labelByIdentityHash.has(identityHash))
          .sort((left, right) =>
            left.identityHash.localeCompare(right.identityHash)
          )
          .map(({ identityHash }) => ({
            liveQuizId: id,
            identityHash,
            label: ++nextLabel,
          }))

        if (newLabels.length > 0) {
          await prisma.liveQuizResponseExportLabel.createMany({
            data: newLabels,
          })
          for (const { identityHash, label } of newLabels) {
            labelByIdentityHash.set(identityHash, label)
          }
        }

        return {
          displayName: liveQuiz.displayName,
          questions,
          responses: mappedResponses.map((response) => {
            const identityHash = identityHashByIdentityKey.get(
              response.identityKey
            )!
            const { identityKey: _, ...exportResponse } = response

            return {
              ...exportResponse,
              respondentLabel: labelByIdentityHash.get(identityHash)!,
            }
          }),
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
