import { UserRole } from '@klicker-uzh/prisma/client'
import {
  isParticipantDataUseComplete,
  type JWTPayload,
} from '@klicker-uzh/util'

export const PARTICIPANT_DATA_USE_COMPLETION_REQUIRED =
  'PARTICIPANT_DATA_USE_COMPLETION_REQUIRED'

export type ParticipantDataUseState = Parameters<
  typeof isParticipantDataUseComplete
>[0]

export type ParticipantAdmission =
  | { admitted: true }
  | {
      admitted: false
      status: 403
      error: typeof PARTICIPANT_DATA_USE_COMPLETION_REQUIRED
    }

const admitted: ParticipantAdmission = { admitted: true }

const dataUseRequired: ParticipantAdmission = {
  admitted: false,
  status: 403,
  error: PARTICIPANT_DATA_USE_COMPLETION_REQUIRED,
}

/**
 * Decides whether a response may be collected for an already-identified
 * participant account. An account only admits collection once it has
 * acknowledged the current data-use disclosure and recorded both optional
 * choices, because the disclosure is what covers collecting its responses at
 * all.
 */
export async function admitRegisteredParticipant(
  participantId: string,
  loadDataUseState: (participantId: string) => Promise<ParticipantDataUseState>
): Promise<ParticipantAdmission> {
  const state = await loadDataUseState(participantId)
  return isParticipantDataUseComplete(state) ? admitted : dataUseRequired
}

export type ParticipantTokenAdmissionDependencies = {
  verifyParticipantToken: (token: string) => Promise<JWTPayload>
  loadDataUseState: (participantId: string) => Promise<ParticipantDataUseState>
}

/**
 * Applies the account gate to the `participant_token` cookie of the regular
 * response endpoint.
 *
 * Anonymous responses and temporary-participant responses have no registered
 * account whose disclosure could apply, so they keep their existing handling.
 * The same holds for a cookie that does not verify as a registered participant:
 * such a request was already treated as anonymously attributed before this
 * gate existed, and rejecting it would break live quizzes for participants who
 * hold a stale cookie while adding no protection. Only a cookie that resolves
 * to a registered participant account is gated.
 */
export async function admitParticipantToken(
  token: string | undefined,
  {
    verifyParticipantToken,
    loadDataUseState,
  }: ParticipantTokenAdmissionDependencies
): Promise<ParticipantAdmission> {
  if (!token) return admitted

  let participant: JWTPayload
  try {
    participant = await verifyParticipantToken(token)
  } catch {
    return admitted
  }

  if (participant.role !== UserRole.PARTICIPANT || !participant.sub) {
    return admitted
  }

  return admitRegisteredParticipant(participant.sub, loadDataUseState)
}
