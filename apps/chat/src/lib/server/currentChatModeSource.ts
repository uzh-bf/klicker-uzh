import { resolveOwnerPreviewModeConfigurations } from './previewAuthoringConfig'
import type { MCPServerWithConfig } from '../../services/mcpClients'
import { RequiredMCPUnavailableError } from './mcpRuntimePolicy'
import { prisma } from '@klicker-uzh/prisma'
import {
  knowledgeBaseScopeMatches,
  resolveModeKnowledgeBaseScope,
  type MCPScopedConfiguration,
  type ResolvedModeKnowledgeBaseScope,
} from '../../services/mcpScope'
import {
  resolveEffectiveChatModeOptions,
  resolveEffectiveMCPConfigurations,
} from './effectiveChatModes'
import { readMessageRetrievalSource } from './messageKnowledgeBaseProvenance'

function readChatbotSources(chatbotId: string) {
  return prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: {
      customModeConfig: true,
      standardModeConfig: true,
      draftConfig: true,
      systemPrompts: true,
      ownerId: true,
      status: true,
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
}

type SourceSnapshot = NonNullable<
  Awaited<ReturnType<typeof readChatbotSources>>
>

function currentModeScope(
  chatbot: SourceSnapshot,
  selectedMode: string,
  ownerPreview: boolean
) {
  const config = ownerPreview
    ? resolveOwnerPreviewModeConfigurations(chatbot)
    : chatbot
  const modes = resolveEffectiveChatModeOptions(
    chatbot.systemPrompts,
    chatbot.mcpConfigurations,
    config.standardModeConfig,
    {
      customModeConfig: config.customModeConfig,
      allowUnapprovedModes: ownerPreview,
    }
  )
  if (!Object.hasOwn(modes, selectedMode))
    throw new RequiredMCPUnavailableError('scope_violation')
  return resolveModeKnowledgeBaseScope({
    customModeConfig: config.customModeConfig,
    selectedMode,
    knowledgeBaseLinks: chatbot.knowledgeBases.map((link) =>
      link.kb.ownerId === chatbot.ownerId ? link : { ...link, isEnabled: false }
    ),
    configurations: chatbot.mcpConfigurations,
    effectiveConfigurations: resolveEffectiveMCPConfigurations(
      chatbot.mcpConfigurations,
      selectedMode
    ),
  })
}

export async function revalidateModeSource(
  chatbotId: string,
  selectedMode: string,
  expected: ResolvedModeKnowledgeBaseScope<MCPScopedConfiguration>,
  previewOwnerId?: string
): Promise<void> {
  try {
    const chatbot = await readChatbotSources(chatbotId)
    if (
      !chatbot ||
      (previewOwnerId !== undefined
        ? chatbot.ownerId !== previewOwnerId || chatbot.status === 'PAUSED'
        : chatbot.status !== 'PUBLISHED')
    )
      throw new RequiredMCPUnavailableError('scope_violation')
    if (
      !knowledgeBaseScopeMatches(
        currentModeScope(chatbot, selectedMode, previewOwnerId !== undefined),
        expected
      )
    )
      throw new RequiredMCPUnavailableError('scope_violation')
  } catch {
    throw new RequiredMCPUnavailableError('scope_violation')
  }
}

/**
 * Knowledge-base scope that may still authorize bytes or frames referenced by
 * a stored assistant message.
 *
 * A managed chatbot needs the turn's original link provenance, re-resolved
 * against the currently approved mode. Legacy chatbots without any link row
 * keep the pre-link scope path. Both callers read the message first, so this
 * never widens access for a message the caller did not already own.
 */
export async function readMessageKnowledgeBaseScope({
  chatbotId,
  chatMode,
  content,
}: {
  chatbotId: string
  chatMode: string | null
  content: unknown
}): Promise<string[] | null> {
  const chatbot = await readChatbotSources(chatbotId)
  if (!chatbot) return null

  const provenance = readMessageRetrievalSource(content)
  const managed = chatbot.knowledgeBases.length > 0
  // Ambiguous evidence is unavailable: a managed turn without a marker, a
  // marker that names another mode, or a marker on an unmanaged chatbot.
  if (
    managed &&
    (!provenance || !chatMode || provenance.chatMode !== chatMode)
  ) {
    return null
  }
  if (!managed && provenance) return null

  const selectedMode = managed ? provenance!.chatMode : chatMode
  if (!selectedMode) return null

  try {
    const scope = currentModeScope(chatbot, selectedMode, false)

    if (!managed) return scope.kbIds ?? null
    // The producing link must still be the mode's current live selection.
    if (
      !scope.link ||
      !provenance ||
      scope.link.id !== provenance.kbLinkId ||
      scope.link.kbId !== provenance.kbId
    ) {
      return null
    }
    return [scope.link.kbId]
  } catch {
    return null
  }
}

export async function loadCanonicalModeDocQuery(
  kbId: string
): Promise<MCPServerWithConfig> {
  const server = await prisma.chatbotMCPServer.findUnique({
    where: { name: 'KB' },
  })
  if (!server?.isActive)
    throw new RequiredMCPUnavailableError('scope_violation')
  return {
    server: {
      ...server,
      authSecret: server.authSecret ?? undefined,
      chatbotIdHeader: server.chatbotIdHeader ?? undefined,
    },
    config: {
      allowedTools: ['doc_query'],
      parameters: { required: true, toolAlias: 'doc_query', kb_id: kbId },
      priority: 0,
    },
  }
}
