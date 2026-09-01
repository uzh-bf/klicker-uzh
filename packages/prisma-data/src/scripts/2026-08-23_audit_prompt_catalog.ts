import {
  ensureChatbotPromptCatalog,
  projectLegacySystemPrompts,
} from '@klicker-uzh/prisma'
import {
  ChatbotModePromptStatus,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Values-free audit/bootstrap for the chatbot prompt catalog (ADR 0043).
 *
 * Dry-run by default: reports aggregate counts and booleans only, never
 * identifiers, mode keys, or prompt text.
 * With --apply, initializes only wholly missing deterministic catalogs. Existing
 * disagreements always fail closed and are never rewritten.
 */

const APPLY_FLAG = '--apply'
const apply = process.argv.includes(APPLY_FLAG)

type CatalogMode = {
  id: string
  key: string
  description: string | null
  status: ChatbotModePromptStatus
  activePromptVersion: {
    modeId: string
    version: number
    authoredPrompt: string
  } | null
  versions: { version: number }[]
}

type StructuralCounts = {
  enabledMissingActive: number
  crossModeActive: number
  sequenceGap: number
  activeNotLatest: number
}

function auditCatalogStructure(
  modes: readonly CatalogMode[]
): StructuralCounts {
  const counts: StructuralCounts = {
    enabledMissingActive: 0,
    crossModeActive: 0,
    sequenceGap: 0,
    activeNotLatest: 0,
  }

  for (const mode of modes) {
    const active = mode.activePromptVersion
    const sameModeActive = active?.modeId === mode.id ? active : null
    if (
      mode.status === ChatbotModePromptStatus.ENABLED &&
      sameModeActive == null
    ) {
      counts.enabledMissingActive += 1
    }
    if (active != null && active.modeId !== mode.id) {
      counts.crossModeActive += 1
    }

    const versions = mode.versions
      .map((version) => version.version)
      .sort((left, right) => left - right)
    if (
      versions.length === 0 ||
      versions.some((version, index) => version !== index + 1)
    ) {
      counts.sequenceGap += 1
    }

    const latestVersion = versions.at(-1)
    if (
      sameModeActive != null &&
      latestVersion != null &&
      sameModeActive.version !== latestVersion
    ) {
      counts.activeNotLatest += 1
    }
  }

  return counts
}

function countProjectionDisagreements(
  projectedModes: readonly {
    key: string
    prompt: string
    description?: string | null
  }[],
  modes: readonly CatalogMode[]
): number {
  let count = 0
  const projectedByKey = new Map(projectedModes.map((mode) => [mode.key, mode]))

  for (const projected of projectedModes) {
    const existing = modes.find((mode) => mode.key === projected.key)
    if (existing == null) {
      count += 1
      continue
    }

    if (existing.description !== (projected.description ?? null)) {
      count += 1
    }

    const active = existing.activePromptVersion
    if (
      active?.modeId === existing.id &&
      active.authoredPrompt !== projected.prompt
    ) {
      count += 1
    }
  }

  for (const existing of modes) {
    if (!projectedByKey.has(existing.key)) {
      count += 1
    }
  }

  return count
}

function addStructuralCounts(
  total: StructuralCounts,
  next: StructuralCounts
): void {
  total.enabledMissingActive += next.enabledMissingActive
  total.crossModeActive += next.crossModeActive
  total.sequenceGap += next.sequenceGap
  total.activeNotLatest += next.activeNotLatest
}

async function countCrossLineageReferences(
  prisma: PrismaClient
): Promise<bigint> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "ChatMessage" msg
    JOIN "ChatThread" t ON t."id" = msg."threadId"
    JOIN "ChatbotEffectiveSystemPrompt" esp ON esp."id" = msg."effectiveSystemPromptId"
    JOIN "ChatbotModePromptVersion" v ON v."id" = esp."modePromptVersionId"
    JOIN "ChatbotMode" m ON m."id" = v."modeId"
    WHERE m."chatbotId" <> t."chatbotId"
  `
  return rows[0]?.count ?? 0n
}

async function run(prisma: PrismaClient): Promise<void> {
  const chatbots = await prisma.chatbot.findMany({
    select: {
      id: true,
      systemPrompts: true,
      modes: {
        select: {
          id: true,
          key: true,
          description: true,
          status: true,
          activePromptVersion: {
            select: {
              modeId: true,
              version: true,
              authoredPrompt: true,
            },
          },
          versions: { select: { version: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  let missingCatalogCount = 0
  let malformedJsonCount = 0
  let projectionDisagreementCount = 0
  let initializedCount = 0
  let initializationFailureCount = 0
  const structuralCounts: StructuralCounts = {
    enabledMissingActive: 0,
    crossModeActive: 0,
    sequenceGap: 0,
    activeNotLatest: 0,
  }

  for (const bot of chatbots) {
    addStructuralCounts(structuralCounts, auditCatalogStructure(bot.modes))
    const projection = projectLegacySystemPrompts(bot.systemPrompts)
    if (!projection.isValid) {
      malformedJsonCount += 1
      continue
    }

    if (bot.modes.length === 0) {
      missingCatalogCount += 1
      if (apply) {
        try {
          await prisma.$transaction((tx) =>
            ensureChatbotPromptCatalog(tx, bot.id, projection.modes)
          )
          initializedCount += 1
        } catch {
          initializationFailureCount += 1
        }
      }
      continue
    }

    projectionDisagreementCount += countProjectionDisagreements(
      projection.modes,
      bot.modes
    )
  }

  const crossLineageRefs = await countCrossLineageReferences(prisma)
  const disagreementCount =
    projectionDisagreementCount +
    structuralCounts.enabledMissingActive +
    structuralCounts.crossModeActive +
    structuralCounts.sequenceGap +
    structuralCounts.activeNotLatest

  console.log(`summary_chatbots_total=${chatbots.length}`)
  console.log(`summary_missing_catalog=${missingCatalogCount}`)
  console.log(`summary_malformed_json=${malformedJsonCount}`)
  console.log(`summary_projection_disagreements=${projectionDisagreementCount}`)
  console.log(
    `summary_enabled_missing_same_mode_active=${structuralCounts.enabledMissingActive}`
  )
  console.log(
    `summary_cross_mode_active_pointers=${structuralCounts.crossModeActive}`
  )
  console.log(`summary_version_sequence_gaps=${structuralCounts.sequenceGap}`)
  console.log(
    `summary_active_version_not_latest=${structuralCounts.activeNotLatest}`
  )
  console.log(`summary_disagreements=${disagreementCount}`)
  console.log(`summary_cross_lineage_refs=${crossLineageRefs}`)
  console.log(`summary_initialized_with_apply=${initializedCount}`)
  console.log(`summary_initialization_failures=${initializationFailureCount}`)
  console.log(`execution=${apply ? 'APPLY' : 'DRY_RUN'}`)

  if (initializationFailureCount > 0) {
    process.exitCode = 1
  }
}

try {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter, log: [] })
  try {
    await run(prisma)
  } finally {
    await prisma.$disconnect()
  }
} catch {
  console.error('audit_failed=true')
  process.exitCode = 1
}
