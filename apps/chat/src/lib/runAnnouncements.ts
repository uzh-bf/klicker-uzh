import type { MessageStatus } from '@assistant-ui/react'

export type ChatRunOutcome = 'completed' | 'error' | 'stopped'

export function getAssistantRuntimeRunOutcome(
  status: MessageStatus | null | undefined
): ChatRunOutcome | null {
  if (
    !status ||
    status.type === 'running' ||
    status.type === 'requires-action'
  ) {
    return null
  }

  if (status.type === 'complete') return 'completed'
  return status.reason === 'cancelled' ? 'stopped' : 'error'
}
