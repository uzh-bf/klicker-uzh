/**
 * Transactional writer for the immutable chatbot prompt catalog (ADR 0037).
 *
 * All functions run inside a caller-supplied transaction. Lock order is
 * always chatbot first, then its mode rows, so concurrent writers touching
 * different modes of one bot cannot deadlock.
 *
 * No GraphQL prompt-authoring operation is exposed here yet; lecturer-facing
 * authoring arrives in a later slice.
 */

import type { Prisma } from './prisma/client/client.js'

export type PromptCatalogModeInput = {
  key: string
  /** Authored base text for version 1, before runtime contracts. */
  prompt: string
  description?: string | null
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
  // Serialize concurrent initializers on the same chatbot row.
  await tx.$queryRaw`SELECT id FROM "Chatbot" WHERE id = ${chatbotId}::uuid FOR UPDATE`

  for (const mode of modes) {
    const existing = await tx.chatbotMode.findUnique({
      where: { chatbotId_key: { chatbotId, key: mode.key } },
      select: { activePromptVersion: { select: { authoredPrompt: true } } },
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
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      })
      await tx.chatbotMode.update({
        where: { id: created.id },
        data: { activePromptVersionId: created.versions[0]!.id },
      })
      continue
    }

    const activeText = existing.activePromptVersion?.authoredPrompt
    if (activeText != null && activeText !== mode.prompt) {
      throw new Error(
        `PROMPT_CATALOG_DISAGREEMENT mode=${mode.key} existing_len=${activeText.length} incoming_len=${mode.prompt.length}`
      )
    }
  }
}
