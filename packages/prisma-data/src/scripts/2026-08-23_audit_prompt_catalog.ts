import {
  ensureChatbotPromptCatalog,
  prisma,
  projectLegacySystemPrompts,
} from '@klicker-uzh/prisma'

/**
 * Values-free audit/bootstrap for the chatbot prompt catalog (ADR 0037).
 *
 * Dry-run by default: reports counts and booleans only, never prompt text.
 * Checks every chatbot against the deterministic legacy projection:
 * wholly missing catalogs, missing active versions, projection
 * disagreements, and cross-lineage effective references. With --apply,
 * initializes ONLY wholly missing catalogs; any disagreement fails closed
 * and is never rewritten.
 */

const APPLY_FLAG = '--apply'
const apply = process.argv.includes(APPLY_FLAG)

async function run(): Promise<void> {
  const chatbots = await prisma.chatbot.findMany({
    select: {
      id: true,
      systemPrompts: true,
      modes: {
        select: {
          key: true,
          activePromptVersionId: true,
          activePromptVersion: { select: { authoredPrompt: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  let missingCatalogCount = 0
  let malformedJsonCount = 0
  let disagreementCount = 0
  let initializedCount = 0

  for (const bot of chatbots) {
    const projection = projectLegacySystemPrompts(bot.systemPrompts)
    if (!projection.isValid) {
      malformedJsonCount += 1
      console.log(`chatbot=${bot.id} status=MALFORMED_LEGACY_JSON`)
      continue
    }

    if (bot.modes.length === 0) {
      missingCatalogCount += 1
      console.log(
        `chatbot=${bot.id} status=MISSING_CATALOG mode_count=${projection.modes.length} can_initialize=true`
      )

      if (apply) {
        // Wholly-missing catalog: initialize version rows straight from the
        // legacy projection. Any disagreement inside the service fails closed.
        await prisma.$transaction(async (tx) => {
          await ensureChatbotPromptCatalog(tx, bot.id, projection.modes)
        })
        initializedCount += 1
      }
      continue
    }

    // Catalog exists: every projected mode must have an enabled active row
    // whose authored text matches the legacy projection exactly.
    const projectedByKey = new Map(
      projection.modes.map((mode) => [mode.key, mode])
    )
    for (const projected of projection.modes) {
      const existing = bot.modes.find((mode) => mode.key === projected.key)
      if (!existing) {
        disagreementCount += 1
        console.log(
          `chatbot=${bot.id} status=DISAGREEMENT kind=MISSING_MODE mode=${projected.key}`
        )
        continue
      }
      if (!existing.activePromptVersionId) {
        disagreementCount += 1
        console.log(
          `chatbot=${bot.id} status=DISAGREEMENT kind=MISSING_ACTIVE_VERSION mode=${existing.key}`
        )
        continue
      }
      if (!existing.activePromptVersion) {
        disagreementCount += 1
        console.log(
          `chatbot=${bot.id} status=DISAGREEMENT kind=MISSING_ACTIVE_VERSION`
        )
        continue
      }
      if (existing.activePromptVersion.authoredPrompt !== projected.prompt) {
        disagreementCount += 1
        console.log(`chatbot=${bot.id} status=DISAGREEMENT kind=TEXT_MISMATCH`)
      }
    }

    for (const existing of bot.modes) {
      if (!projectedByKey.has(existing.key)) {
        disagreementCount += 1
        console.log(
          `chatbot=${bot.id} status=DISAGREEMENT kind=UNPROJECTED_MODE`
        )
      }
    }
  }

  // A message must reference a prompt that belongs to its own chatbot.
  const crossLineageRows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "ChatMessage" msg
    JOIN "ChatThread" t ON t."id" = msg."threadId"
    JOIN "ChatbotEffectiveSystemPrompt" esp ON esp."id" = msg."effectiveSystemPromptId"
    JOIN "ChatbotModePromptVersion" v ON v."id" = esp."modePromptVersionId"
    JOIN "ChatbotMode" m ON m."id" = v."modeId"
    WHERE m."chatbotId" <> t."chatbotId"
  `
  const crossLineageRefs = crossLineageRows[0]?.count ?? 0n

  console.log(`summary_chatbots_total=${chatbots.length}`)
  console.log(`summary_missing_catalog=${missingCatalogCount}`)
  console.log(`summary_malformed_json=${malformedJsonCount}`)
  console.log(`summary_disagreements=${disagreementCount}`)
  console.log(`summary_cross_lineage_refs=${crossLineageRefs}`)
  console.log(`summary_initialized_with_apply=${initializedCount}`)
  console.log(`mode=${apply ? 'APPLY' : 'DRY_RUN'}`)
}

try {
  await run()
} catch (error) {
  console.error(
    `ERROR: ${error instanceof Error ? error.message : String(error)}`
  )
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
