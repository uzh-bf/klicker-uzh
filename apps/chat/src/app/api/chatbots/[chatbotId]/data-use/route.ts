import {
  completeParticipantDataUse,
  updateParticipantDataUseChoice,
} from '@klicker-uzh/graphql/dist/participant-data-use'
import { prisma } from '@klicker-uzh/prisma'
import { UserRole } from '@klicker-uzh/prisma/client'
import { PARTICIPANT_DATA_USE_DISCLOSURE_VERSION } from '@klicker-uzh/util'
import { type NextRequest, NextResponse } from 'next/server'
import {
  loadChatDataUseState,
  withChatbotAuth,
} from '@/src/lib/server/apiGuards'

export const maxDuration = 60

/**
 * The disclosure version is server-owned: a client states which decisions it
 * wants recorded, never which revision of the text it is acknowledging.
 */
function dataUseErrorCode(error: unknown) {
  return error && typeof error === 'object'
    ? (error as { extensions?: { code?: unknown } }).extensions?.code
    : undefined
}

function dataUseErrorStatus(error: unknown): number {
  switch (dataUseErrorCode(error)) {
    case 'PARTICIPANT_DATA_USE_STALE_REVISION':
      return 409
    case 'PARTICIPANT_DATA_USE_INVALID_INPUT':
      return 400
    case 'PARTICIPANT_DATA_USE_FORBIDDEN':
    case 'PARTICIPANT_DATA_USE_COMPLETION_REQUIRED':
      return 403
    case 'PARTICIPANT_DATA_USE_LOCK_TIMEOUT':
      return 503
    default:
      return 500
  }
}

function dataUseErrorBody(error: unknown) {
  const code = dataUseErrorCode(error)
  return {
    error:
      typeof code === 'string' ? code : 'PARTICIPANT_DATA_USE_WRITE_FAILED',
  }
}

/** A body the writer cannot accept is a client error, not a writer failure. */
function invalidInputResponse() {
  return NextResponse.json(
    { error: 'PARTICIPANT_DATA_USE_INVALID_INPUT' },
    { status: 400 }
  )
}

/** Both writers answer a failed write the same way; only the log differs. */
function dataUseWriteErrorResponse(error: unknown, failureMessage: string) {
  const status = dataUseErrorStatus(error)
  if (status === 500) {
    console.error(failureMessage, error)
  }
  return NextResponse.json(dataUseErrorBody(error), { status })
}

/**
 * Read the participant's data-use state. This route stays reachable while the
 * account is incomplete, because it is the surface that completes it.
 */
export async function GET(
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

  const state = await loadChatDataUseState(authResult.participantId)
  if (!state) {
    return NextResponse.json(
      { error: 'Participant account not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    state,
    currentDisclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
    authMode: authResult.authMode,
  })
}

/** Record the acknowledgement together with both purpose choices. */
export async function POST(
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

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return invalidInputResponse()
  }

  const body: Record<string, unknown> =
    payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : {}

  try {
    const saved = await completeParticipantDataUse(
      {
        expectedRevision: body.expectedRevision,
        disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
        researchConsent: body.researchConsent,
        learningAnalyticsConsent: body.learningAnalyticsConsent,
        acknowledged: body.acknowledged,
      },
      {
        prisma,
        user: { sub: authResult.participantId, role: UserRole.PARTICIPANT },
      }
    )

    return NextResponse.json({
      state: await loadChatDataUseState(saved.id),
    })
  } catch (error) {
    return dataUseWriteErrorResponse(
      error,
      'Failed to complete participant data use in chat:'
    )
  }
}

/** Change a single purpose decision once the account is complete. */
export async function PATCH(
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

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    // A truncated or non-JSON body is a client error, not a writer failure.
    return invalidInputResponse()
  }

  const purpose = body?.purpose
  if (purpose !== 'research' && purpose !== 'analytics') {
    return invalidInputResponse()
  }

  try {
    const saved = await updateParticipantDataUseChoice(
      purpose,
      {
        expectedRevision: body?.expectedRevision,
        disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
        consent: body?.consent,
      },
      {
        prisma,
        user: { sub: authResult.participantId, role: UserRole.PARTICIPANT },
      }
    )

    return NextResponse.json({
      state: await loadChatDataUseState(saved.id),
    })
  } catch (error) {
    return dataUseWriteErrorResponse(
      error,
      'Failed to update participant data use in chat:'
    )
  }
}
