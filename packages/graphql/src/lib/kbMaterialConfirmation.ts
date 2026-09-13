import { createHash } from 'node:crypto'
import { GraphQLError } from 'graphql'

export const KB_MATERIAL_NOTICE_VERSION = '2026-09-09' as const
export const KB_MATERIAL_PURPOSE = 'KB_PREPARATION_AND_CHATBOT_ANSWERS' as const

export type KbMaterialConfirmationInput = {
  rightsConfirmed?: boolean | null
  personalDataConfirmed?: boolean | null
  noticeVersion?: string | null
}

type KbMaterialScopeBinding = {
  chatbotId: string
  courseId: string | null
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

export function assertKbMaterialConfirmation(
  input: KbMaterialConfirmationInput
): void {
  if (input.rightsConfirmed !== true || input.personalDataConfirmed !== true) {
    throw new GraphQLError('KB material confirmation is required', {
      extensions: { code: 'KB_MATERIAL_CONFIRMATION_REQUIRED' },
    })
  }

  if (input.noticeVersion !== KB_MATERIAL_NOTICE_VERSION) {
    throw new GraphQLError('KB material notice is stale', {
      extensions: { code: 'KB_MATERIAL_NOTICE_STALE' },
    })
  }
}

export function getKbMaterialScopeFingerprint(
  bindings: readonly KbMaterialScopeBinding[]
): string {
  const bindingsByChatbot = new Map<string, string | null>()

  for (const binding of bindings) {
    if (bindingsByChatbot.has(binding.chatbotId)) {
      if (bindingsByChatbot.get(binding.chatbotId) !== binding.courseId) {
        throw new Error('Conflicting course bindings for chatbot')
      }
      continue
    }

    bindingsByChatbot.set(binding.chatbotId, binding.courseId)
  }

  const normalizedBindings = [...bindingsByChatbot.entries()]
    .map(([chatbotId, courseId]) => ({ chatbotId, courseId }))
    .sort((left, right) => {
      const chatbotComparison = compareStrings(left.chatbotId, right.chatbotId)
      if (chatbotComparison !== 0) return chatbotComparison

      if (left.courseId === right.courseId) return 0
      if (left.courseId === null) return -1
      if (right.courseId === null) return 1
      return compareStrings(left.courseId, right.courseId)
    })

  const canonicalScope = JSON.stringify({
    purpose: KB_MATERIAL_PURPOSE,
    bindings: normalizedBindings,
  })

  return createHash('sha256').update(canonicalScope).digest('hex')
}
