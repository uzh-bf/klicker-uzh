import { PersonalElementOrigin } from '@klicker-uzh/graphql/dist/ops'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { z } from 'zod'
import {
  isFailedPersonalElementPart,
  isPersonalElementFailureMarker,
  isSettledTerminalPartialPersonalElementPart,
  isTerminalPartialPersonalElementPart,
} from '@/src/lib/personalElements/failure'
import { MAX_CARDS, parseStoredGeneratedCardCandidate } from './contracts'
import {
  createPersonalElements,
  discardPersonalElementCandidate,
  getGenerationLeaseState,
  listDiscardedCandidateIds,
  listPersonalElements,
} from './graphqlClient'

type PersistedPart = {
  type?: unknown
  toolCallId?: unknown
  toolName?: unknown
  result?: unknown
  isError?: unknown
}

type CandidateAttempt = {
  status: 'complete' | 'partial' | 'failed' | 'pending'
  candidates: unknown[]
}

type CardDecisionContext = {
  prisma: PrismaClient
  participantId: string
  chatbotId: string
  courseId: string
}

type CardDecisionLinkage = {
  messageId: string
  toolCallId: string
}

type CandidateDecisionInput = CardDecisionLinkage & {
  candidateId: string
}

type CardDecisionFailure = {
  ok: false
  status: 400 | 409
  error: string
}

type CardDecisionSuccess<T> = {
  ok: true
  data: T
}

export type CardDecisionOutcome<T> =
  | CardDecisionSuccess<T>
  | CardDecisionFailure

const candidateIdentitySchema = z
  .object({
    candidateId: z.string().trim().min(1).max(128),
    sourceMessageId: z.string().trim().min(1).max(128),
    sourceToolCallId: z.string().trim().min(1).max(128),
  })
  .passthrough()

function failure(status: 400 | 409, error: string): CardDecisionFailure {
  return { ok: false, status, error }
}

function isCompleteResult(result: Record<string, unknown>) {
  return (
    result.status === 'completed' &&
    typeof result.completed === 'number' &&
    Number.isInteger(result.completed) &&
    result.completed >= 0 &&
    result.completed <= MAX_CARDS &&
    typeof result.total === 'number' &&
    Number.isInteger(result.total) &&
    result.total > 0 &&
    result.total <= MAX_CARDS &&
    result.completed >= result.total
  )
}

async function getCandidateAttempt(
  context: CardDecisionContext,
  linkage: CardDecisionLinkage
): Promise<CandidateAttempt | null> {
  const message = await context.prisma.chatMessage.findFirst({
    where: {
      id: linkage.messageId,
      role: 'assistant',
      thread: {
        participantId: context.participantId,
        chatbotId: context.chatbotId,
      },
    },
    select: { content: true },
  })
  if (!message || !Array.isArray(message.content)) return null

  const content = message.content as PersistedPart[]
  const part = content.find(
    (candidate) =>
      candidate.type === 'tool-call' &&
      candidate.toolCallId === linkage.toolCallId &&
      candidate.toolName === 'generate_cards'
  )
  if (!part?.result || typeof part.result !== 'object') return null

  const result = part.result as Record<string, unknown>
  const candidates = Array.isArray(result.candidates) ? result.candidates : []
  if (
    candidates.length > MAX_CARDS ||
    (typeof result.total === 'number' && result.total > MAX_CARDS)
  ) {
    return null
  }
  if (
    isFailedPersonalElementPart(part, 'generate_cards') ||
    content.some(isPersonalElementFailureMarker)
  ) {
    return { status: 'failed', candidates }
  }

  const status = isTerminalPartialPersonalElementPart(part, 'generate_cards')
    ? 'partial'
    : isCompleteResult(result)
      ? 'complete'
      : 'pending'
  if (status === 'pending') return { status, candidates }

  const settledPartial =
    status === 'partial' &&
    isSettledTerminalPartialPersonalElementPart(part, 'generate_cards')
  if (!settledPartial) {
    const generationLease = await getGenerationLeaseState({
      participantId: context.participantId,
      attemptToken: linkage.messageId,
    })
    if (
      !generationLease ||
      (status === 'complete' && !generationLease.completedAt)
    ) {
      return null
    }
  }

  return { status, candidates }
}

function findWritableCandidate(
  attempt: CandidateAttempt | null,
  input: CandidateDecisionInput
) {
  if (!attempt || attempt.status === 'failed' || attempt.status === 'pending') {
    return null
  }
  const candidate = attempt.candidates.find(
    (value) =>
      value &&
      typeof value === 'object' &&
      (value as { candidateId?: unknown }).candidateId === input.candidateId
  )
  const parsed = parseStoredGeneratedCardCandidate(candidate)
  if (!parsed) return null
  if (
    parsed.sourceMessageId !== input.messageId ||
    parsed.sourceToolCallId !== input.toolCallId
  ) {
    return 'linkage-mismatch' as const
  }
  return parsed
}

