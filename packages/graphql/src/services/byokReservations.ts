import * as crypto from 'node:crypto'
import { Prisma } from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../lib/context.js'

// ---------------------------------------------------------------------------
// BYOK hard reservations and one-use capabilities (R1)
//
// A capability is the product-side authorization for exactly one provider
// request. The full scope is stored server-side; only a SHA-256 bearer hash is
// persisted. Reservations atomically enforce both per-participant and aggregate
// quota caps inside one transaction.
// ---------------------------------------------------------------------------

/** Result of a successful reserve-and-issue operation. */
export interface CapabilityIssued {
  tokenId: string
  /** Opaque bearer token, returned exactly once at issue time. */
  token: string
  expiresAt: Date
}

export type ReserveFailure =
  | 'BINDING_INACTIVE'
  | 'CREDENTIAL_NOT_ACTIVE'
  | 'PARTICIPANT_CAP_EXCEEDED'
  | 'AGGREGATE_CAP_EXCEEDED'

export type ReserveResult =
  | { ok: true; issued: CapabilityIssued }
  | { ok: false; reason: ReserveFailure }

interface ByokReservationInput {
  bindingId: string
  chatbotId: string
  participantId: string
  estimatedCost: string
}

/**
 * Atomically check both caps and create a RESERVED usage account + capability.
 * Uses a Serializable interactive transaction to prevent concurrent overspend.
 */
export async function reserveCapability(
  input: ByokReservationInput,
  ctx: ContextWithUser
): Promise<ReserveResult> {
  return ctx.prisma.$transaction(
    async (tx) => {
      const binding = await tx.chatbotProviderBinding.findUnique({
        where: { id: input.bindingId },
        include: { credential: true },
      })

      if (!binding || !binding.isActive) {
        return { ok: false as const, reason: 'BINDING_INACTIVE' }
      }
      if (binding.credential.status !== 'ACTIVE') {
        return { ok: false as const, reason: 'CREDENTIAL_NOT_ACTIVE' }
      }

      const cost = new Prisma.Decimal(input.estimatedCost)

      // Aggregate cap: sum of reservedAmount across all usage accounts.
      const aggregate = await tx.byokUsageAccount.aggregate({
        where: { bindingId: input.bindingId },
        _sum: { reservedAmount: true },
      })
      const aggTotal = aggregate._sum.reservedAmount ?? new Prisma.Decimal(0)
      if (aggTotal.plus(cost).gt(binding.aggregateQuotaLimit)) {
        return { ok: false as const, reason: 'AGGREGATE_CAP_EXCEEDED' }
      }

      // Participant cap: sum of reservedAmount for this participant only.
      const partAgg = await tx.byokUsageAccount.aggregate({
        where: {
          bindingId: input.bindingId,
          participantId: input.participantId,
        },
        _sum: { reservedAmount: true },
      })
      const partTotal = partAgg._sum.reservedAmount ?? new Prisma.Decimal(0)
      if (partTotal.plus(cost).gt(binding.participantQuotaLimit)) {
        return { ok: false as const, reason: 'PARTICIPANT_CAP_EXCEEDED' }
      }

      return createReservedRows(tx, binding, input, cost)
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10_000,
    }
  )
}

async function createReservedRows(
  tx: Prisma.TransactionClient,
  binding: {
    id: string
    ownerId: string
    allowedModelAlias: string
    credential: { id: string; vaultSecretVersion: number }
  },
  input: ByokReservationInput,
  cost: Prisma.Decimal
): Promise<ReserveResult> {
  const rawToken = crypto.randomBytes(32).toString('base64url')
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex')

  const usageAccount = await tx.byokUsageAccount.create({
    data: {
      credentialId: binding.credential.id,
      bindingId: binding.id,
      participantId: input.participantId,
      reservedAmount: cost,
      currency: 'USD',
    },
  })

  const capability = await tx.byokCapability.create({
    data: {
      ownerId: binding.ownerId,
      chatbotId: input.chatbotId,
      profileKey: '',
      allowedModelAlias: binding.allowedModelAlias,
      vaultSecretVersion: binding.credential.vaultSecretVersion,
      status: 'ISSUED',
      bearerHash: hash,
      expiresAt: new Date(Date.now() + 60_000),
      credentialId: binding.credential.id,
      bindingId: binding.id,
      usageAccountId: usageAccount.id,
    },
  })

  return {
    ok: true as const,
    issued: {
      tokenId: capability.id,
      token: rawToken,
      expiresAt: capability.expiresAt,
    },
  }
}

