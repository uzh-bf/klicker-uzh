import { ResponseExampleStyle as DBResponseExampleStyle } from '@klicker-uzh/prisma/client'
import { normalizeChatbotStandardModeConfig } from '@klicker-uzh/util'
import { hasCompleteResponseExampleCitationParity } from '@klicker-uzh/util/response-example-eligibility'
import { z } from 'zod'

export const RESPONSE_EXAMPLE_CHAT_MODE_MAX_LENGTH = 100
export const RESPONSE_EXAMPLE_STUDENT_MESSAGE_MAX_LENGTH = 4_000
export const RESPONSE_EXAMPLE_REFERENCE_ANSWER_MAX_LENGTH = 20_000

export const responseExampleStyleSchema = z.nativeEnum(DBResponseExampleStyle)

export type ResponseExampleStyle = DBResponseExampleStyle
export type ResponseExampleStatus =
  | 'CANDIDATE'
  | 'APPROVED'
  | 'NEEDS_REVIEW'
  | 'REJECTED'

export type ResponseExampleAction = 'APPROVE' | 'EDIT_AND_APPROVE' | 'REJECT'

export function canApplyResponseExampleAction(
  status: ResponseExampleStatus,
  action: ResponseExampleAction
): boolean {
  switch (action) {
    case 'APPROVE':
    case 'REJECT':
      return status === 'CANDIDATE' || status === 'NEEDS_REVIEW'
    case 'EDIT_AND_APPROVE':
      return status !== 'REJECTED'
  }
}

export function extractChatbotModes(
  systemPrompts: unknown,
  standardModeConfig: unknown
): string[] {
  const config = normalizeChatbotStandardModeConfig(
    standardModeConfig,
    systemPrompts
  )
  const standardModes = {
    tutor: config.tutorEnabled,
    explainer: config.explainerEnabled,
    quizzer: config.quizzerEnabled,
  }
  const storedModes =
    systemPrompts &&
    typeof systemPrompts === 'object' &&
    !Array.isArray(systemPrompts)
      ? Object.keys(systemPrompts)
      : []
  const modes = [
    ...Object.entries(standardModes)
      .filter(([, enabled]) => enabled)
      .map(([mode]) => mode),
    ...storedModes.filter(
      (mode) => mode.trim() && !Object.hasOwn(standardModes, mode)
    ),
  ]

  return modes.sort((left, right) => {
    if (left < right) return -1
    if (left > right) return 1
    return 0
  })
}

export function responseExampleActions(status: ResponseExampleStatus) {
  return {
    canApprove: canApplyResponseExampleAction(status, 'APPROVE'),
    canEditAndApprove: canApplyResponseExampleAction(
      status,
      'EDIT_AND_APPROVE'
    ),
    canReject: canApplyResponseExampleAction(status, 'REJECT'),
  }
}

/**
 * Check only the renderer-visible citation contract. This does not claim that
 * a source factually supports the response.
 */
export function hasCompleteEligibleCitationParity(
  referenceAnswer: string,
  evidenceReferences: ReadonlyArray<{
    citationIndex: number
    evidenceEligible: boolean
  }>
): boolean {
  if (evidenceReferences.some((reference) => !reference.evidenceEligible)) {
    return false
  }

  return hasCompleteResponseExampleCitationParity({
    referenceAnswer,
    evidenceReferences,
  })
}
