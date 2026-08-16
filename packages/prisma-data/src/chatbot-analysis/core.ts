export type AnalysisPurpose = 'learning-analytics' | 'research'

export type EligibilityDecision = {
  participantId: string
  purpose: AnalysisPurpose
  courseId: string
  effectiveFrom: Date
  effectiveTo: Date | null
  eligible: boolean
}

export type AnalysisMessage = {
  id: string
  threadId: string
  participantId: string
  chatbotId: string
  courseId: string
  parentId: string | null
  role: 'user' | 'assistant' | string
  createdAt: Date
  rating: 'UP' | 'DOWN' | null
  text: string
  attachmentCount: number
  creditsUsed: number | null
  chatMode?: string | null
  modelId?: string | null
}

export type AnalysisRecordProvider = {
  /**
   * Returns records in the requested window plus the minimal parent closure
   * needed to classify exchange lineage. Providers must not load an unbounded
   * thread or course history.
   */
  loadMessages: (input: { from: Date; to: Date }) => Promise<AnalysisMessage[]>
  loadEligibility: (input: {
    participantIds: string[]
    purpose: AnalysisPurpose
    courseIds: string[]
    from: Date
    to: Date
  }) => Promise<EligibilityDecision[]>
}

export type AnalysisWindow = {
  from: Date
  to: Date
}

export type EligibleAnalysis = {
  messages: AnalysisMessage[]
  excludedMessageIds: string[]
}

export type ExchangeStatus =
  | 'linked'
  | 'ambiguous'
  | 'absent'
  | 'outside_window'

export type AnalysisExchange = {
  userMessage: AnalysisMessage
  assistantMessage: AnalysisMessage | null
  status: ExchangeStatus
  candidateAssistantIds: string[]
}

export type RatingCoverage = {
  ratedResponses: number
  unratedResponses: number
  up: number
  down: number
  coverage: number
}

export type AnalysisCoreResult = {
  eligible: EligibleAnalysis
  exchanges: AnalysisExchange[]
  ratingCoverage: RatingCoverage
}

function isWithinWindow(date: Date, window: AnalysisWindow) {
  return date >= window.from && date <= window.to
}

function intervalIncludes(decision: EligibilityDecision, date: Date) {
  return (
    decision.effectiveFrom <= date &&
    (decision.effectiveTo === null || decision.effectiveTo >= date)
  )
}

/**
 * Selects records only when an explicit purpose decision covers their message
 * timestamp. Missing, inactive, mismatched, and withdrawn decisions exclude the
 * record; an analytics run never treats an absent flag as consent.
 */
export function selectEligibleMessages(
  messages: AnalysisMessage[],
  decisions: EligibilityDecision[],
  purpose: AnalysisPurpose,
  window: AnalysisWindow
): EligibleAnalysis {
  const byParticipant = new Map<string, EligibilityDecision[]>()
  for (const decision of decisions) {
    const values = byParticipant.get(decision.participantId) ?? []
    values.push(decision)
    byParticipant.set(decision.participantId, values)
  }

  const eligible: AnalysisMessage[] = []
  const excludedMessageIds: string[] = []
  for (const message of messages) {
    const covering = (byParticipant.get(message.participantId) ?? []).filter(
      (decision) =>
        decision.purpose === purpose &&
        decision.courseId === message.courseId &&
        intervalIncludes(decision, message.createdAt)
    )
    const withdrawn = covering.some((decision) => !decision.eligible)
    const grants = covering.filter((decision) => decision.eligible)
    if (
      isWithinWindow(message.createdAt, window) &&
      !withdrawn &&
      grants.length === 1
    ) {
      eligible.push(message)
    } else {
      excludedMessageIds.push(message.id)
    }
  }

  return { messages: eligible, excludedMessageIds }
}

function compareMessages(a: AnalysisMessage, b: AnalysisMessage) {
  const createdAt = a.createdAt.getTime() - b.createdAt.getTime()
  return createdAt !== 0 ? createdAt : a.id.localeCompare(b.id)
}

