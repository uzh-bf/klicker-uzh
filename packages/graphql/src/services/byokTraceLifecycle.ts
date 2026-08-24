/**
 * BYOK trace lifecycle: indexes stable selectors for cross-service traces,
 * creates deletion jobs when subjects are deleted, and verifies completion.
 *
 * Traces span Chat → Gateway → LiteLLM → Provider. Each ByokUsageAccount row
 * carries a requestTraceId that joins the full OTel/Langfuse trace tree. When
 * a chatbot or user is deleted, we create a TraceDeletionJob that a Hatchet
 * worker processes by calling the Langfuse deletion adapter.
 */

import type { Prisma } from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../lib/context.js'

export interface LangfuseDeleteAdapter {
  /** Request deletion of all spans matching the given trace ids. */
  deleteTraces(traceIds: string[]): Promise<{ deleted: boolean }>
  /** Check whether any residual traces remain for the given ids. */
  checkResidual(traceIds: string[]): Promise<{ remaining: number }>
}

/** Record the trace selector on a settled usage account. */
export async function recordTraceId(
  usageAccountId: string,
  traceId: string,
  ctx: ContextWithUser
): Promise<void> {
  await ctx.prisma.byokUsageAccount.update({
    where: { id: usageAccountId },
    data: { requestTraceId: traceId },
  })
}

/**
 * Create deletion jobs for all BYOK traces belonging to a chatbot being
 * deleted. Returns the number of jobs created.
 */
export async function createChatbotDeletionJobs(
  chatbotId: string,
  ctx: ContextWithUser
): Promise<number> {
  const accounts = await ctx.prisma.byokUsageAccount.findMany({
    where: {
      binding: { chatbotId },
      requestTraceId: { not: null },
    },
    select: { id: true, requestTraceId: true },
  })

  if (accounts.length === 0) return 0

  // Group trace ids into one job per batch to avoid oversized payloads.
  const BATCH_SIZE = 100
  let jobCount = 0
  for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
    const batch = accounts.slice(i, i + BATCH_SIZE)
    const traceIds = batch
      .map((a) => a.requestTraceId)
      .filter((id): id is string => id !== null)
    if (traceIds.length === 0) continue

    const bindingId = await ctx.prisma.byokUsageAccount.findFirst({
      where: { id: batch[0]!.id },
      select: { bindingId: true },
    })

    await ctx.prisma.traceDeletionJob.create({
      data: {
        bindingId: bindingId?.bindingId ?? null,
        tombstonedChatbotId: chatbotId,
        traceSelectors: { traceIds } as Prisma.InputJsonValue,
        terminalState: 'PENDING',
      },
    })
    jobCount++
  }
  return jobCount
}

/**
 * Create deletion jobs for all BYOK traces belonging to a user being deleted.
 */
export async function createUserDeletionJobs(
  userId: string,
  ctx: ContextWithUser
): Promise<number> {
  const accounts = await ctx.prisma.byokUsageAccount.findMany({
    where: {
      credential: { ownerId: userId },
      requestTraceId: { not: null },
    },
    select: { id: true, requestTraceId: true },
  })
  if (accounts.length === 0) return 0

  const traceIds = accounts
    .map((a) => a.requestTraceId)
    .filter((id): id is string => id !== null)

  await ctx.prisma.traceDeletionJob.create({
    data: {
      tombstonedUserId: userId,
      traceSelectors: { traceIds } as Prisma.InputJsonValue,
      terminalState: 'PENDING',
    },
  })
  return 1
}

/**
 * Process pending deletion jobs through the Langfuse adapter.
 * Idempotent: already-completed jobs are skipped; failed jobs can be retried.
 */
export async function processPendingDeletions(
  adapter: LangfuseDeleteAdapter,
  ctx: ContextWithUser
): Promise<{ processed: number; verified: number; failed: number }> {
  const result = { processed: 0, verified: 0, failed: 0 }

  const jobs = await ctx.prisma.traceDeletionJob.findMany({
    where: { terminalState: { in: ['PENDING', 'REQUESTED'] } },
    take: 50,
    orderBy: { createdAt: 'asc' },
  })

  for (const job of jobs) {
    try {
      const selectors = job.traceSelectors as { traceIds?: string[] }
      const traceIds = selectors.traceIds ?? []
      if (traceIds.length === 0) continue

      if (job.terminalState === 'PENDING') {
        const deleteResult = await adapter.deleteTraces(traceIds)
        if (!deleteResult.deleted)
          throw new Error('Langfuse deletion returned false')
        await ctx.prisma.traceDeletionJob.update({
          where: { id: job.id },
          data: {
            terminalState: 'REQUESTED',
            requestedAt: new Date(),
            attempts: { increment: 1 },
          },
        })
        result.processed++
      }

      if (job.terminalState === 'REQUESTED') {
        const residual = await adapter.checkResidual(traceIds)
        if (residual.remaining === 0) {
          await ctx.prisma.traceDeletionJob.update({
            where: { id: job.id },
            data: { terminalState: 'VERIFIED', verifiedAt: new Date() },
          })
          result.verified++
        } else {
          // Still propagating; leave in REQUESTED state for next sweep.
          result.processed++
        }
      }
    } catch {
      await ctx.prisma.traceDeletionJob.update({
        where: { id: job.id },
        data: {
          attempts: { increment: 1 },
          ...(job.attempts >= 6 ? { terminalState: 'FAILED' } : {}),
        },
      })
      result.failed++
    }
  }

  return result
}

/**
 * Query whether any overdue deletion jobs exist (> 7 days old without
 * verification). Used by monitoring to alert operators.
 */
export async function findOverdueJobs(
  ctx: ContextWithUser
): Promise<Array<{ id: string; createdAt: Date; attempts: number }>> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  return ctx.prisma.traceDeletionJob.findMany({
    where: {
      terminalState: { notIn: ['VERIFIED'] },
      createdAt: { lt: sevenDaysAgo },
    },
    select: { id: true, createdAt: true, attempts: true },
  })
}
