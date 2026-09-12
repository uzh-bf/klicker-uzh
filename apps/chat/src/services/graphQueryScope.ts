import { prisma } from '@klicker-uzh/prisma'
import { authorizeIdentityForChatbot } from '@/src/lib/server/apiGuards'
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
      if (!context.participantId) throw new RequiredMCPUnavailableError()
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
      ) {
        throw new RequiredMCPUnavailableError()
      }
      const access = await authorizeIdentityForChatbot(
        { participantId: context.participantId, authMode: context.authMode },
        context.chatbotId
      )
      if (
        'response' in access ||
        !context.courseId ||
        access.chatbot.courseId !== context.courseId
      )
        throw new RequiredMCPUnavailableError()
      const chatbot = await prisma.chatbot.findUnique({
        where: { id: context.chatbotId },
        select: {
          knowledgeGraphRetrievalEnabled: true,
          knowledgeBases: {
            where: { isEnabled: true, kb: { deletedAt: null } },
            select: {
              kbId: true,
              kb: { select: { knowledgeGraphEnabled: true } },
            },
          },
        },
      })
      const actual =
        chatbot?.knowledgeBases.map((binding) => binding.kbId).sort() ?? []
      const expected = [...(context.kbIds ?? [])].sort()
      if (
        !chatbot ||
        actual.length === 0 ||
        actual.length !== expected.length ||
        actual.some((id, index) => id !== expected[index])
      )
        throw new RequiredMCPUnavailableError()
      publication = undefined
      if (
        !chatbot.knowledgeGraphRetrievalEnabled ||
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
