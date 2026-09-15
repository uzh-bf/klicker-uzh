import { prisma } from '@klicker-uzh/prisma'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import {
  DEFAULT_BASE_CHAT_BUDGET_CREDITS,
  getZurichMonthStart,
} from '@klicker-uzh/util'

const APPLY_FLAG = '--apply'

export type BaseBudgetBackfillSummary = {
  monthStart: Date
  entitledOwners: number
  alreadyConfigured: number
  missing: number
  created: number
}

type BaseBudgetBackfillClient = Pick<PrismaClient, 'user' | 'chatAccountUsage'>

/**
 * Grants the default monthly base-class budget to every entitled account that
 * has no configured base budget at or before the current Zurich month.
 *
 * The grant is deliberately narrow. `getEffectiveChatAccountUsage` carries the
 * newest configured budget forward, so an account with history already has an
 * effective base budget and must be left alone: a fresh row would replace a
 * value an administrator set, and a past-month row would leak into every later
 * month. Only the current month is written, and only when no row exists at or
 * before it, which also makes the script idempotent - a second run finds every
 * entitled account configured and creates nothing. Existing rows are never
 * updated, so used credits and administrator budgets survive a re-run.
 */
export async function backfillChatBaseBudget({
  client = prisma as unknown as BaseBudgetBackfillClient,
  now = new Date(),
  apply = false,
}: {
  client?: BaseBudgetBackfillClient
  now?: Date
  apply?: boolean
} = {}): Promise<BaseBudgetBackfillSummary> {
  const monthStart = getZurichMonthStart(now)

  const owners = await client.user.findMany({
    where: { aiFeaturesEnabled: true },
    select: {
      id: true,
      chatAccountUsages: {
        where: { usageClass: 'BASE', monthStart: { lte: monthStart } },
        select: { ownerId: true },
      },
    },
  })

  const unconfigured = owners.filter(
    (owner) => owner.chatAccountUsages.length === 0
  )

  const created =
    apply && unconfigured.length > 0
      ? (
          await client.chatAccountUsage.createMany({
            data: unconfigured.map((owner) => ({
              ownerId: owner.id,
              usageClass: 'BASE' as const,
              monthStart,
              budgetCredits: DEFAULT_BASE_CHAT_BUDGET_CREDITS,
            })),
            skipDuplicates: true,
          })
        ).count
      : 0

  return {
    monthStart,
    entitledOwners: owners.length,
    alreadyConfigured: owners.length - unconfigured.length,
    missing: unconfigured.length,
    created,
  }
}

async function run() {
  const apply = process.argv.includes(APPLY_FLAG)
  const summary = await backfillChatBaseBudget({ apply })

  console.log(`Base budget default: ${DEFAULT_BASE_CHAT_BUDGET_CREDITS}`)
  console.log(`Month: ${summary.monthStart.toISOString().slice(0, 10)}`)
  console.log(`Entitled accounts scanned: ${summary.entitledOwners}`)
  console.log(`Already configured: ${summary.alreadyConfigured}`)
  console.log(`Without base budget: ${summary.missing}`)
  console.log(
    apply
      ? `Rows created: ${summary.created}`
      : `Dry run only. Re-run with ${APPLY_FLAG} to grant the default budget.`
  )
}

if (process.argv[1]?.endsWith('2026-09-14_backfill_chat_base_budget.ts')) {
  try {
    await run()
  } finally {
    await prisma.$disconnect()
  }
}
