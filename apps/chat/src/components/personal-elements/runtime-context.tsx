'use client'

import { createContext, useContext } from 'react'
import {
  isFailedPersonalElementAttempt,
  isFailedPersonalElementPart,
  isPersonalElementFailureMarker,
} from '@/src/lib/personalElements/failure'

export type ApprovedPlan = { messageId: string; toolCallId: string }
export type PlanStatus = 'current' | 'accepted' | 'superseded'

type MessageLike = { id?: string; content?: unknown }
type CandidateToolName = 'generate_cards'

function contentParts(message: MessageLike) {
  return Array.isArray(message.content) ? message.content : []
}

function resultPlanId(part: unknown): string | null {
  if (!part || typeof part !== 'object') return null
  const result = (part as { result?: unknown }).result
  if (!result || typeof result !== 'object') return null
  const planId = (result as { planId?: unknown }).planId
  return typeof planId === 'string' && planId.length > 0 ? planId : null
}

function isToolPart(part: unknown, toolName: string): boolean {
  return (
    !!part &&
    typeof part === 'object' &&
    (part as { toolName?: unknown }).toolName === toolName
  )
}

export function isFailedCandidateAttemptInMessages(
  messages: readonly MessageLike[],
  messageId: string,
  toolCallId: string,
  toolName: CandidateToolName
) {
  const parts = contentParts(
    messages.find((message) => message.id === messageId) ?? {}
  )
  return isFailedPersonalElementAttempt(parts, toolCallId, toolName)
}

export function isPlanCurrentInMessages(
  plan: ApprovedPlan,
  messages: readonly MessageLike[],
  allMessages: readonly MessageLike[] = messages
) {
  return getPlanStatusInMessages(plan, messages, allMessages) === 'current'
}

export function getPlanStatusInMessages(
  plan: ApprovedPlan,
  messages: readonly MessageLike[],
  allMessages: readonly MessageLike[] = messages
): PlanStatus {
  const planIndex = messages.findIndex(
    (message) => message.id === plan.messageId
  )
  if (planIndex < 0) return 'superseded'

  const planPart = contentParts(messages[planIndex] ?? {}).find(
    (part) =>
      isToolPart(part, 'propose_card_plan') &&
      !!part &&
      typeof part === 'object' &&
      (part as { toolCallId?: unknown }).toolCallId === plan.toolCallId
  )
  const planId = resultPlanId(planPart)
  for (const message of messages.slice(planIndex + 1)) {
    const parts = contentParts(message)
    if (parts.some((part) => isToolPart(part, 'propose_card_plan'))) {
      return 'superseded'
    }
  }

  if (planId === null) return 'current'

  const hasSuccessfulGeneration = allMessages.some((message) => {
    const parts = contentParts(message)

    // A stopped turn can persist a completed tool part even though its durable
    // approval claim remains retryable. Only a successful terminal generation
    // consumes the plan on the client.
    const messageHasFailureMarker = parts.some(isPersonalElementFailureMarker)

    return parts.some((part) => {
      if (
        !isToolPart(part, 'generate_cards') ||
        messageHasFailureMarker ||
        isFailedPersonalElementPart(part, 'generate_cards')
      ) {
        return false
      }

      const result =
        part && typeof part === 'object'
          ? (part as { result?: unknown }).result
          : null
      if (!result || typeof result !== 'object') return false

      const generationPlanId = resultPlanId(part)
      const status = (result as { status?: unknown }).status
      const completed = (result as { completed?: unknown }).completed
      const total = (result as { total?: unknown }).total

      return (
        generationPlanId === planId &&
        status === 'completed' &&
        typeof completed === 'number' &&
        Number.isInteger(completed) &&
        typeof total === 'number' &&
        Number.isInteger(total) &&
        total > 0 &&
        completed >= total
      )
    })
  })

  return hasSuccessfulGeneration ? 'accepted' : 'current'
}

type PersonalElementsRuntime = {
  approvePlan: (plan: ApprovedPlan, message: string) => Promise<void>
  getPlanStatus: (plan: ApprovedPlan) => PlanStatus
}

const PersonalElementsContext = createContext<PersonalElementsRuntime | null>(
  null
)

export function PersonalElementsProvider({
  value,
  children,
}: Readonly<{
  value: PersonalElementsRuntime
  children: React.ReactNode
}>) {
  return (
    <PersonalElementsContext.Provider value={value}>
      {children}
    </PersonalElementsContext.Provider>
  )
}

export function usePersonalElementsRuntime() {
  const value = useContext(PersonalElementsContext)
  if (!value) {
    throw new Error('PersonalElementsProvider is missing')
  }
  return value
}
