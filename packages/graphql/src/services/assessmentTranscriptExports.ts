import { createHash } from 'node:crypto'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  AssessmentTranscriptExportEvent,
  HatchetHandlerGlobalContext,
  HatchetHandlers,
} from '@klicker-uzh/types'
import { z } from 'zod'
import { assessmentTranscriptExportRequestSchema } from '../lib/assessmentTranscriptExportRequest.js'
import {
  buildConversationExport,
  type ExportRosterEntry,
  toOverviewCsv,
  toStudentTranscript,
} from '../lib/chatTranscriptExport.js'
import { CHAT_TRANSCRIPT_VIEWER_HTML } from '../lib/chatTranscriptViewer.js'
import type { ContextWithUser } from '../lib/context.js'
import { createZipArchive } from '../lib/zipArchive.js'
import { assertAssessmentExportUser, exportError } from './assessmentExports.js'
import { checkAccess } from './sharing.js'

export const ASSESSMENT_TRANSCRIPT_EXPORT_EVENT =
  'process-assessment-transcript-export'

// must match the `retries` of the `process-assessment-transcript-export`
// Hatchet task
export const ASSESSMENT_TRANSCRIPT_EXPORT_MAX_RETRIES = 3

export const ASSESSMENT_TRANSCRIPT_MAX_ARCHIVE_BYTES = 50 * 1024 * 1024
export const ASSESSMENT_TRANSCRIPT_MAX_ROSTER = 10_000
export const ASSESSMENT_TRANSCRIPT_ARTIFACT_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const ASSESSMENT_TRANSCRIPT_STALE_PENDING_MS = 2 * 60 * 60 * 1000

const exportIdSchema = z.string().uuid()

function adminPermission(courseId: string) {
  return { courseId, minimumPermissionLevel: DB.PermissionLevel.ADMIN }
}

