/**
 * Transactional writer for the immutable chatbot prompt catalog (ADR 0043).
 *
 * All functions run inside a caller-supplied transaction. Lock order is
 * always chatbot first, then its mode rows, so concurrent writers touching
 * different modes of one bot cannot deadlock.
 *
 * No GraphQL prompt-authoring operation is exposed here yet; lecturer-facing
 * authoring arrives in a later slice.
 */

import type { ChatbotModePromptStatus, Prisma } from './prisma/client/client.js'
import { projectLegacySystemPrompts } from './chatbotPromptProjection.js'

export type PromptCatalogModeInput = {
  key: string
  /** Authored base text for version 1, before runtime contracts. */
  prompt: string
  description?: string | null
}

type LockedChatbot = {
  id: string
  systemPrompts: Prisma.JsonValue | null
}

type LockedMode = {
  id: string
  description: string | null
  status: ChatbotModePromptStatus
  activePromptVersionId: string | null
  authoredPrompt: string | null
}

function catalogError(reason: string): Error {
  return new Error('PROMPT_CATALOG_' + reason)
}

async function lockChatbot(
  tx: Prisma.TransactionClient,
  chatbotId: string
): Promise<LockedChatbot> {
  const rows = await tx.$queryRaw<LockedChatbot[]>`
    SELECT "id", "systemPrompts"
    FROM "Chatbot"
    WHERE "id" = ${chatbotId}::uuid
    FOR UPDATE
  `
  const chatbot = rows[0]
  if (!chatbot) throw catalogError('CHATBOT_NOT_FOUND')
  return chatbot
}

async function lockMode(
  tx: Prisma.TransactionClient,
  chatbotId: string,
  modeKey: string
): Promise<LockedMode> {
  const rows = await tx.$queryRaw<LockedMode[]>`
    SELECT
      m."id",
      m."description",
      m."status",
      m."activePromptVersionId",
      v."authoredPrompt"
    FROM "ChatbotMode" m
    LEFT JOIN "ChatbotModePromptVersion" v
      ON v."id" = m."activePromptVersionId"
    WHERE m."chatbotId" = ${chatbotId}::uuid AND m."key" = ${modeKey}
    FOR UPDATE OF m
  `
  const mode = rows[0]
  if (!mode) throw catalogError('MODE_NOT_FOUND mode=' + modeKey)
  if (!mode.activePromptVersionId || mode.authoredPrompt == null) {
    throw catalogError('MISSING_ACTIVE_VERSION mode=' + modeKey)
  }
  return mode
}

function getProjectedMode(
  systemPrompts: Prisma.JsonValue | null,
  modeKey: string
): PromptCatalogModeInput {
  const projection = projectLegacySystemPrompts(systemPrompts)
  if (!projection.isValid) throw catalogError('MALFORMED_LEGACY_PROJECTION')

  const mode = projection.modes.find((item) => item.key === modeKey)
  if (!mode) throw catalogError('DISAGREEMENT mode=' + modeKey)
  return mode
}

function requireProjectedMode(
  systemPrompts: Prisma.JsonValue | null,
  expected: PromptCatalogModeInput
): void {
  const projected = getProjectedMode(systemPrompts, expected.key)
  if (
    projected.prompt !== expected.prompt ||
    projected.description !== (expected.description ?? null)
  ) {
    throw catalogError('DISAGREEMENT mode=' + expected.key)
  }
}

function requireInitializerProjection(
  systemPrompts: Prisma.JsonValue | null,
  modes: readonly PromptCatalogModeInput[]
): void {
  const projection = projectLegacySystemPrompts(systemPrompts)
  if (!projection.isValid) throw catalogError('MALFORMED_LEGACY_PROJECTION')

  if (
    new Set(modes.map((mode) => mode.key)).size !== modes.length ||
    projection.modes.length !== modes.length
  ) {
    throw catalogError('INITIALIZER_PROJECTION_MISMATCH')
  }
  for (const mode of modes) requireProjectedMode(systemPrompts, mode)
}

function updateLegacyModeEntry(
  systemPrompts: Prisma.JsonValue | null,
  modeKey: string,
  patch: Prisma.InputJsonObject
): Prisma.InputJsonObject {
  if (
    systemPrompts != null &&
    (typeof systemPrompts !== 'object' || Array.isArray(systemPrompts))
  ) {
    throw catalogError('MALFORMED_LEGACY_PROJECTION')
  }

  const root = { ...(systemPrompts ?? {}) } as Prisma.JsonObject
  const existing = root[modeKey]
  if (
    existing != null &&
    (typeof existing !== 'object' || Array.isArray(existing))
  ) {
    throw catalogError('MALFORMED_LEGACY_MODE mode=' + modeKey)
  }

  return {
    ...root,
    [modeKey]: {
      ...((existing ?? {}) as Prisma.JsonObject),
      ...patch,
    },
  } as Prisma.InputJsonObject
}

/**
 * Ensure each listed mode has an active version whose authored text matches
 * the input exactly. Missing modes are created with version 1; an existing
 * mode with different active text throws (history is never rewritten); a
 * matching mode is an idempotent no-op.
 */
