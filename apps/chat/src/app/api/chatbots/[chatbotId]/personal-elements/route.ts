import { prisma } from '@klicker-uzh/prisma'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import {
  type CardDecisionOutcome,
  discardCardCandidateDecision,
  loadCardDecisionState,
  saveCardCandidateDecision,
} from '@/src/lib/server/personalElements/cardDecisions'

const linkageSchema = z.object({
  messageId: z.string().uuid(),
  toolCallId: z.string().min(1).max(128),
})

const decisionSchema = linkageSchema.extend({
  candidateId: z.string().min(1).max(128),
})

async function parseBody(req: NextRequest) {
  try {
    return await req.json()
  } catch {
    return null
  }
}

function response<T>(outcome: CardDecisionOutcome<T>) {
  return outcome.ok
    ? NextResponse.json(outcome.data)
    : NextResponse.json({ error: outcome.error }, { status: outcome.status })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params
  const auth = await withChatbotAuth(req, chatbotId)
  if ('response' in auth) return auth.response

  const parsed = linkageSchema.safeParse({
    messageId: req.nextUrl.searchParams.get('messageId'),
    toolCallId: req.nextUrl.searchParams.get('toolCallId'),
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid saved-card linkage' },
      { status: 400 }
    )
  }

  return response(
    await loadCardDecisionState(
      {
        prisma,
        participantId: auth.participantId,
        chatbotId,
        courseId: auth.chatbot.courseId,
      },
      parsed.data
    )
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params
  const auth = await withChatbotAuth(req, chatbotId)
  if ('response' in auth) return auth.response

  const parsed = decisionSchema.safeParse(await parseBody(req))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid candidate data' },
      { status: 400 }
    )
  }

  return response(
    await saveCardCandidateDecision(
      {
        prisma,
        participantId: auth.participantId,
        chatbotId,
        courseId: auth.chatbot.courseId,
      },
      parsed.data
    )
  )
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params
  const auth = await withChatbotAuth(req, chatbotId)
  if ('response' in auth) return auth.response

  const parsed = decisionSchema.safeParse(await parseBody(req))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid candidate data' },
      { status: 400 }
    )
  }

  return response(
    await discardCardCandidateDecision(
      {
        prisma,
        participantId: auth.participantId,
        chatbotId,
        courseId: auth.chatbot.courseId,
      },
      parsed.data
    )
  )
}