/**
 * Pairs only a unique assistant child of a user message. Multiple children are
 * preserved as ambiguous; no timestamp heuristic chooses a regenerated answer.
 */
export function buildExchanges(
  messages: AnalysisMessage[],
  window: AnalysisWindow
): AnalysisExchange[] {
  const byParent = new Map<string, AnalysisMessage[]>()
  const inWindowIds = new Set(
    messages
      .filter((message) => isWithinWindow(message.createdAt, window))
      .map((message) => message.id)
  )

  for (const message of messages) {
    if (message.parentId) {
      const values = byParent.get(message.parentId) ?? []
      values.push(message)
      byParent.set(message.parentId, values)
    }
  }

  return messages
    .filter(
      (message) =>
        message.role === 'user' && isWithinWindow(message.createdAt, window)
    )
    .sort(compareMessages)
    .map((userMessage) => {
      const candidates = (byParent.get(userMessage.id) ?? [])
        .filter((message) => message.role === 'assistant')
        .sort(compareMessages)
      if (candidates.length > 1) {
        return {
          userMessage,
          assistantMessage: null,
          status: 'ambiguous',
          candidateAssistantIds: candidates.map((message) => message.id),
        }
      }
      if (candidates.length === 1) {
        const assistant = candidates[0]!
        return {
          userMessage,
          assistantMessage: inWindowIds.has(assistant.id) ? assistant : null,
          status: inWindowIds.has(assistant.id) ? 'linked' : 'outside_window',
          candidateAssistantIds: [assistant.id],
        }
      }

      const hasOutsideWindowChild = messages.some(
        (message) =>
          message.parentId === userMessage.id && message.role === 'assistant'
      )
      return {
        userMessage,
        assistantMessage: null,
        status: hasOutsideWindowChild ? 'outside_window' : 'absent',
        candidateAssistantIds: [],
      }
    })
}

export function calculateRatingCoverage(
  exchanges: AnalysisExchange[]
): RatingCoverage {
  const responses = exchanges
    .map((exchange) => exchange.assistantMessage)
    .filter((message): message is AnalysisMessage => message !== null)
  const up = responses.filter((message) => message.rating === 'UP').length
  const down = responses.filter((message) => message.rating === 'DOWN').length
  const ratedResponses = up + down
  return {
    ratedResponses,
    unratedResponses: responses.length - ratedResponses,
    up,
    down,
    coverage: responses.length > 0 ? ratedResponses / responses.length : 0,
  }
}

export async function runAnalysisCore(
  provider: AnalysisRecordProvider,
  input: {
    purpose: AnalysisPurpose
    window: AnalysisWindow
  }
): Promise<AnalysisCoreResult> {
  const messages = await provider.loadMessages(input.window)
  const participantIds = [
    ...new Set(messages.map((message) => message.participantId)),
  ]
  const courseIds = [...new Set(messages.map((message) => message.courseId))]
  const decisions = await provider.loadEligibility({
    participantIds,
    purpose: input.purpose,
    courseIds,
    from: input.window.from,
    to: input.window.to,
  })
  const eligible = selectEligibleMessages(
    messages,
    decisions,
    input.purpose,
    input.window
  )
  const eligibleIds = new Set(eligible.messages.map((message) => message.id))
  // Only out-of-window replies may enter lineage classification; admitting an
  // in-window ineligible reply would expose its content through assistantMessage.
  const lineageMessages = messages.filter(
    (message) =>
      message.role === 'assistant' &&
      message.parentId !== null &&
      !eligibleIds.has(message.id) &&
      eligibleIds.has(message.parentId) &&
      !isWithinWindow(message.createdAt, input.window)
  )
  const exchanges = buildExchanges(
    [...eligible.messages, ...lineageMessages],
    input.window
  )
  const ratingCoverage = calculateRatingCoverage(exchanges)
  return {
    eligible,
    exchanges,
    ratingCoverage,
  }
}
