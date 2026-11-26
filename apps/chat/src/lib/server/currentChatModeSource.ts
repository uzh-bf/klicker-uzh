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
import {
  hasRetrievalSourceMarker,
  readMessageRetrievalSource,
} from './messageKnowledgeBaseProvenance'

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
          createdAt: true,
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

function modeConfiguration(chatbot: SourceSnapshot, ownerPreview: boolean) {
  return ownerPreview ? resolveOwnerPreviewModeConfigurations(chatbot) : chatbot
}

function isModeOffered(
  chatbot: SourceSnapshot,
  selectedMode: string,
  ownerPreview: boolean
): boolean {
  const config = modeConfiguration(chatbot, ownerPreview)
  const modes = resolveEffectiveChatModeOptions(
    chatbot.systemPrompts,
    chatbot.mcpConfigurations,
    config.standardModeConfig,
    {
      customModeConfig: config.customModeConfig,
      allowUnapprovedModes: ownerPreview,
    }
  )
  return Object.hasOwn(modes, selectedMode)
}

function ownedLinks(chatbot: SourceSnapshot) {
  return chatbot.knowledgeBases.map((link) =>
    link.kb.ownerId === chatbot.ownerId ? link : { ...link, isEnabled: false }
  )
}

function modeScope(
  chatbot: SourceSnapshot,
  selectedMode: string,
  ownerPreview: boolean
) {
  return resolveModeKnowledgeBaseScope({
    customModeConfig: modeConfiguration(chatbot, ownerPreview).customModeConfig,
    selectedMode,
    knowledgeBaseLinks: ownedLinks(chatbot),
    configurations: chatbot.mcpConfigurations,
    effectiveConfigurations: resolveEffectiveMCPConfigurations(
      chatbot.mcpConfigurations,
      selectedMode
    ),
  })
}

function currentModeScope(
  chatbot: SourceSnapshot,
  selectedMode: string,
  ownerPreview: boolean
) {
  if (!isModeOffered(chatbot, selectedMode, ownerPreview))
    throw new RequiredMCPUnavailableError('scope_violation')
  return modeScope(chatbot, selectedMode, ownerPreview)
}

/**
 * Scope for media in an assistant message stored before turns carried a
 * retrieval-source marker. Each chatbot then had at most one enabled link, so
 * a live link that already existed when the message was written and is still
 * the source of the message's mode is the link that produced it. A link
 * created later (for example after a detach and reattach) never qualifies.
 */
function unmarkedMessageKnowledgeBaseScope(
  chatbot: SourceSnapshot,
  chatMode: string | null,
  messageCreatedAt: Date | undefined
): string[] | null {
  // Older messages could be stored without a mode; they ran in tutor mode.
  const selectedMode = chatMode ?? 'tutor'
  const managed = chatbot.knowledgeBases.length > 0
  try {
    if (!managed) return modeScope(chatbot, selectedMode, false).kbIds ?? null
    if (!messageCreatedAt) return null

    // A mode that is no longer offered keeps the chatbot default, as before
    // per-mode sources existed. An offered mode must still resolve cleanly.
    const link = isModeOffered(chatbot, selectedMode, false)
      ? modeScope(chatbot, selectedMode, false).link
      : (ownedLinks(chatbot).find(
          (candidate) =>
            candidate.isEnabled &&
            candidate.isDefault &&
            candidate.kb.deletedAt === null
        ) ?? null)
    if (!link) return null
    const row = chatbot.knowledgeBases.find(({ id }) => id === link.id)
    if (!row || row.createdAt > messageCreatedAt) return null
    return [link.kbId]
  } catch {
    return null
  }
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
 * A marked turn needs its original link provenance, re-resolved against the
 * currently approved mode. A turn stored before markers existed keeps working
 * while its original source is still the mode's live source. Both callers read
 * the message first, so this never widens access for a message the caller did
 * not already own.
 */
export async function readMessageKnowledgeBaseScope({
  chatbotId,
  chatMode,
  content,
  createdAt,
}: {
  chatbotId: string
  chatMode: string | null
  content: unknown
  createdAt?: Date
}): Promise<string[] | null> {
  const chatbot = await readChatbotSources(chatbotId)
  if (!chatbot) return null

  if (!hasRetrievalSourceMarker(content)) {
    return unmarkedMessageKnowledgeBaseScope(chatbot, chatMode, createdAt)
  }

  const provenance = readMessageRetrievalSource(content)
  const managed = chatbot.knowledgeBases.length > 0
  // A present marker is never ignored: a malformed marker, one that names
  // another mode, or one on an unmanaged chatbot makes the evidence unavailable.
  if (
    !managed ||
    !provenance ||
    !chatMode ||
    provenance.chatMode !== chatMode
  ) {
    return null
  }

  try {
    const scope = currentModeScope(chatbot, provenance.chatMode, false)

    // Replay needs both the producing link and its live document access.
    if (
      !scope.hasDocQueryAccess ||
      scope.kbIds?.length !== 1 ||
      scope.kbIds?.[0] !== scope.link?.kbId ||
      !scope.link ||
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