export async function ensureChatbotPromptCatalog(
  tx: Prisma.TransactionClient,
  chatbotId: string,
  modes: readonly PromptCatalogModeInput[]
): Promise<void> {
  const chatbot = await lockChatbot(tx, chatbotId)
  requireInitializerProjection(chatbot.systemPrompts, modes)

  for (const mode of modes) {
    const existing = await tx.chatbotMode.findUnique({
      where: { chatbotId_key: { chatbotId, key: mode.key } },
      select: {
        description: true,
        activePromptVersion: { select: { authoredPrompt: true } },
      },
    })

    if (!existing) {
      const created = await tx.chatbotMode.create({
        data: {
          chatbotId,
          key: mode.key,
          description: mode.description ?? null,
          status: 'ENABLED',
          versions: {
            create: { version: 1, authoredPrompt: mode.prompt },
          },
        },
        select: {
          id: true,
          versions: { select: { id: true } },
        },
      })
      await tx.chatbotMode.update({
        where: { id: created.id },
        data: { activePromptVersionId: created.versions[0]!.id },
      })
      continue
    }

    const activeText = existing.activePromptVersion?.authoredPrompt
    if (
      activeText != null &&
      (activeText !== mode.prompt ||
        existing.description !== (mode.description ?? null))
    ) {
      throw catalogError(
        'DISAGREEMENT mode=' +
          mode.key +
          ' existing_len=' +
          activeText.length +
          ' incoming_len=' +
          mode.prompt.length
      )
    }
    if (activeText == null) {
      throw catalogError('MISSING_ACTIVE_VERSION mode=' + mode.key)
    }
  }
}

export type AppendedPromptVersion = {
  id: string
  version: number
}

/**
 * Record one accepted authored change. Identical text is still a new version.
 * The caller owns transaction boundaries; this function serializes writers
 * and updates the catalog and legacy compatibility projection atomically.
 */
export async function appendChatbotModePromptVersion(
  tx: Prisma.TransactionClient,
  chatbotId: string,
  modeKey: string,
  authoredPrompt: string
): Promise<AppendedPromptVersion> {
  const chatbot = await lockChatbot(tx, chatbotId)
  const mode = await lockMode(tx, chatbotId, modeKey)
  if (mode.status === 'RETIRED') {
    throw catalogError('MODE_RETIRED mode=' + modeKey)
  }
  requireProjectedMode(chatbot.systemPrompts, {
    key: modeKey,
    prompt: mode.authoredPrompt!,
    description: mode.description,
  })

  const aggregate = await tx.chatbotModePromptVersion.aggregate({
    where: { modeId: mode.id },
    _max: { version: true },
  })
  const version = (aggregate._max.version ?? 0) + 1
  const created = await tx.chatbotModePromptVersion.create({
    data: { modeId: mode.id, version, authoredPrompt },
    select: { id: true, version: true },
  })
  await tx.chatbotMode.update({
    where: { id: mode.id },
    data: { activePromptVersionId: created.id },
  })
  await tx.chatbot.update({
    where: { id: chatbotId },
    data: {
      systemPrompts: updateLegacyModeEntry(chatbot.systemPrompts, modeKey, {
        prompt: authoredPrompt,
      }),
    },
  })
  return created
}

/** Update mode lifecycle without creating authored prompt history. */
export async function updateChatbotModeStatus(
  tx: Prisma.TransactionClient,
  chatbotId: string,
  modeKey: string,
  status: ChatbotModePromptStatus
): Promise<void> {
  const chatbot = await lockChatbot(tx, chatbotId)
  const mode = await lockMode(tx, chatbotId, modeKey)
  if (mode.status === 'RETIRED' && status !== 'RETIRED') {
    throw catalogError('MODE_RETIRED mode=' + modeKey)
  }
  requireProjectedMode(chatbot.systemPrompts, {
    key: modeKey,
    prompt: mode.authoredPrompt!,
    description: mode.description,
  })
  if (mode.status === status) return

  await tx.chatbotMode.update({ where: { id: mode.id }, data: { status } })
}

export type ChatbotModePresentationUpdate = {
  name?: string | null
  description?: string | null
}

/** Update mode presentation fields without creating authored prompt history. */
export async function updateChatbotModePresentation(
  tx: Prisma.TransactionClient,
  chatbotId: string,
  modeKey: string,
  update: ChatbotModePresentationUpdate
): Promise<void> {
  const chatbot = await lockChatbot(tx, chatbotId)
  const mode = await lockMode(tx, chatbotId, modeKey)
  requireProjectedMode(chatbot.systemPrompts, {
    key: modeKey,
    prompt: mode.authoredPrompt!,
    description: mode.description,
  })

  const data: ChatbotModePresentationUpdate = {}
  if (update.name !== undefined) data.name = update.name
  if (update.description !== undefined) data.description = update.description
  if (Object.keys(data).length > 0) {
    await tx.chatbotMode.update({ where: { id: mode.id }, data })
  }
  if (update.description !== undefined) {
    await tx.chatbot.update({
      where: { id: chatbotId },
      data: {
        systemPrompts: updateLegacyModeEntry(chatbot.systemPrompts, modeKey, {
          description: update.description,
        }),
      },
    })
  }
}