function stableCandidateIds(
  attempt: CandidateAttempt,
  linkage: CardDecisionLinkage
) {
  return new Set(
    attempt.candidates.flatMap((candidate) => {
      const parsed = candidateIdentitySchema.safeParse(candidate)
      return parsed.success &&
        parsed.data.sourceMessageId === linkage.messageId &&
        parsed.data.sourceToolCallId === linkage.toolCallId
        ? [parsed.data.candidateId]
        : []
    })
  )
}

function errorCode(error: unknown) {
  if (!(error instanceof Error) || !('extensions' in error)) return null
  const extensions = (error as { extensions?: { code?: unknown } }).extensions
  return typeof extensions?.code === 'string' ? extensions.code : null
}

export async function loadCardDecisionState(
  context: CardDecisionContext,
  linkage: CardDecisionLinkage
): Promise<
  CardDecisionOutcome<{
    courseId: string
    elements: Awaited<ReturnType<typeof listPersonalElements>>
    discardedCandidateIds: string[]
  }>
> {
  const attempt = await getCandidateAttempt(context, linkage)
  if (!attempt || attempt.status === 'pending') {
    return failure(409, 'Candidate decision state is not ready')
  }

  const candidateIds = stableCandidateIds(attempt, linkage)
  if (candidateIds.size === 0) {
    return {
      ok: true,
      data: {
        courseId: context.courseId,
        elements: [],
        discardedCandidateIds: [],
      },
    }
  }

  const [elements, discarded] = await Promise.all([
    listPersonalElements(context.courseId, context.participantId),
    listDiscardedCandidateIds({
      participantId: context.participantId,
      courseId: context.courseId,
      candidateIds: [...candidateIds],
    }),
  ])

  return {
    ok: true,
    data: {
      courseId: context.courseId,
      elements: elements.filter((element) =>
        candidateIds.has(element.candidateId ?? '')
      ),
      discardedCandidateIds: discarded,
    },
  }
}

export async function saveCardCandidateDecision(
  context: CardDecisionContext,
  input: CandidateDecisionInput
): Promise<
  CardDecisionOutcome<{
    courseId: string
    elements: Awaited<ReturnType<typeof createPersonalElements>>
  }>
> {
  const attempt = await getCandidateAttempt(context, input)
  if (attempt?.status === 'failed') {
    return failure(409, 'Candidate attempt is not saveable')
  }

  const generated = findWritableCandidate(attempt, input)
  if (generated === 'linkage-mismatch') {
    return failure(
      400,
      'Candidate linkage does not match the generated message'
    )
  }
  if (!generated) {
    return failure(400, 'Candidate is not part of a completed generated result')
  }

  const candidate = {
    candidateId: generated.candidateId,
    name: generated.name,
    content: generated.content,
    explanation: generated.explanation,
    sources: generated.sources,
    sourceMessageId: generated.sourceMessageId,
    sourceToolCallId: generated.sourceToolCallId,
    // The generated-candidate schema pins origin to AI_GENERATED.
    origin: PersonalElementOrigin.AiGenerated,
  }

  try {
    const elements = await createPersonalElements(
      { courseId: context.courseId, candidates: [candidate] },
      context.participantId
    )
    return {
      ok: true,
      data: { courseId: context.courseId, elements },
    }
  } catch (error) {
    if (errorCode(error) === 'PERSONAL_ELEMENTS_CANDIDATE_DISCARDED') {
      return failure(409, 'Candidate has already been discarded')
    }
    throw error
  }
}

export async function discardCardCandidateDecision(
  context: CardDecisionContext,
  input: CandidateDecisionInput
): Promise<
  CardDecisionOutcome<{
    courseId: string
    candidateId: string
    discarded: true
  }>
> {
  const attempt = await getCandidateAttempt(context, input)
  if (attempt?.status === 'failed') {
    return failure(409, 'Candidate attempt is not discardable')
  }

  const generated = findWritableCandidate(attempt, input)
  if (generated === 'linkage-mismatch') {
    return failure(
      400,
      'Candidate linkage does not match the generated message'
    )
  }
  if (!generated) {
    return failure(400, 'Candidate is not part of a completed generated result')
  }

  try {
    await discardPersonalElementCandidate(
      { courseId: context.courseId, candidateId: input.candidateId },
      context.participantId
    )
  } catch (error) {
    if (errorCode(error) === 'PERSONAL_ELEMENTS_CANDIDATE_SAVED') {
      return failure(409, 'Candidate has already been saved')
    }
    throw error
  }

  return {
    ok: true,
    data: {
      courseId: context.courseId,
      candidateId: input.candidateId,
      discarded: true,
    },
  }
}
