import { resolveOwnerPreviewModeConfigurations } from '@/src/lib/server/previewAuthoringConfig'
import { prisma } from '@klicker-uzh/prisma'
import { ChatbotStatus } from '@klicker-uzh/prisma/client'
import { authorizeIdentityForChatbot } from '@/src/lib/server/apiGuards'
import { isChatbotGraphRetrievalEnabled } from '@/src/lib/server/featureFlags'
import {
  getPublishedKnowledgeGraph,
  type PublishedKnowledgeGraph,
  readKnowledgeGraphSearchHints,
} from '@/src/lib/server/knowledgeGraphRuntime'
import { GUEST_ACCOUNT_TYPE } from '@/src/lib/server/ltiGuest'
import { RequiredMCPUnavailableError } from '@/src/lib/server/mcpRuntimePolicy'
import { resolveEffectiveMCPConfigurations } from '@/src/lib/server/effectiveChatModes'
import type { GraphQueryDependencies } from './graphAssistedDocQuery'
import type { MCPRequestContext } from './mcpClients'
import {
  resolveModeKnowledgeBaseScope,
  ownedKnowledgeBaseLinks,
} from './mcpScope'

export function graphQueryDependencies(
  context: MCPRequestContext
): GraphQueryDependencies {
  let publication: PublishedKnowledgeGraph | undefined
  return {
    async validateScope() {
      const ownerPreview = context.ownerPreviewUserId !== undefined
      if (ownerPreview) {
        if (context.participantId || !context.ownerPreviewUserId)
          throw new RequiredMCPUnavailableError()
      } else {
        await validateParticipantScope(context)
      }
      if (!context.chatMode) throw new RequiredMCPUnavailableError()
      const chatbot = await prisma.chatbot.findUnique({
        where: { id: context.chatbotId },
        select: {
          knowledgeGraphRetrievalEnabled: true,
          ownerId: true,
          status: true,
          customModeConfig: true,
          standardModeConfig: true,
          draftConfig: true,
          knowledgeBases: {
            select: {
              id: true,
              kbId: true,
              isEnabled: true,
              isDefault: true,
              kb: {
                select: {
                  deletedAt: true,
                  ownerId: true,
                  knowledgeGraphEnabled: true,
                  name: true,
                },
              },
            },
            orderBy: { id: 'asc' },
          },
          mcpConfigurations: {
            select: {
              allowedTools: true,
              chatMode: true,
              isEnabled: true,
              parameters: true,
              priority: true,
              mcpServer: { select: { id: true, name: true } },
            },
            orderBy: { priority: 'asc' },
          },
        },
      })
      if (
        !chatbot ||
        (ownerPreview &&
          (chatbot.ownerId !== context.ownerPreviewUserId ||
            chatbot.status === ChatbotStatus.PAUSED))
      ) {
        throw new RequiredMCPUnavailableError()
      }

      let scope
      try {
        scope = resolveModeKnowledgeBaseScope({
          customModeConfig: ownerPreview
            ? resolveOwnerPreviewModeConfigurations(chatbot).customModeConfig
            : chatbot.customModeConfig,
          selectedMode: context.chatMode,
          knowledgeBaseLinks: ownedKnowledgeBaseLinks(
            chatbot.knowledgeBases,
            chatbot.ownerId
          ),
          configurations: chatbot.mcpConfigurations,
          effectiveConfigurations: resolveEffectiveMCPConfigurations(
            chatbot.mcpConfigurations,
            context.chatMode
          ),
        })
      } catch {
        throw new RequiredMCPUnavailableError()
      }

      const actual = scope.kbIds ?? []
      const expected = [...(context.kbIds ?? [])].sort()
      if (
        actual.length !== 1 ||
        expected.length !== 1 ||
        actual.length !== expected.length ||
        actual.some((id, index) => id !== expected[index]) ||
        // The mode's live link must still be the one the document tool was
        // admitted for, so a re-pointed default cannot redirect graph hints.
        (scope.link
          ? context.kbLinkId !== scope.link.id
          : context.kbLinkId !== undefined)
      )
        throw new RequiredMCPUnavailableError()
      publication = undefined
      if (
        !chatbot.knowledgeGraphRetrievalEnabled ||
        !(await isChatbotGraphRetrievalEnabled(chatbot.ownerId)) ||
        !scope.link ||
        scope.link.kb?.knowledgeGraphEnabled !== true
      )
        return { enabled: false }
      try {
        const candidate = await getPublishedKnowledgeGraph(
          prisma,
          scope.link.kbId
        )
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

async function validateParticipantScope(context: MCPRequestContext) {
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
    (context.authMode === 'account' ? !participant.isActive || guest : !guest)
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
}
