import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
import { PARTICIPANT_DATA_USE_DISCLOSURE_VERSION } from '../lib/learningAnalytics.js'
import { buildResearchExportArtifact } from '../lib/researchExportArtifact.js'
import {
  MAX_RESEARCH_EXPORT_RECORDS,
  validateResearchExportRequest,
} from '../lib/researchExportRequest.js'
import { checkAccess } from './sharing.js'

function exportError(code: string) {
  return new GraphQLError(code, { extensions: { code } })
}

export async function downloadResearchExport(
  input: unknown,
  ctx: ContextWithUser,
  signal?: AbortSignal
) {
  const checkCancellation = () => {
    if (signal?.aborted) throw exportError('DATA_EXPORT_CANCELLED')
  }
  checkCancellation()
  if (
    (ctx.user.role !== DB.UserRole.USER &&
      ctx.user.role !== DB.UserRole.ADMIN) ||
    (ctx.user.scope !== DB.UserLoginScope.ACCOUNT_OWNER &&
      ctx.user.scope !== DB.UserLoginScope.FULL_ACCESS)
  ) {
    throw exportError('DATA_EXPORT_FORBIDDEN')
  }
  const validation = validateResearchExportRequest(input)
  if (!validation.success) throw exportError('DATA_EXPORT_INVALID_REQUEST')
  const request = validation.data
  if (
    request.selectedClasses.some(
      (value) =>
        value !== 'LIVE_QUIZ_RESPONSES' &&
        value !== 'ASYNCHRONOUS_RESPONSES' &&
        value !== 'LEARNING_ANALYTICS'
    )
  ) {
    throw exportError('DATA_EXPORT_CLASS_UNAVAILABLE')
  }
  const permission = {
    courseId: request.courseId,
    minimumPermissionLevel: DB.PermissionLevel.ADMIN,
  }
  if (!(await checkAccess([permission], ctx))) {
    throw exportError('DATA_EXPORT_FORBIDDEN')
  }

  const exportId = request.requestId
  try {
    await ctx.prisma.researchExportReceipt.create({
      data: {
        id: exportId,
        requesterId: ctx.user.sub,
        courseId: request.courseId,
        projectTitle: request.projectTitle,
        responsiblePerson: request.responsiblePerson,
        contactEmail: request.contactEmail,
        purpose: request.purpose,
        deletionDate: new Date(`${request.deletionDate}T00:00:00.000Z`),
        reference: request.reference,
        selectedClasses: request.selectedClasses,
        disclosureVersion: request.disclosureVersion,
      },
    })
  } catch (error) {
    if (
      error instanceof DB.Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw exportError('DATA_EXPORT_REQUEST_ALREADY_USED')
    }
    throw error
  }

  try {
    return await ctx.prisma.$transaction(
      async (prisma) => {
        checkCancellation()
        await prisma.$executeRaw`SET LOCAL lock_timeout = '5s'`
        // Permission revocation and consent withdrawal serialize with release.
        await prisma.$queryRaw`
          SELECT "id" FROM "DerivedPermission"
          WHERE "courseId" = ${request.courseId}::uuid
            AND "userId" = ${ctx.user.sub}::uuid
          FOR SHARE
        `
        if (!(await checkAccess([permission], { ...ctx, prisma }))) {
          throw exportError('DATA_EXPORT_FORBIDDEN')
        }

        const cohortFilters: DB.Prisma.ParticipantWhereInput[] = []
        if (request.selectedClasses.includes('LIVE_QUIZ_RESPONSES')) {
          cohortFilters.push({
            liveQuizResponses: {
              some: {
                instance: {
                  elementBlock: { liveQuiz: { courseId: request.courseId } },
                },
              },
            },
          })
        }
        if (request.selectedClasses.includes('ASYNCHRONOUS_RESPONSES')) {
          cohortFilters.push({
            detailQuestionResponses: {
              some: {
                OR: [
                  { practiceQuiz: { courseId: request.courseId } },
                  { microLearning: { courseId: request.courseId } },
                ],
              },
            },
          })
        }
        if (request.selectedClasses.includes('LEARNING_ANALYTICS')) {
          cohortFilters.push({
            analyticsResearchContributions: {
              some: { courseId: request.courseId },
            },
          })
        }
        // Include refusals so a grant during preparation cannot go unnoticed.
        const cohort = await prisma.participant.findMany({
          where: { OR: cohortFilters },
          select: {
            id: true,
            researchConsent: true,
            researchConsentChoiceAt: true,
            researchConsentDisclosureVersion: true,
          },
          orderBy: { id: 'asc' },
        })
        const participant = {
          researchConsent: true,
          researchConsentChoiceAt: { not: null },
          researchConsentDisclosureVersion:
            PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
        }
        const liveRows = request.selectedClasses.includes('LIVE_QUIZ_RESPONSES')
          ? await prisma.liveQuizResponse.findMany({
              where: {
                participant,
                instance: {
                  elementBlock: { liveQuiz: { courseId: request.courseId } },
                },
              },
              take: MAX_RESEARCH_EXPORT_RECORDS + 1,
              orderBy: { id: 'asc' },
              select: {
                participantId: true,
                participant: { select: { researchConsentChoiceAt: true } },
                response: true,
                correctness: true,
                basePoints: true,
                correctnessPoints: true,
                bonusPoints: true,
                submittedAt: true,
                instance: {
                  select: {
                    id: true,
                    elementBlock: { select: { liveQuizId: true } },
                  },
                },
              },
            })
          : []
        const asyncRows = request.selectedClasses.includes(
          'ASYNCHRONOUS_RESPONSES'
        )
          ? await prisma.questionResponseDetail.findMany({
              where: {
                participant,
                OR: [
                  { practiceQuiz: { courseId: request.courseId } },
                  { microLearning: { courseId: request.courseId } },
                ],
              },
              take: MAX_RESEARCH_EXPORT_RECORDS + 1 - liveRows.length,
              orderBy: { id: 'asc' },
              select: {
                participantId: true,
                participant: { select: { researchConsentChoiceAt: true } },
                elementInstanceId: true,
                practiceQuizId: true,
                microLearningId: true,
                response: true,
                score: true,
                pointsAwarded: true,
                timeSpent: true,
                createdAt: true,
              },
            })
          : []
        const learningAnalyticsRows = request.selectedClasses.includes(
          'LEARNING_ANALYTICS'
        )
          ? await prisma.participantAnalyticsResearchContribution.findMany({
              where: {
                courseId: request.courseId,
                participant,
                family: { in: Object.values(DB.AnalyticsResearchFamily) },
              },
              take:
                MAX_RESEARCH_EXPORT_RECORDS +
                1 -
                liveRows.length -
                asyncRows.length,
              orderBy: [
                { participantId: 'asc' },
                { family: 'asc' },
                { scopeKey: 'asc' },
              ],
              select: {
                participantId: true,
                participant: { select: { researchConsentChoiceAt: true } },
                family: true,
                scopeKey: true,
                scope: true,
                contributions: true,
                generation: true,
                disclosureVersion: true,
                choiceAt: true,
                algorithmVersion: true,
                computedAt: true,
                publishedAt: true,
              },
            })
          : []
        if (liveRows.length + asyncRows.length > MAX_RESEARCH_EXPORT_RECORDS) {
          throw exportError('DATA_EXPORT_TOO_LARGE')
        }
        if (
          liveRows.length + asyncRows.length + learningAnalyticsRows.length >
          MAX_RESEARCH_EXPORT_RECORDS
        ) {
          throw exportError('DATA_EXPORT_TOO_LARGE')
        }

        const ids = cohort.map((row) => row.id)
        const lockedCohort = ids.length
          ? await prisma.$queryRaw<typeof cohort>(DB.Prisma.sql`
              SELECT "id", "researchConsent", "researchConsentChoiceAt",
                     "researchConsentDisclosureVersion" FROM "Participant"
              WHERE "id" = ANY(${ids}::uuid[])
              ORDER BY "id" FOR SHARE
            `)
          : []
        // A changed cohort requires a new request; never release stale selections.
        if (
          lockedCohort.length !== cohort.length ||
          lockedCohort.some((row, index) => {
            const previous = cohort[index]!
            return (
              row.id !== previous.id ||
              row.researchConsent !== previous.researchConsent ||
              row.researchConsentChoiceAt?.getTime() !==
                previous.researchConsentChoiceAt?.getTime() ||
              row.researchConsentDisclosureVersion !==
                previous.researchConsentDisclosureVersion
            )
          })
        )
          throw exportError('DATA_EXPORT_ELIGIBILITY_CHANGED')
        const choices = new Map(
          lockedCohort
            .filter(
              (row) =>
                row.researchConsent &&
                row.researchConsentChoiceAt !== null &&
                row.researchConsentDisclosureVersion ===
                  PARTICIPANT_DATA_USE_DISCLOSURE_VERSION
            )
            .map((row) => [row.id, row.researchConsentChoiceAt!.getTime()])
        )
        if (
          [...liveRows, ...asyncRows, ...learningAnalyticsRows].some(
            (row) =>
              choices.get(row.participantId) !==
              row.participant.researchConsentChoiceAt?.getTime()
          )
        )
          throw exportError('DATA_EXPORT_ELIGIBILITY_CHANGED')
        const clock = await prisma.$queryRaw<
          Array<{ now: Date }>
        >`SELECT clock_timestamp() AS "now"`
        const now = clock[0]?.now
        if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
          throw exportError('DATA_EXPORT_CLOCK_FAILURE')
        }
        checkCancellation()
        const artifact = buildResearchExportArtifact({
          exportId,
          courseId: request.courseId,
          createdAt: now,
          selectedClasses: request.selectedClasses,
          liveQuizResponses: liveRows.map((row) => ({
            participantId: row.participantId,
            activityId: row.instance.elementBlock!.liveQuizId!,
            elementInstanceId: row.instance.id,
            response: row.response,
            correctness: row.correctness,
            points: row.basePoints + row.correctnessPoints + row.bonusPoints,
            submittedAt: row.submittedAt,
          })),
          asynchronousResponses: asyncRows.map((row) => ({
            participantId: row.participantId,
            activityId: (row.practiceQuizId ?? row.microLearningId)!,
            elementInstanceId: row.elementInstanceId,
            response: row.response,
            score: row.score,
            pointsAwarded: row.pointsAwarded,
            timeSpent: row.timeSpent,
            submittedAt: row.createdAt,
          })),
          learningAnalytics: learningAnalyticsRows.map((row) => ({
            participantId: row.participantId,
            family: row.family,
            scopeKey: row.scopeKey,
            scope: row.scope,
            contributions: row.contributions,
            generation: Number(row.generation),
            disclosureVersion: row.disclosureVersion,
            choiceAt: row.choiceAt,
            algorithmVersion: row.algorithmVersion,
            computedAt: row.computedAt,
            publishedAt: row.publishedAt,
          })),
          courseParticipantCount: await prisma.participation.count({
            where: { courseId: request.courseId },
          }),
        })
        await prisma.researchExportReceipt.update({
          where: { id: exportId },
          data: {
            status: DB.DataExportStatus.RELEASED,
            sha256: artifact.sha256,
            byteCount: artifact.byteCount,
            recordCount: artifact.recordCount,
            releasedAt: now,
          },
        })
        checkCancellation()
        return { ...artifact, exportId }
      },
      { timeout: 60_000, maxWait: 10_000 }
    )
  } catch (error) {
    await ctx.prisma.researchExportReceipt.update({
      where: { id: exportId },
      data: {
        status: DB.DataExportStatus.FAILED,
        failureCode:
          error instanceof GraphQLError
            ? String(error.extensions.code)
            : 'DATA_EXPORT_FAILED',
      },
    })
    throw error
  }
}
