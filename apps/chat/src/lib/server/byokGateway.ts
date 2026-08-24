/**
 * BYOK funding source: routes one named model through the AI Credential
 * Gateway and the isolated BYOK LiteLLM deployment.
 *
 * The feature is default-off: it activates only when the chatbot has an active
 * provider binding and the request explicitly selects a bound model. Platform
 * fallback never happens after a reservation is issued — a failed gateway call
 * surfaces a stable error instead of silently charging platform credits.
 */

import * as crypto from 'node:crypto'
import { createOpenAI } from '@ai-sdk/openai'
import { prisma } from '@klicker-uzh/prisma'
import { Prisma } from '@klicker-uzh/prisma/client'

export interface ByokBindingInfo {
  bindingId: string
  credentialId: string
  allowedModelAlias: string
  participantQuotaLimit: string
  aggregateQuotaLimit: string
  currentNoticeVersion: number
}

export type ByokReserveOutcome =
  | { ok: true; tokenId: string; token: string }
  | { ok: false; reason: string }

/** Resolve the active BYOK binding for this chatbot, or null if none. */
export async function resolveActiveByokBinding(
  chatbotId: string
): Promise<ByokBindingInfo | null> {
  const binding = await prisma.chatbotProviderBinding.findFirst({
    where: { chatbotId, isActive: true },
    include: { credential: { select: { id: true } } },
  })
  if (!binding) return null
  return {
    bindingId: binding.id,
    credentialId: binding.credential.id,
    allowedModelAlias: binding.allowedModelAlias,
    participantQuotaLimit: String(binding.participantQuotaLimit),
    aggregateQuotaLimit: String(binding.aggregateQuotaLimit),
    currentNoticeVersion: binding.currentNoticeVersion,
  }
}

/**
 * Reserve quota and issue a one-use capability for a single request.
 */
export async function reserveByokCapability(
  input: {
    bindingId: string
    chatbotId: string
    participantId: string
    estimatedCost: string
  },
  ctx: { prisma: typeof prisma; user: { sub: string } }
): Promise<ByokReserveOutcome> {
  const result = await ctx.prisma.$transaction(
    async (tx) => {
      // Inline reservation logic (mirrors byokReservations.ts in graphql services).
      const binding = await tx.chatbotProviderBinding.findUnique({
        where: { id: input.bindingId },
        include: { credential: { include: { profile: true } } },
      })
      if (!binding || !binding.isActive) {
        return { ok: false as const, reason: 'BINDING_INACTIVE' }
      }
      if (binding.credential.status !== 'ACTIVE') {
        return { ok: false as const, reason: 'CREDENTIAL_NOT_ACTIVE' }
      }

      const cost = new Prisma.Decimal(input.estimatedCost)

      const aggregate = await tx.byokUsageAccount.aggregate({
        where: { bindingId: input.bindingId },
        _sum: { reservedAmount: true, usedAmount: true },
      })
      const aggTotal = (
        aggregate._sum.reservedAmount ?? new Prisma.Decimal(0)
      ).plus(aggregate._sum.usedAmount ?? new Prisma.Decimal(0))
      if (aggTotal.plus(cost).gt(binding.aggregateQuotaLimit)) {
        return { ok: false as const, reason: 'AGGREGATE_CAP_EXCEEDED' }
      }

      const partAgg = await tx.byokUsageAccount.aggregate({
        where: {
          bindingId: input.bindingId,
          participantId: input.participantId,
        },
        _sum: { reservedAmount: true, usedAmount: true },
      })
      const partTotal = (
        partAgg._sum.reservedAmount ?? new Prisma.Decimal(0)
      ).plus(partAgg._sum.usedAmount ?? new Prisma.Decimal(0))
      if (partTotal.plus(cost).gt(binding.participantQuotaLimit)) {
        return { ok: false as const, reason: 'PARTICIPANT_CAP_EXCEEDED' }
      }

      const rawToken = crypto.randomBytes(32).toString('base64url')
      const hash = crypto.createHash('sha256').update(rawToken).digest('hex')

      const usageAccount = await tx.byokUsageAccount.create({
        data: {
          credentialId: binding.credential.id,
          bindingId: binding.id,
          participantId: input.participantId,
          reservedAmount: cost,
          currency: binding.credential.profile.currency ?? 'USD',
        },
      })

      const capability = await tx.byokCapability.create({
        data: {
          ownerId: binding.ownerId,
          chatbotId: input.chatbotId,
          profileKey: binding.credential.profile.key,
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
        tokenId: capability.id,
        token: rawToken,
      }
    },
    { isolationLevel: 'Serializable' }
  )

  return result
}

/**
 * Build an OpenAI-compatible model backed by the isolated LiteLLM gateway.
 * The bearer capability authenticates to the gateway, which resolves vault
 * custody internally. No raw provider key ever reaches this process.
 */
export function buildByokModel(config: {
  gatewayOrigin: string
  capabilityToken: string
  modelAlias: string
}) {
  const client = createOpenAI({
    baseURL: config.gatewayOrigin + '/v1',
    apiKey: config.capabilityToken,
  })
  return client.chat(config.modelAlias)
}

/**
 * Settle actual usage after stream completion. Idempotent.
 */
export async function settleByokUsage(
  tokenId: string,
  actualCost: string
): Promise<boolean> {
  const result = await prisma.$transaction(
    async (tx) => {
      const cap = await tx.byokCapability.findUnique({ where: { id: tokenId } })
      if (!cap || cap.status !== 'CONSUMED') return false
      const account = await tx.byokUsageAccount.findUnique({
        where: { id: cap.usageAccountId },
      })
      if (!account || account.isSettled) return false
      await tx.byokUsageAccount.update({
        where: { id: account.id },
        data: {
          usedAmount: new Prisma.Decimal(actualCost),
          reservedAmount: new Prisma.Decimal(0),
          isSettled: true,
          settledAt: new Date(),
        },
      })
      return true
    },
    { isolationLevel: 'Serializable' }
  )
  return result
}
