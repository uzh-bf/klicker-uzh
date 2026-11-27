import { prisma } from '@klicker-uzh/prisma'
import { ChatbotStatus } from '@klicker-uzh/prisma/client'
import { assertCurrentChatbotKnowledgeAccess } from '@/src/lib/server/chatbotKnowledgeAccess'
import { isChatbotGraphRetrievalEnabled } from '@/src/lib/server/featureFlags'
import {
  getPublishedKnowledgeGraph,
  type PublishedKnowledgeGraph,
  readKnowledgeGraphSearchHints,
} from '@/src/lib/server/knowledgeGraphRuntime'
import { GUEST_ACCOUNT_TYPE } from '@/src/lib/server/ltiGuest'
import { RequiredMCPUnavailableError } from '@/src/lib/server/mcpRuntimePolicy'
import type { GraphQueryDependencies } from './graphAssistedDocQuery'
import type { MCPRequestContext } from './mcpClients'

export function graphQueryDependencies(
  context: MCPRequestContext
): GraphQueryDependencies {
  let publication: PublishedKnowledgeGraph | undefined
  return {
    async validateScope() {
      if (!context.kbIds?.length)
        throw new RequiredMCPUnavailableError('scope_violation')
      if (!context.ownerPreviewUserId) {
        if (!context.participantId)
          throw new RequiredMCPUnavailableError('scope_violation')
        const participant = await prisma.participant.findUnique({
          where: { id: context.participantId },
          select: { isActive: true, accounts: { select: { type: true } } },
        })
        const guest = participant?.accounts.some(
          (account) => account.type === GUEST_ACCOUNT_TYPE
        )
        if (
          !participant ||
          (context.authMode === 'account'
            ? !participant.isActive || guest
            : !guest)
        )
          throw new RequiredMCPUnavailableError('scope_violation')
      }
      const chatbot = await assertCurrentChatbotKnowledgeAccess({
        ...context,
        kbIds: context.kbIds,
      })
      const actual =
        chatbot.knowledgeBases.map((binding) => binding.kbId).sort() ?? []
      const expected = [...(context.kbIds ?? [])].sort()
      if (
        (context.ownerPreviewUserId &&
          chatbot.status === ChatbotStatus.PAUSED) ||
        actual.length === 0 ||
        actual.length !== expected.length ||
        actual.some((id, index) => id !== expected[index])
      )
        throw new RequiredMCPUnavailableError()
      publication = undefined
      if (
        !chatbot.knowledgeGraphRetrievalEnabled ||
        !(await isChatbotGraphRetrievalEnabled(chatbot.ownerId)) ||
        actual.length !== 1 ||
        !chatbot.knowledgeBases[0]?.kb.knowledgeGraphEnabled
      )
        return { enabled: false }
      try {
        const candidate = await getPublishedKnowledgeGraph(prisma, actual[0]!)
        if (!candidate.isStale) publication = candidate
      } catch {
        /* Missing or unavailable graph preserves authorized document retrieval. */
      }
      return {
        enabled: publication !== undefined,
        buildId: publication?.buildId,
      }
    },
    async hints(query) {
      const selected = publication
      return selected ? readKnowledgeGraphSearchHints(selected, query) : []
    },
  }
}
