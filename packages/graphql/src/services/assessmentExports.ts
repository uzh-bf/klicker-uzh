import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import { buildAssessmentExportArtifact } from '../lib/assessmentExportArtifact.js'
import { assessmentExportRequestSchema } from '../lib/assessmentExportRequest.js'
import type { ContextWithUser } from '../lib/context.js'
import {
  getAssessmentResultsCourse,
  getAssessmentResultsLiveQuiz,
} from './courses.js'
import { checkAccess } from './sharing.js'

function exportError(code: string) {
  return new GraphQLError(code, { extensions: { code } })
}

export async function downloadAssessmentExport(
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
  const validation = assessmentExportRequestSchema.safeParse(input)
  if (!validation.success) throw exportError('DATA_EXPORT_INVALID_REQUEST')
  const request = validation.data
  const permission = {
    courseId: request.courseId,
    minimumPermissionLevel: DB.PermissionLevel.ADMIN,
  }
  if (!(await checkAccess([permission], ctx))) {
    throw exportError('DATA_EXPORT_FORBIDDEN')
  }
  try {
    await ctx.prisma.assessmentExportReceipt.create({
      data: {
        id: request.requestId,
        requesterId: ctx.user.sub,
        courseId: request.courseId,
        liveQuizId: request.scope === 'LIVE_QUIZ' ? request.liveQuizId : null,
        locale: request.locale,
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
        // Hold the permission through the durable release receipt.
        await prisma.$queryRaw`
          SELECT "id" FROM "DerivedPermission"
          WHERE "courseId" = ${request.courseId}::uuid
            AND "userId" = ${ctx.user.sub}::uuid
          FOR SHARE
        `
        const transactionContext = { ...ctx, prisma }
        if (!(await checkAccess([permission], transactionContext))) {
          throw exportError('DATA_EXPORT_FORBIDDEN')
        }
        if (request.scope === 'LIVE_QUIZ') {
          const quizzes = await prisma.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "LiveQuiz"
            WHERE "id" = ${request.liveQuizId}::uuid
              AND "courseId" = ${request.courseId}::uuid
              AND "isAssessmentEnabled" = true
            FOR SHARE
          `
          if (quizzes.length !== 1) throw exportError('DATA_EXPORT_FORBIDDEN')
        }
        const results =
          request.scope === 'COURSE'
            ? await getAssessmentResultsCourse(request, transactionContext)
            : await getAssessmentResultsLiveQuiz(request, transactionContext)
        if (!results) throw exportError('DATA_EXPORT_FORBIDDEN')
        if (results.studentResults.length > 10_000) {
          throw exportError('DATA_EXPORT_TOO_LARGE')
        }
        checkCancellation()
        const artifact = buildAssessmentExportArtifact({
          rows: results.studentResults,
          labels:
            request.locale === 'de'
              ? {
                  participantEmail: 'Studierende (E-Mail)',
                  assessmentGivenName: 'Vorname der studierenden Person',
                  assessmentSurname: 'Nachname der studierenden Person',
                  assessmentMatriculationNumber:
                    'Matrikelnummer der studierenden Person',
                  basePoints: 'Basispunkte',
                  correctnessPoints: 'Korrektheitspunkte',
                  bonusPoints: 'Bonuspunkte',
                  totalPoints: 'Total',
                }
              : {
                  participantEmail: 'Student (email)',
                  assessmentGivenName: 'Student given name',
                  assessmentSurname: 'Student surname',
                  assessmentMatriculationNumber: 'Student matriculation number',
                  basePoints: 'Base Points',
                  correctnessPoints: 'Correctness Points',
                  bonusPoints: 'Bonus Points',
                  totalPoints: 'Total',
                },
        })
        if (artifact.byteCount > 10 * 1024 * 1024) {
          throw exportError('DATA_EXPORT_TOO_LARGE')
        }
        const clock = await prisma.$queryRaw<
          Array<{ now: Date }>
        >`SELECT clock_timestamp() AS "now"`
        const now = clock[0]?.now
        if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
          throw exportError('DATA_EXPORT_CLOCK_FAILURE')
        }
        await prisma.assessmentExportReceipt.update({
          where: { id: request.requestId },
          data: {
            status: DB.DataExportStatus.RELEASED,
            sha256: artifact.sha256,
            byteCount: artifact.byteCount,
            recordCount: artifact.recordCount,
            releasedAt: now,
          },
        })
        checkCancellation()
        return { ...artifact, exportId: request.requestId }
      },
      { timeout: 60_000, maxWait: 10_000 }
    )
  } catch (error) {
    await ctx.prisma.assessmentExportReceipt.update({
      where: { id: request.requestId },
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
