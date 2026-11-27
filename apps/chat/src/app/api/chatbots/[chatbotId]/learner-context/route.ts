import { prisma } from '@klicker-uzh/prisma'
import { isLearnerMemoryConfigured } from '@klicker-uzh/util/learner-memory'
import { type NextRequest, NextResponse } from 'next/server'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { resolveLearnerContext } from '@/src/lib/server/learnerContext'
import { requestLearnerNotesDeletion } from '@/src/lib/server/learnerMemory'
import { createRateLimiter } from '@/src/services/rateLimiter'

export const maxDuration = 60

// Each view runs the summary queries. The view re-reads after every saved
// choice, so the limit is generous for a person and stops a scripted loop.
const viewRateLimiter = createRateLimiter(30, 60 * 1000)

/**
 * Show the student what the Tutor would receive about them on their next
 * message in this chatbot. It runs the same resolution as a chat turn and
 * returns the text unchanged, so the view cannot drift from what is sent.
 * `notes` says what applies to the learning notes, so the view can explain
 * why none are shown.
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
      select: { personalizationEnabled: true, ownerId: true },
    })
    if (!chatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
    }
    const result = await resolveLearnerContext(
      {
        mode: 'tutor',
        chatbotPersonalizationEnabled: chatbot.personalizationEnabled,
        chatbotOwnerId: chatbot.ownerId,
        participantId: authResult.participantId,
        courseId: authResult.chatbot.courseId,
      },
      'view'
    )
    // Deletion depends only on whether this deployment keeps notes, never on
    // the switch, the entitlement or the choice, so stored notes stay
    // deletable when the Tutor may no longer use them.
    const keepsNotes = isLearnerMemoryConfigured()
    return NextResponse.json(
      result.eligible
        ? {
            active: true,
            text: result.text,
            notes: result.notes,
            notesDeletable: keepsNotes && result.notes !== 'deleting',
          }
        : { active: false, reason: result.reason, notesDeletable: keepsNotes },
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

/**
 * Delete the student's learning notes for this chatbot's course. The student
 * keeps their choice; later Tutor conversations start new notes. Deleting is
 * always allowed, whatever the choice or the chatbot's settings currently are,
 * and also while the account data-use notice awaits a new acknowledgement.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params
  const authResult = await withChatbotAuth(req, chatbotId, {
    allowIncompleteDataUse: true,
  })
  if ('response' in authResult) {
    return authResult.response
  }

  try {
    const status = await requestLearnerNotesDeletion({
      participantId: authResult.participantId,
      courseId: authResult.chatbot.courseId,
    })
    return NextResponse.json(
      { status },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('Failed to record the learning-notes deletion', {
      errorType: error instanceof Error ? error.name : typeof error,
    })
    return NextResponse.json(
      { error: 'LEARNER_NOTES_DELETION_FAILED' },
      { status: 500 }
    )
  }
}