/**
 * Consume a capability: verify the bearer hash matches an ISSUED row that has
 * not expired, then atomically mark it CONSUMED. Returns the full scope.
 */
export interface ConsumedScope {
  tokenId: string
  ownerId: string
  chatbotId: string
  profileKey: string
  allowedModelAlias: string
  vaultSecretVersion: number
  usageAccountId: string
}

export type ConsumeResult =
  | { ok: true; scope: ConsumedScope }
  | { ok: false; reason: string }

export async function consumeCapability(
  rawToken: string,
  ctx: ContextWithUser
): Promise<ConsumeResult> {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex')
  return ctx.prisma.$transaction(
    async (tx) => {
      const cap = await tx.byokCapability.findUnique({
        where: { bearerHash: hash },
      })
      if (!cap) return { ok: false as const, reason: 'UNKNOWN_TOKEN' }
      if (cap.status === 'CONSUMED')
        return { ok: false as const, reason: 'REPLAY_DETECTED' }
      if (cap.status === 'CANCELLED')
        return { ok: false as const, reason: 'CAPABILITY_CANCELLED' }
      if (cap.status !== 'ISSUED' && cap.status !== 'RESERVED')
        return { ok: false as const, reason: 'INVALID_STATE' }
      if (Date.now() >= cap.expiresAt.getTime()) {
        await tx.byokCapability.update({
          where: { id: cap.id },
          data: { status: 'EXPIRED' },
        })
        return { ok: false as const, reason: 'EXPIRED' }
      }
      const updated = await tx.byokCapability.update({
        where: { id: cap.id },
        data: { status: 'CONSUMED', consumedAt: new Date() },
      })
      return {
        ok: true as const,
        scope: {
          tokenId: updated.id,
          ownerId: updated.ownerId,
          chatbotId: updated.chatbotId,
          profileKey: updated.profileKey,
          allowedModelAlias: updated.allowedModelAlias,
          vaultSecretVersion: updated.vaultSecretVersion,
          usageAccountId: updated.usageAccountId,
        },
      }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 5_000,
    }
  )
}

/**
 * Settle a consumed capability by moving reserved to used on its usage account.
 * Idempotent: settling twice does not double-count.
 */
export async function settleCapability(
  tokenId: string,
  actualCost: string,
  ctx: ContextWithUser
): Promise<{ settled: boolean }> {
  return ctx.prisma.$transaction(
    async (tx) => {
      const cap = await tx.byokCapability.findUnique({
        where: { id: tokenId },
      })
      if (!cap || cap.status !== 'CONSUMED') return { settled: false }

      const account = await tx.byokUsageAccount.findUnique({
        where: { id: cap.usageAccountId },
      })
      if (!account || account.isSettled) return { settled: false }

      await tx.byokUsageAccount.update({
        where: { id: account.id },
        data: {
          usedAmount: new Prisma.Decimal(actualCost),
          reservedAmount: new Prisma.Decimal(0),
          isSettled: true,
          settledAt: new Date(),
        },
      })
      return { settled: true }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 5_000,
    }
  )
}

/**
 * Cancel an outstanding reservation so the reserved amount returns to quota.
 * Fails silently for already-consumed or settled capabilities.
 */
export async function cancelCapability(
  tokenId: string,
  ctx: ContextWithUser
): Promise<boolean> {
  return ctx.prisma.$transaction(
    async (tx) => {
      const cap = await tx.byokCapability.findUnique({
        where: { id: tokenId },
      })
      if (!cap || cap.status === 'CONSUMED') return false

      const account = await tx.byokUsageAccount.findUnique({
        where: { id: cap.usageAccountId },
      })
      if (!account) return false

      await tx.byokCapability.update({
        where: { id: cap.id },
        data: { status: 'CANCELLED' },
      })

      if (!account.isSettled) {
        await tx.byokUsageAccount.update({
          where: { id: account.id },
          data: { reservedAmount: new Prisma.Decimal(0) },
        })
      }
      return true
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 5_000,
    }
  )
}

/**
 * Expire capabilities whose deadline has passed but were never consumed.
 * Called by a periodic sweep or before reservation to reclaim stale holds.
 */
export async function expireStaleCapabilities(
  ctx: ContextWithUser
): Promise<number> {
  const result = await ctx.prisma.byokCapability.updateMany({
    where: {
      status: { in: ['RESERVED', 'ISSUED'] },
      expiresAt: { lte: new Date() },
    },
    data: { status: 'EXPIRED' },
  })
  return result.count
}
