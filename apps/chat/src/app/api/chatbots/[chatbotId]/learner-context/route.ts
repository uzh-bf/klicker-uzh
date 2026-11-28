import { prisma } from '@klicker-uzh/prisma'
import { type NextRequest, NextResponse } from 'next/server'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { resolveLearnerContext } from '@/src/lib/server/learnerContext'
import { createRateLimiter } from '@/src/services/rateLimiter'

export const maxDuration = 60

// Each view runs the summary queries. The view re-reads after every saved
// choice, so the limit is generous for a person and stops a scripted loop.
const viewRateLimiter = createRateLimiter(30, 60 * 1000)

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

  const rateLimit = viewRateLimiter.check(authResult.participantId)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'LEARNER_CONTEXT_RATE_LIMITED' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)),
        },
      }
    )
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
  } catch (error) {
    // Only the error type is logged, so learner data stays out of the logs.
    console.error('Failed to resolve the learner context view', {
      errorType: error instanceof Error ? error.name : typeof error,
    })
    return NextResponse.json(
      { error: 'LEARNER_CONTEXT_UNAVAILABLE' },
      { status: 500 }
    )
  }
}
