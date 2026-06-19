import type { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'
import type { TutorTurnState } from './tutorState.js'

type TutorEventInput = {
  prisma: PrismaClient
  requestId: string
  eventType: string
  participantId?: string
  chatbotId: string
  threadId?: string | null
  messageId?: string | null
  payload: Record<string, unknown>
}

type PreviousFeedbackEvent = {
  id: string
  createdAt: Date
  payload: unknown
}

function tutorEventLoggingEnabled() {
  return process.env.CHAT_TUTOR_EVENT_LOGGING_ENABLED !== '0'
}

export function summarizeTutorUserMessage(content: string) {
  const lower = content.toLowerCase()
  return {
    textLength: content.length,
    hasQuestion: content.includes('?'),
    hasEquationLikeText: /\d+\s*[+\-*/=]|\$.*\$/.test(content),
    asksForCheck: /stimmt|richtig|correct|check|überprüf|verify/.test(lower),
    asksForFinalAnswer:
      /lösung|answer|final|resultat|ergebnis|solve|gib mir/.test(lower),
    signalsStuck:
      /verstehe[^.?!]{0,80}nicht|keine ahnung|ich stecke|stuck|lost|confused|help/.test(
        lower
      ),
    hasImagePlaceholder: content.includes('[Attached image]'),
  }
}

export function tutorStateEventPayload(state: TutorTurnState) {
  return {
    skillPackVersion: state.skillPackVersion,
    currentSkill: state.currentSkill ?? null,
    studentState: state.studentState,
    allowedMove: state.allowedMove,
    hintDepth: state.hintDepth,
    leakageAllowed: state.leakageAllowed,
    retrievalNeeded: state.retrievalNeeded,
    retrievedEvidenceIds: state.retrievedEvidenceIds ?? [],
    affectSignal: state.affectSignal ?? null,
    imageUncertainty: state.imageUncertainty === true,
    firstErrorStep: state.firstError?.step ?? null,
    misconceptionLabel: state.misconception?.label ?? null,
    misconceptionConfidence: state.misconception?.confidence ?? null,
  }
}

export function detectTutorFeedbackUptake({
  latestUserMessage,
  previousFeedbackEvent,
}: {
  latestUserMessage: string
  previousFeedbackEvent: PreviousFeedbackEvent | null
}) {
  if (!previousFeedbackEvent) return null

  const summary = summarizeTutorUserMessage(latestUserMessage)
  const hasAttempt =
    summary.hasEquationLikeText ||
    summary.asksForCheck ||
    latestUserMessage.length > 80
  const answerOnlyPressure = summary.asksForFinalAnswer && !hasAttempt

  if (!hasAttempt || answerOnlyPressure) return null

  return {
    previousFeedbackEventId: previousFeedbackEvent.id,
    uptakeSignal: summary.asksForCheck
      ? 'student_requested_check_after_feedback'
      : 'student_attempt_after_feedback',
    messageSummary: summary,
  }
}

export async function loadLatestTutorFeedbackEvent({
  prisma,
  requestId,
  chatbotId,
  threadId,
}: {
  prisma: PrismaClient
  requestId: string
  chatbotId: string
  threadId?: string | null
}): Promise<PreviousFeedbackEvent | null> {
  if (!tutorEventLoggingEnabled() || !threadId) return null

  try {
    return await prisma.tutorEvent.findFirst({
      where: {
        chatbotId,
        threadId,
        eventType: 'feedback_delivered',
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, payload: true },
    })
  } catch (error) {
    console.warn('[chat-api] tutor event lookup failed', { requestId, error })
    return null
  }
}

export async function logTutorEvent({
  prisma,
  requestId,
  eventType,
  participantId,
  chatbotId,
  threadId,
  messageId,
  payload,
}: TutorEventInput) {
  if (!tutorEventLoggingEnabled()) return null

  try {
    return await prisma.tutorEvent.create({
      data: {
        eventType,
        participantId: participantId ?? null,
        chatbotId,
        threadId: threadId ?? null,
        messageId: messageId ?? null,
        payload: payload as Prisma.InputJsonValue,
      },
      select: { id: true },
    })
  } catch (error) {
    console.warn('[chat-api] tutor event log failed', {
      requestId,
      eventType,
      error,
    })
    return null
  }
}
