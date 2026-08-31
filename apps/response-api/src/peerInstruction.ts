import { randomUUID } from 'node:crypto'
import type {
  LiveQuizResponseInput,
  PeerInstructionRevisionEvent,
  PeerInstructionScope,
} from '@klicker-uzh/types'
import {
  createPeerInstructionParticipantIdentity,
  getPeerInstructionAnonymousIdentity,
  isValidPeerInstructionScope,
  readPeerInstructionRevisionMessageByIdentity,
  type PeerInstructionRevisionRegistration,
  registerPeerInstructionRevisionMessage,
  releasePeerInstructionRevisionMessage,
  verifyJWT,
} from '@klicker-uzh/util'
import type { Redis } from 'ioredis'

type SubmissionResult = {
  status: number
  body: Record<string, string | number>
}

async function releaseRevisionClaim({
  redis,
  event,
  releaseRevision,
}: {
  redis: Redis
  event: PeerInstructionRevisionEvent
  releaseRevision: typeof releasePeerInstructionRevisionMessage
}) {
  try {
    await releaseRevision({ redis, event })
  } catch (error) {
    // Keep the queue failure response stable if claim cleanup is unavailable.
    console.error('Failed to release Peer Instruction revision claim', {
      messageId: event.messageId,
      error,
    })
  }
}

export function getForwardedParticipantCookie(rawCookie?: string) {
  if (!rawCookie) return undefined
  const parts = rawCookie.split(';').map((entry) => entry.trim())
  const participant = parts.find((entry) =>
    entry.startsWith('participant_token=')
  )
  const temporary = parts.find((entry) =>
    entry.startsWith('temporary_participant_token=')
  )
  const forwarded = [participant, temporary].filter((entry): entry is string =>
    Boolean(entry)
  )
  return forwarded.length > 0 ? forwarded.join('; ') : undefined
}

function parseCookies(cookie?: string) {
  if (!cookie) return {}
  return cookie.split(';').reduce<Record<string, string>>((cookies, entry) => {
    const separator = entry.indexOf('=')
    if (separator < 1) return cookies
    const key = entry.slice(0, separator).trim()
    const value = entry.slice(separator + 1).trim()
    if (key && value) cookies[key] = value
    return cookies
  }, {})
}

function parseSubmission(payload: unknown): {
  scope: PeerInstructionScope
  instanceId: number
  response: LiveQuizResponseInput
  pairingToken?: string
} | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }
  const value = payload as Record<string, unknown>
  if (
    typeof value.liveQuizId !== 'string' ||
    !Number.isInteger(value.blockId) ||
    !Number.isInteger(value.originalExecution) ||
    (value.attempt !== 1 && value.attempt !== 2) ||
    !Number.isInteger(value.instanceId) ||
    !value.response ||
    typeof value.response !== 'object' ||
    Array.isArray(value.response)
  ) {
    return null
  }
  return {
    scope: {
      liveQuizId: value.liveQuizId,
      blockId: value.blockId as number,
      originalExecution: value.originalExecution as number,
      attempt: value.attempt,
    },
    instanceId: value.instanceId as number,
    response: value.response as LiveQuizResponseInput,
    ...(typeof value.pairingToken === 'string'
      ? { pairingToken: value.pairingToken }
      : {}),
  }
}

async function resolveIdentity({
  cookie,
  pairingToken,
  scope,
  appSecret,
}: {
  cookie?: string
  pairingToken?: string
  scope: PeerInstructionScope
  appSecret: string
}) {
  const cookies = parseCookies(cookie)
  const candidates = [
    {
      token: cookies.participant_token,
      role: 'PARTICIPANT' as const,
    },
    {
      token: cookies.temporary_participant_token,
      role: 'TEMPORARY_PARTICIPANT' as const,
    },
  ]
  for (const candidate of candidates) {
    if (!candidate.token) continue
    try {
      const participant = await verifyJWT(candidate.token, appSecret)
      if (participant.role === candidate.role && participant.sub) {
        return createPeerInstructionParticipantIdentity({
          scope,
          participantId: participant.sub,
          participantRole: candidate.role,
          secret: appSecret,
        })
      }
    } catch {
      // Try another server-verifiable identity before rejecting the request.
    }
  }

  if (!pairingToken) return null
  try {
    return getPeerInstructionAnonymousIdentity(pairingToken)
  } catch {
    return null
  }
}

export async function submitPeerInstructionRevision({
  payload,
  cookie,
  redis,
  appSecret,
  pushEvent,
  releaseRevision = releasePeerInstructionRevisionMessage,
  now = Date.now,
}: {
  payload: unknown
  cookie?: string
  redis: Redis
  appSecret: string
  pushEvent: (
    eventName: string,
    event: PeerInstructionRevisionEvent
  ) => Promise<unknown>
  releaseRevision?: typeof releasePeerInstructionRevisionMessage
  now?: () => number
}): Promise<SubmissionResult> {
  const submission = parseSubmission(payload)
  if (!submission) {
    return { status: 400, body: { error: 'invalid_peer_instruction_response' } }
  }
  if (!isValidPeerInstructionScope(submission.scope)) {
    return { status: 400, body: { error: 'invalid_peer_instruction_scope' } }
  }

  const identity = await resolveIdentity({
    cookie,
    pairingToken: submission.pairingToken,
    scope: submission.scope,
    appSecret,
  })
  if (!identity) {
    return { status: 401, body: { error: 'missing_pairing_identity' } }
  }

  const responseTimestamp = now()
  const event: PeerInstructionRevisionEvent = {
    ...submission.scope,
    messageId: randomUUID(),
  }
  let registration: PeerInstructionRevisionRegistration
  try {
    registration = await registerPeerInstructionRevisionMessage({
      redis,
      event,
      instanceId: submission.instanceId,
      identity,
      response: submission.response,
      responseTimestamp,
    })
  } catch {
    return {
      status: 503,
      body: { error: 'peer_instruction_store_unavailable' },
    }
  }

  if (registration === 'duplicate') {
    let existing
    try {
      existing = await readPeerInstructionRevisionMessageByIdentity({
        redis,
        scope: submission.scope,
        instanceId: submission.instanceId,
        identity,
      })
    } catch {
      return {
        status: 503,
        body: { error: 'peer_instruction_store_unavailable' },
      }
    }

    if (existing?.message.status === 'accepted') {
      try {
        await pushEvent('peer-instruction-revision-received', existing.event)
      } catch {
        // An earlier request may already have published this accepted claim.
        // Keep it for a later retry when this duplicate publication fails.
        return { status: 503, body: { error: 'revision_queue_unavailable' } }
      }
    }

    return {
      status: 208,
      body: { status: 'response_recorded_before', responseTimestamp },
    }
  }
  if (registration === 'sealed') {
    return { status: 409, body: { error: 'peer_instruction_revision_closed' } }
  }
  if (registration === 'invalid-token') {
    return { status: 401, body: { error: 'invalid_pairing_identity' } }
  }
  if (registration === 'attempt-failed') {
    return { status: 409, body: { error: 'peer_instruction_attempt_failed' } }
  }
  if (registration !== 'accepted') {
    return { status: 400, body: { error: registration } }
  }

  try {
    await pushEvent('peer-instruction-revision-received', event)
  } catch {
    await releaseRevisionClaim({ redis, event, releaseRevision })
    return { status: 503, body: { error: 'revision_queue_unavailable' } }
  }

  return {
    status: 200,
    body: { status: 'ok', responseTimestamp },
  }
}