// Accepts the request: validates the guards, writes a single-use PENDING
// receipt and hands the build to the general Hatchet worker. A failed hand-off
// marks the receipt FAILED so it is never left pending without a job.
export async function requestAssessmentTranscriptExport(
  input: unknown,
  ctx: ContextWithUser
): Promise<{ exportId: string }> {
  assertAssessmentExportUser(ctx)
  const validation = assessmentTranscriptExportRequestSchema.safeParse(input)
  if (!validation.success) throw exportError('DATA_EXPORT_INVALID_REQUEST')
  const request = validation.data
  if (!(await checkAccess([adminPermission(request.courseId)], ctx))) {
    throw exportError('DATA_EXPORT_FORBIDDEN')
  }
  const chatbot = await ctx.prisma.chatbot.findFirst({
    where: {
      id: request.chatbotId,
      courseId: request.courseId,
      course: { isAssessmentEnabled: true },
    },
    select: { id: true },
  })
  if (!chatbot) throw exportError('DATA_EXPORT_FORBIDDEN')

  try {
    await ctx.prisma.assessmentExportReceipt.create({
      data: {
        id: request.requestId,
        requesterId: ctx.user.sub,
        courseId: request.courseId,
        chatbotId: request.chatbotId,
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

  const event: AssessmentTranscriptExportEvent = {
    exportId: request.requestId,
  }
  try {
    await ctx.hatchet.events.push(ASSESSMENT_TRANSCRIPT_EXPORT_EVENT, event)
  } catch {
    console.error('Failed to schedule an assessment transcript export')
    await ctx.prisma.assessmentExportReceipt.updateMany({
      where: { id: request.requestId, status: DB.DataExportStatus.PENDING },
      data: {
        status: DB.DataExportStatus.FAILED,
        failureCode: 'DATA_EXPORT_UNAVAILABLE',
      },
    })
    throw exportError('DATA_EXPORT_UNAVAILABLE')
  }
  return { exportId: request.requestId }
}

export async function getAssessmentExportChatbots(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  return ctx.prisma.chatbot.findMany({
    where: { courseId, course: { isAssessmentEnabled: true } },
    orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, description: true, avatar: true },
  })
}

export type AssessmentTranscriptDownload =
  | { status: Exclude<DB.DataExportStatus, 'READY'> }
  | { status: 'READY'; exportId: string; body: Buffer }

// Reports the status of an export or, when it is ready, hands out the ZIP
// exactly once. The receipt flips READY -> RELEASED and the archive row is
// deleted in the same transaction, so a concurrent second download finds
// nothing.
export async function downloadAssessmentTranscriptExport(
  exportId: unknown,
  ctx: ContextWithUser
): Promise<AssessmentTranscriptDownload> {
  assertAssessmentExportUser(ctx)
  const id = exportIdSchema.safeParse(exportId)
  if (!id.success) throw exportError('DATA_EXPORT_INVALID_REQUEST')
  const receipt = await ctx.prisma.assessmentExportReceipt.findUnique({
    where: { id: id.data },
    select: {
      id: true,
      requesterId: true,
      courseId: true,
      chatbotId: true,
      status: true,
      artifactExpiresAt: true,
    },
  })
  // A missing, foreign or non-transcript receipt looks like a refusal.
  if (
    !receipt ||
    !receipt.chatbotId ||
    receipt.requesterId !== ctx.user.sub ||
    !(await checkAccess([adminPermission(receipt.courseId)], ctx))
  ) {
    throw exportError('DATA_EXPORT_FORBIDDEN')
  }
  if (receipt.status !== DB.DataExportStatus.READY) {
    return { status: receipt.status as Exclude<DB.DataExportStatus, 'READY'> }
  }
  const now = new Date()
  if (!receipt.artifactExpiresAt || receipt.artifactExpiresAt <= now) {
    return { status: DB.DataExportStatus.EXPIRED }
  }

  const body = await ctx.prisma.$transaction(async (prisma) => {
    const claimed = await prisma.assessmentExportReceipt.updateMany({
      where: {
        id: receipt.id,
        status: DB.DataExportStatus.READY,
        artifactExpiresAt: { gt: now },
      },
      data: { status: DB.DataExportStatus.RELEASED, releasedAt: now },
    })
    if (claimed.count !== 1) return null
    const artifact = await prisma.assessmentExportArtifact.findUnique({
      where: { receiptId: receipt.id },
      select: { content: true },
    })
    // Roll the claim back if the archive is gone.
    if (!artifact) throw exportError('DATA_EXPORT_FAILED')
    await prisma.assessmentExportArtifact.delete({
      where: { receiptId: receipt.id },
    })
    return Buffer.from(artifact.content)
  })
  if (!body) return { status: DB.DataExportStatus.RELEASED }
  return { status: 'READY', exportId: receipt.id, body }
}

class ExportRefused extends Error {
  constructor(readonly failureCode: string) {
    super(failureCode)
  }
}

async function markFailed(
  prisma: HatchetHandlerGlobalContext['prisma'],
  exportId: string,
  failureCode: string
) {
  await prisma.assessmentExportReceipt.updateMany({
    where: { id: exportId, status: DB.DataExportStatus.PENDING },
    data: { status: DB.DataExportStatus.FAILED, failureCode },
  })
}

// Hatchet handler for `process-assessment-transcript-export`. It has no
// request user, so it re-checks the requester's course ADMIN permission, the
// assessment flag and the chatbot's course from the database, then builds the
// archive from one consistent snapshot. Nothing from the conversations is
// logged. A failure is recorded only on the final retry; a refused or
// oversized export fails immediately because retrying cannot change it.
export const handleProcessAssessmentTranscriptExport: HatchetHandlers['handleProcessAssessmentTranscriptExport'] =
  async ({ exportId }, globalCtx, executionCtx) => {
    const { prisma } = globalCtx
    const receipt = await prisma.assessmentExportReceipt.findUnique({
      where: { id: exportId },
    })
    if (
      !receipt ||
      !receipt.chatbotId ||
      receipt.status !== DB.DataExportStatus.PENDING
    ) {
      return false
    }
    const { chatbotId, courseId, requesterId } = receipt

    try {
      const exportedAt = new Date()
      const exported = await prisma.$transaction(
        async (tx) => {
          const permission = await tx.derivedPermission.findFirst({
            where: {
              courseId,
              userId: requesterId,
              permissionLevel: {
                in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
              },
            },
            select: { id: true },
          })
          if (!permission) throw new ExportRefused('DATA_EXPORT_FORBIDDEN')
          const chatbot = await tx.chatbot.findFirst({
            where: { id: chatbotId, courseId },
            select: {
              id: true,
              name: true,
              course: {
                select: { id: true, name: true, isAssessmentEnabled: true },
              },
            },
          })
          if (!chatbot?.course.isAssessmentEnabled) {
            throw new ExportRefused('DATA_EXPORT_FORBIDDEN')
          }

          const [participations, invitations, threads] = await Promise.all([
            tx.participation.findMany({
              where: { courseId },
              select: {
                participantId: true,
                assessmentGivenName: true,
                assessmentSurname: true,
                assessmentMatriculationNumber: true,
                participant: { select: { username: true, email: true } },
              },
            }),
            tx.participantInvitation.findMany({
              where: { courseId },
              select: {
                email: true,
                matriculationNumber: true,
                participantId: true,
              },
            }),
            tx.chatThread.findMany({
              where: { chatbotId, createdAt: { lte: exportedAt } },
              select: {
                id: true,
                participantId: true,
                title: true,
                createdAt: true,
                messages: {
                  where: { createdAt: { lte: exportedAt } },
                  select: {
                    id: true,
                    parentId: true,
                    role: true,
                    content: true,
                    chatMode: true,
                    modelId: true,
                    lifecycleStatus: true,
                    createdAt: true,
                    // only the type is read; image data is never selected
                    attachments: {
                      where: { imageBase64: { not: null } },
                      select: { type: true },
                    },
                  },
                },
              },
            }),
          ])

          const invitationByParticipant = new Map(
            invitations
              .filter((invitation) => invitation.participantId)
              .map((invitation) => [invitation.participantId, invitation])
          )
          const participantIds = new Set(
            participations.map((participation) => participation.participantId)
          )
          const roster: ExportRosterEntry[] = [
            ...participations.map((participation) => {
              const invitation = invitationByParticipant.get(
                participation.participantId
              )
              return {
                participantId: participation.participantId,
                username: participation.participant.username,
                email: participation.participant.email,
                invitationEmail: invitation?.email ?? null,
                invitationMatriculationNumber:
                  invitation?.matriculationNumber ?? null,
                assessmentGivenName: participation.assessmentGivenName,
                assessmentSurname: participation.assessmentSurname,
                assessmentMatriculationNumber:
                  participation.assessmentMatriculationNumber,
                joined: true,
              }
            }),
            ...invitations
              .filter(
                (invitation) =>
                  !invitation.participantId ||
                  !participantIds.has(invitation.participantId)
              )
              .map((invitation) => ({
                participantId: invitation.participantId,
                username: null,
                email: null,
                invitationEmail: invitation.email,
                invitationMatriculationNumber: invitation.matriculationNumber,
                assessmentGivenName: null,
                assessmentSurname: null,
                assessmentMatriculationNumber: null,
                joined: false,
              })),
          ]
          if (roster.length > ASSESSMENT_TRANSCRIPT_MAX_ROSTER) {
            throw new ExportRefused('DATA_EXPORT_TOO_LARGE')
          }

          return buildConversationExport({
            metadata: {
              chatbotId: chatbot.id,
              chatbotName: chatbot.name,
              courseId: chatbot.course.id,
              courseName: chatbot.course.name,
              exportedAt,
              windowFrom: null,
              windowTo: null,
            },
            roster,
            threads: threads.map((thread) => ({
              ...thread,
              messages: thread.messages.map((message) => ({
                ...message,
                attachmentTypes: message.attachments.map(
                  (attachment) => attachment.type
                ),
              })),
            })),
          })
        },
        {
          isolationLevel: DB.Prisma.TransactionIsolationLevel.RepeatableRead,
          timeout: 120_000,
          maxWait: 10_000,
        }
      )

      const archive = createZipArchive([
        { name: 'overview.csv', data: toOverviewCsv(exported) },
        { name: 'viewer.html', data: CHAT_TRANSCRIPT_VIEWER_HTML },
        ...exported.students.map((student) => ({
          name: student.file,
          data: JSON.stringify(toStudentTranscript(exported, student), null, 2),
        })),
      ])
      if (archive.length > ASSESSMENT_TRANSCRIPT_MAX_ARCHIVE_BYTES) {
        throw new ExportRefused('DATA_EXPORT_TOO_LARGE')
      }

      const stored = await prisma.$transaction(async (tx) => {
        const moved = await tx.assessmentExportReceipt.updateMany({
          where: { id: exportId, status: DB.DataExportStatus.PENDING },
          data: {
            status: DB.DataExportStatus.READY,
            sha256: createHash('sha256').update(archive).digest('hex'),
            byteCount: archive.length,
            recordCount: exported.students.length,
            artifactExpiresAt: new Date(
              Date.now() + ASSESSMENT_TRANSCRIPT_ARTIFACT_TTL_MS
            ),
          },
        })
        if (moved.count !== 1) return false
        // a retry may find the row of an earlier, interrupted attempt
        await tx.assessmentExportArtifact.deleteMany({
          where: { receiptId: exportId },
        })
        await tx.assessmentExportArtifact.create({
          data: { receiptId: exportId, content: new Uint8Array(archive) },
        })
        return true
      })
      return stored
    } catch (error) {
      if (error instanceof ExportRefused) {
        executionCtx.logger.error(
          `Assessment transcript export ${exportId} refused: ${error.failureCode}`
        )
        await markFailed(prisma, exportId, error.failureCode)
        return false
      }
      if (
        executionCtx.retryCount() >= ASSESSMENT_TRANSCRIPT_EXPORT_MAX_RETRIES
      ) {
        executionCtx.logger.error(
          `Assessment transcript export ${exportId} failed permanently.`
        )
        await markFailed(prisma, exportId, 'DATA_EXPORT_FAILED')
      }
      throw error
    }
  }

// Hourly sweep: expires archives that were never downloaded, removes
// archives of finished receipts and fails requests whose job never completed.
export const handleSweepAssessmentTranscriptExports: HatchetHandlers['handleSweepAssessmentTranscriptExports'] =
  async (_args, globalCtx) => {
    const now = new Date()
    await globalCtx.prisma.$transaction(async (tx) => {
      await tx.assessmentExportReceipt.updateMany({
        where: {
          chatbotId: { not: null },
          status: DB.DataExportStatus.READY,
          artifactExpiresAt: { lte: now },
        },
        data: { status: DB.DataExportStatus.EXPIRED },
      })
      await tx.assessmentExportArtifact.deleteMany({
        where: {
          receipt: {
            status: {
              in: [
                DB.DataExportStatus.EXPIRED,
                DB.DataExportStatus.FAILED,
                DB.DataExportStatus.RELEASED,
              ],
            },
          },
        },
      })
      await tx.assessmentExportReceipt.updateMany({
        where: {
          chatbotId: { not: null },
          status: DB.DataExportStatus.PENDING,
          attestedAt: {
            lt: new Date(
              now.getTime() - ASSESSMENT_TRANSCRIPT_STALE_PENDING_MS
            ),
          },
        },
        data: {
          status: DB.DataExportStatus.FAILED,
          failureCode: 'DATA_EXPORT_TIMED_OUT',
        },
      })
    })
    return true
  }
