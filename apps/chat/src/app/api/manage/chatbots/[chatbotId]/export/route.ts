import { prisma } from '@klicker-uzh/prisma'
import { Prisma } from '@klicker-uzh/prisma/client'
import { type NextRequest, NextResponse } from 'next/server'
import {
  buildConversationExport,
  type ConversationExport,
  type ExportRosterEntry,
  toIndexCsv,
  toTranscriptHtml,
} from '@/src/lib/server/conversationExport'
import { IMAGE_ROW_FILTER } from '@/src/lib/attachments/attachmentState'
import { withOwnerPreviewAuth } from '@/src/lib/server/ownerPreviewAuth'
import { createRateLimiter } from '@/src/services/rateLimiter'

export const runtime = 'nodejs'

const exportRateLimiter = createRateLimiter(30, 5 * 60 * 1000)

const FORMATS = {
  index: { type: 'text/csv; charset=utf-8', extension: 'csv' },
  transcripts: { type: 'text/html; charset=utf-8', extension: 'html' },
  json: { type: 'application/json; charset=utf-8', extension: 'json' },
} as const

type ExportFormat = keyof typeof FORMATS

function parseDate(value: string | null): Date | null | 'invalid' {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'invalid' : date
}

async function loadExport({
  chatbotId,
  exportedAt,
  windowFrom,
  windowTo,
}: {
  chatbotId: string
  exportedAt: Date
  windowFrom: Date | null
  windowTo: Date | null
}): Promise<ConversationExport | null> {
  const cutoff = windowTo && windowTo < exportedAt ? windowTo : exportedAt
  const messageWhere = {
    createdAt: { lte: cutoff, ...(windowFrom ? { gte: windowFrom } : {}) },
  }

  // One repeatable-read snapshot so the roster, threads and messages describe
  // the same moment even while students are still writing.
  return prisma.$transaction(
    async (tx) => {
      const chatbot = await tx.chatbot.findUnique({
        where: { id: chatbotId },
        select: {
          id: true,
          name: true,
          course: { select: { id: true, name: true } },
        },
      })
      if (!chatbot) return null

      const [participations, invitations, threads] = await Promise.all([
        tx.participation.findMany({
          where: { courseId: chatbot.course.id },
          select: {
            participantId: true,
            assessmentGivenName: true,
            assessmentSurname: true,
            assessmentMatriculationNumber: true,
            participant: { select: { username: true, email: true } },
          },
        }),
        tx.participantInvitation.findMany({
          where: { courseId: chatbot.course.id },
          select: {
            email: true,
            matriculationNumber: true,
            participantId: true,
          },
        }),
        tx.chatThread.findMany({
          where: { chatbotId, createdAt: { lte: cutoff } },
          select: {
            id: true,
            participantId: true,
            title: true,
            createdAt: true,
            messages: {
              where: messageWhere,
              select: {
                id: true,
                parentId: true,
                role: true,
                content: true,
                chatMode: true,
                modelId: true,
                lifecycleStatus: true,
                createdAt: true,
                attachments: {
                  where: IMAGE_ROW_FILTER,
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

      return buildConversationExport({
        metadata: {
          chatbotId: chatbot.id,
          chatbotName: chatbot.name,
          courseId: chatbot.course.id,
          courseName: chatbot.course.name,
          exportedAt,
          windowFrom,
          windowTo,
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
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      // A whole course snapshot can outlast Prisma's 5 s default.
      timeout: 60_000,
      maxWait: 10_000,
    }
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params
  const auth = await withOwnerPreviewAuth(chatbotId, undefined, {
    allowPaused: true,
  })
  if ('response' in auth) return auth.response

  const rateLimit = exportRateLimiter.check(auth.userId)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1_000)),
        },
      }
    )
  }

  const format = req.nextUrl.searchParams.get('format') ?? 'transcripts'
  if (!(format in FORMATS)) {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
  }
  const windowFrom = parseDate(req.nextUrl.searchParams.get('from'))
  const windowTo = parseDate(req.nextUrl.searchParams.get('to'))
  if (windowFrom === 'invalid' || windowTo === 'invalid') {
    return NextResponse.json({ error: 'Invalid time window' }, { status: 400 })
  }

  const exportedAt = new Date()
  let exported: ConversationExport | null
  try {
    exported = await loadExport({ chatbotId, exportedAt, windowFrom, windowTo })
  } catch (error) {
    console.error('Conversation export failed:', {
      chatbotId,
      errorType: error instanceof Error ? error.name : typeof error,
    })
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
  if (!exported) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  const { type, extension } = FORMATS[format as ExportFormat]
  const body =
    format === 'index'
      ? toIndexCsv(exported)
      : format === 'json'
        ? JSON.stringify(exported, null, 2)
        : toTranscriptHtml(exported)
  const stamp = exportedAt.toISOString().replace(/[:.]/g, '-')

  return new NextResponse(body, {
    headers: {
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="chatbot-${chatbotId}-${format}-${stamp}.${extension}"`,
      'Cache-Control': 'no-store',
    },
  })
}
