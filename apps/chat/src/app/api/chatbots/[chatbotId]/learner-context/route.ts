import { prisma } from '@klicker-uzh/prisma'
import { type NextRequest, NextResponse } from 'next/server'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { resolveLearnerContext } from '@/src/lib/server/learnerContext'

export const maxDuration = 60

/**
 * Show the student what the Tutor would receive about them on their next
 * message in this chatbot. It runs the same resolution as a chat turn and
 * returns the text unchanged, so the view cannot drift from what is sent.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params
  const authResult = await withChatbotAuth(req, chatbotId)
  if ('response' in authResult) {
    return authResult.response
  }

  try {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: { personalizationEnabled: true },
    })
    const result = await resolveLearnerContext({
      mode: 'tutor',
      chatbotPersonalizationEnabled: chatbot?.personalizationEnabled === true,
      participantId: authResult.participantId,
      courseId: authResult.chatbot.courseId,
    })
    return NextResponse.json(
      result.eligible
        ? { active: true, text: result.text }
        : { active: false, reason: result.reason },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    console.error('Failed to resolve the learner context view')
    return NextResponse.json(
      { error: 'LEARNER_CONTEXT_UNAVAILABLE' },
      { status: 500 }
    )
  }
}
