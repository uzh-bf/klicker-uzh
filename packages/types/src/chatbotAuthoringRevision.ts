import type {
  ChatbotStatus,
  CreditResetPeriod,
} from '@klicker-uzh/prisma/client'
import type { ChatbotStandardModeConfig } from './chatbotStandardModeConfig.js'

/**
 * The allowlisted chatbot setup fields held in a saved authoring revision.
 * Runtime dependencies such as prompts, MCP servers, and knowledge-base
 * bindings deliberately do not belong to this snapshot.
 */
export type ChatbotAuthoringRevision = {
  name: string
  description: string | null
  avatar: string | null
  standardModeConfig: ChatbotStandardModeConfig | null
  modelSelection: boolean
  allowedModelIds: string[]
  allowedReasoningEffortsByModel: Record<string, string[]> | null
  creditInitialCredits: number
  creditResetPeriod: CreditResetPeriod
  creditResetAmount: number
  creditMaxCredits: number
  disclaimerTitle: string | null
  disclaimerIntroText: string | null
  publicationUseCase: string | null
  expectedStudentCount: number | null

  /** Revisions saved before these fields existed inherit the live flags. */
  knowledgeGraphVisible: boolean
  knowledgeGraphRetrievalEnabled: boolean

  /** Internal link for a staged disclaimer; never exposed in GraphQL. */
  disclaimerId?: string | null
}

/** Safe owner/admin projection metadata for a saved revision. */
export type ChatbotAuthoringRevisionProjection = ChatbotAuthoringRevision & {
  version: number
  status: ChatbotStatus
  reviewComment: string | null
  chatbotId?: string
}
