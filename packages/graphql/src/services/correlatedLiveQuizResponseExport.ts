import {
  CorrelatedLiveQuizExportSizeError,
  createCorrelatedLiveQuizResponseCsv,
} from '@klicker-uzh/export/correlated-live-quiz-responses'
import * as DB from '@klicker-uzh/prisma/client'
import { buildLiveQuizResponseIdentityKey } from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import { createHmac } from 'node:crypto'
import type { ContextWithUser } from '../lib/context.js'

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
              orderBy: { order: 'asc' },
              select: { id: true, order: true },
            },
          },
        })
        const responses = await prisma.liveQuizResponse.findMany({
          where: {
            correctionOnly: false,
            instance: { elementBlock: { liveQuizId: id } },
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
          blocks,
          displayName: liveQuiz.displayName,
          responses: mappedResponses.map((response) => {
            const identityHash = identityHashByIdentityKey.get(
              response.identityKey
            )!

            return {
              ...response,
              respondentLabel: labelByIdentityHash.get(identityHash)!,
            }
          }),
        }
      },
      { timeout: 60000 }
    )

    const result = createCorrelatedLiveQuizResponseCsv({
      quizName: exportData.displayName,
      questions: exportData.blocks.flatMap((block) =>
        block.elements.map((instance) => ({
          blockOrder: block.order,
          questionOrder: instance.order,
          instanceId: instance.id,
          executions: Array.from(
            { length: block.execution + 1 },
            (_, index) => index
          ),
        }))
      ),
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
