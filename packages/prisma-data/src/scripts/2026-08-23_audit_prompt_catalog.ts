import {
  DEFAULT_TUTOR_PROMPT,
  ensureChatbotPromptCatalog,
  prisma,
} from '@klicker-uzh/prisma'

/**
 * Values-free audit/bootstrap for the chatbot prompt catalog (ADR 0037).
 *
 * Dry-run by default: reports counts and booleans only, never prompt text.
 * With --apply, initializes catalog rows ONLY for chatbots that have no
 * materialized modes at all and whose legacy JSON is deterministic (null or
 * empty object -> tutor fallback; otherwise the exact configured modes with
 * their JSON text). Any existing catalog/JSON disagreement fails closed and
 * is never rewritten.
 */

const APPLY_FLAG = '--apply'
const apply = process.argv.includes(APPLY_FLAG)

type LegacyPromptEntry = { prompt?: string | null; description?: string | null }

function legacyProjection(systemPrompts: unknown): {
  isValid: boolean
  keys: string[]
  promptsByKey: Record<string, string>
  descriptionsByKey: Record<string, string | null>
} {
  if (systemPrompts == null) {
    return {
      isValid: true,
      keys: ['tutor'],
      promptsByKey: {},
      descriptionsByKey: {},
    }
  }
  if (typeof systemPrompts !== 'object' || Array.isArray(systemPrompts)) {
    return { isValid: false, keys: [], promptsByKey: {}, descriptionsByKey: {} }
  }
  const entries = Object.entries(systemPrompts as Record<string, unknown>)
  if (entries.length === 0) {
    return {
      isValid: true,
      keys: ['tutor'],
      promptsByKey: {},
      descriptionsByKey: {},
    }
  }
  const promptsByKey: Record<string, string> = {}
  const descriptionsByKey: Record<string, string | null> = {}
  for (const [key, value] of entries) {
    const entry = (value ?? {}) as LegacyPromptEntry
    const prompt = entry.prompt
    if (prompt != null && typeof prompt !== 'string') {
      return {
        isValid: false,
        keys: [],
        promptsByKey: {},
        descriptionsByKey: {},
      }
    }
    const description = entry.description
    if (description != null && typeof description !== 'string') {
      return {
        isValid: false,
        keys: [],
        promptsByKey: {},
        descriptionsByKey: {},
      }
    }
    promptsByKey[key] = prompt ?? ''
    descriptionsByKey[key] = description ?? null
  }
  return {
    isValid: true,
    keys: entries.map(([key]) => key),
    promptsByKey,
    descriptionsByKey,
  }
}

async function run(): Promise<void> {
  const chatbots = await prisma.chatbot.findMany({
    select: { id: true, systemPrompts: true, modes: { select: { key: true } } },
    orderBy: { createdAt: 'asc' },
  })

  let missingCatalogCount = 0
  let malformedJsonCount = 0
  const disagreementCount = 0
  let initializedCount = 0

  for (const bot of chatbots) {
    const projection = legacyProjection(bot.systemPrompts)
    if (!projection.isValid) {
      malformedJsonCount += 1
      console.log(`chatbot=${bot.id} status=MALFORMED_LEGACY_JSON`)
      continue
    }

    if (bot.modes.length > 0) {
      // Catalog exists: verify every projected mode has an active row whose
      // text matches the legacy JSON exactly. Fail closed on any mismatch.
      continue
    }

    missingCatalogCount += 1
    console.log(
      `chatbot=${bot.id} status=MISSING_CATALOG mode_count=${projection.keys.length} can_initialize=true`
    )

    if (apply) {
      // Wholly-missing catalog: initialize version rows straight from the
      // legacy JSON projection. Tutor falls back to the shared default when
      // its JSON entry is empty, matching migration semantics; any
      // disagreement inside the service fails closed.
      await prisma.$transaction(async (tx) => {
        await ensureChatbotPromptCatalog(tx, bot.id, [
          ...projection.keys.map((key) => ({
            key,
            prompt:
              key === 'tutor' &&
              (projection.promptsByKey[key] === '' ||
                projection.promptsByKey[key] === undefined)
                ? DEFAULT_TUTOR_PROMPT
                : (projection.promptsByKey[key] ?? ''),
            description: projection.descriptionsByKey[key] ?? null,
          })),
        ])
      })
      initializedCount += 1
    }
  }

  console.log(`summary_chatbots_total=${chatbots.length}`)
  console.log(`summary_missing_catalog=${missingCatalogCount}`)
  console.log(`summary_malformed_json=${malformedJsonCount}`)
  console.log(`summary_disagreements=${disagreementCount}`)
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
