import { prisma } from '@klicker-uzh/prisma'
import {
  deliverLearnerMemoryForgets,
  deriveLearnerMemoryKey,
  inspectLearnerMemory,
  isLearnerMemoryConfigured,
  LearnerMemoryError,
  type LearnerMemoryRecord,
  observeLearnerExchange,
  recallLearnerMemory,
} from '@klicker-uzh/util/learner-memory'
import { currentTutorPersonalizationDisclosureVersion } from '@klicker-uzh/util/participant-account-data-use'

/**
 * Learning notes are short per-course notes about one student, kept by the
 * optional learner-memory service. This module is the chat app's only access
 * to that service. Every function here fails soft: without the service, or
 * when it does not answer, the Tutor works from the practice results alone.
 */

/** The personalization notice this deployment shows and records answers under. */
export function currentTutorPersonalizationVersion(): string {
  return currentTutorPersonalizationDisclosureVersion(
    isLearnerMemoryConfigured()
  )
}

/**
 * Learning notes need a configured service and a chatbot owner with a Catalyst
 * entitlement. Any lookup error denies.
 */
export async function isChatbotLearnerMemoryAvailable(
  ownerId: string
): Promise<boolean> {
  if (!isLearnerMemoryConfigured()) return false
  try {
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { catalystInstitutional: true, catalystIndividual: true },
    })
    return (
      owner?.catalystInstitutional === true ||
      owner?.catalystIndividual === true
    )
  } catch {
    return false
  }
}

/** Addresses one student's notes in one course at the account's memory epoch. */
export interface LearnerMemoryHandle {
  learnerKey: string
  courseId: string
  epoch: number
}

/**
 * - `deleting`: a deletion the service has not confirmed yet; the notes are
 *   neither read nor written until it has.
 * - `unavailable`: the service did not answer in time or answered wrongly.
 */
export type LearnerNotesState = 'deleting' | 'unavailable' | 'empty' | 'present'

export interface LearnerNotes {
  state: LearnerNotesState
  record: LearnerMemoryRecord | null
  /** The public database's clock when the notes were read. */
  readAt: Date | null
}

function hasNotes(record: LearnerMemoryRecord): boolean {
  return (
    record.topics.length > 0 ||
    record.difficulties.length > 0 ||
    record.goal !== null
  )
}

/**
 * Read the notes for a chat turn (`recall`, short timeout) or for the
 * student's own view (`inspect`). Never throws.
 */
export async function loadLearnerNotes(
  handle: LearnerMemoryHandle,
  purpose: 'turn' | 'view'
): Promise<LearnerNotes> {
  try {
    const [openDeletion, clock] = await Promise.all([
      prisma.learnerMemoryForgetRequest.findFirst({
        where: {
          learnerKey: handle.learnerKey,
          completedAt: null,
          OR: [{ courseId: handle.courseId }, { courseId: null }],
        },
        select: { id: true },
      }),
      prisma.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS "now"`,
    ])
    if (openDeletion) return { state: 'deleting', record: null, readAt: null }
    const readAt = clock[0]?.now instanceof Date ? clock[0].now : null
    const record =
      purpose === 'turn'
        ? await recallLearnerMemory(handle)
        : await inspectLearnerMemory(handle)
    return record && hasNotes(record)
      ? { state: 'present', record, readAt }
      : { state: 'empty', record: null, readAt }
  } catch {
    return { state: 'unavailable', record: null, readAt: null }
  }
}

function errorLabel(error: unknown): string {
  if (error instanceof LearnerMemoryError) return error.code
  return error instanceof Error ? error.name : typeof error
}

/**
 * Hand a completed Tutor exchange to the service, which updates the notes and
 * keeps no message text. Runs after the response; a failure only means this
 * exchange leaves no trace in the notes. The log never carries message text.
 */
export async function observeLearnerTurn(input: {
  requestId: string
  handle: LearnerMemoryHandle
  exchangeAt: Date
  userMessage: string
  assistantMessage: string
}): Promise<void> {
  try {
    await observeLearnerExchange({
      ...input.handle,
      exchangeAt: input.exchangeAt,
      userMessage: input.userMessage,
      assistantMessage: input.assistantMessage,
    })
  } catch (error) {
    console.warn('Learning notes were not updated for this turn', {
      requestId: input.requestId,
      errorType: errorLabel(error),
    })
  }
}

/**
 * Delete the student's notes in one course. The request is recorded first and
 * sent right away; if the service cannot take it now, the retry task sends it
 * again, and the notes stay unused until it is confirmed.
 *
 * - `deleted`: the service confirmed the deletion.
 * - `pending`: recorded, not yet confirmed.
 * - `unavailable`: this deployment keeps no notes.
 */
export async function requestLearnerNotesDeletion(input: {
  participantId: string
  courseId: string
}): Promise<'deleted' | 'pending' | 'unavailable'> {
  const learnerKey = deriveLearnerMemoryKey(input.participantId)
  if (!learnerKey) return 'unavailable'

  const requestId = await prisma.$transaction(async (tx) => {
    // The lock orders this request against a concurrent change of the choice,
    // which raises the epoch.
    const rows = await tx.$queryRaw<Array<{ epoch: number; now: Date }>>`
      SELECT "learnerMemoryEpoch" AS "epoch", clock_timestamp() AS "now"
      FROM "Participant"
      WHERE "id" = ${input.participantId}::uuid
      FOR UPDATE
    `
    const row = rows[0]
    if (!row) return null
    const request = await tx.learnerMemoryForgetRequest.create({
      data: {
        learnerKey,
        courseId: input.courseId,
        epoch: row.epoch,
        requestedAt: row.now,
      },
      select: { id: true },
    })
    return request.id
  })
  if (requestId === null) return 'unavailable'

  try {
    const result = await deliverLearnerMemoryForgets({
      prisma,
      ids: [requestId],
    })
    return result.delivered === 1 ? 'deleted' : 'pending'
  } catch {
    return 'pending'
  }
}
