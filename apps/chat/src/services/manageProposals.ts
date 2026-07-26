import hashes from '@klicker-uzh/graphql/dist/client.json'
import { prisma } from '@klicker-uzh/prisma'
import { AuditLogType, ObjectType } from '@klicker-uzh/prisma/client'
import { verifyJWT } from '@klicker-uzh/util'
import { z } from 'zod'
import {
  choicesProposalPayloadSchema,
  freeTextProposalPayloadSchema,
  manageElementCreateProposalSchema,
  type ManageElementCreateProposal,
} from './manageProposalSchema'

export {
  manageElementCreateProposalSchema,
  type ManageElementCreateProposal,
} from './manageProposalSchema'

const MANAGE_PROPOSAL_PURPOSE = 'manage-assistant-proposal'

const manageProposalTokenSchema = z.object({
  jti: z.string().trim().min(1).optional(),
  kind: z.literal('element.create.proposal'),
  payload: z.union([
    choicesProposalPayloadSchema,
    freeTextProposalPayloadSchema,
  ]),
  purpose: z.literal(MANAGE_PROPOSAL_PURPOSE),
  sub: z.string().trim().min(1),
  summary: z.string().trim().min(1).max(240).optional(),
})

// Single-use guard for signed proposal tokens (jti replay protection).
//
// Best-effort, per-pod only: state lives in process memory, so a lecturer
// could squeeze in one extra confirm per pod behind a load balancer, and a
// restart/redeploy forgets used tokens. Good enough against accidental
// double-submits (double-click, retried request) within the token's 15m
// lifetime; not a substitute for a shared store if a hard guarantee is ever
// needed.
//
// Tokens signed before this guard existed have no `jti` claim; those are
// accepted without a replay check so in-flight tokens keep working across
// the mcp-lecturer rollout (see signProposalToken in apps/mcp-lecturer).
const PROPOSAL_JTI_TTL_MS = 15 * 60 * 1000 // matches signProposalToken's 15m expiresIn
const usedProposalJtis = new Map<string, number>() // jti -> expiresAtMs

function pruneUsedProposalJtis(now: number) {
  for (const [jti, expiresAt] of usedProposalJtis) {
    if (expiresAt <= now) {
      usedProposalJtis.delete(jti)
    }
  }
}

function claimProposalJti(jti: string): boolean {
  const now = Date.now()
  pruneUsedProposalJtis(now)
  if (usedProposalJtis.has(jti)) {
    return false
  }
  usedProposalJtis.set(jti, now + PROPOSAL_JTI_TTL_MS)
  return true
}

const confirmedElementSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  status: z.literal('DRAFT'),
  type: z.string(),
})

type OperationName = 'ManipulateChoicesQuestion' | 'ManipulateFreeTextQuestion'

function getPersistedHash(operationName: OperationName): string {
  const hash = (hashes as Record<string, string>)[operationName]
  if (!hash) {
    throw new Error(`Missing persisted GraphQL hash for ${operationName}`)
  }
  return hash
}

export function buildManageProposalGraphqlRequest(value: unknown) {
  const parsed = manageElementCreateProposalSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error('Invalid Manage proposal payload')
  }

  const { payload } = parsed.data
  const operationName: OperationName =
    payload.type === 'FREE_TEXT'
      ? 'ManipulateFreeTextQuestion'
      : 'ManipulateChoicesQuestion'

  const variables =
    payload.type === 'FREE_TEXT'
      ? {
          basePoints: payload.basePoints,
          content: payload.content,
          explanation: payload.explanation,
          name: payload.name,
          options: payload.options,
          pointsMultiplier: payload.pointsMultiplier,
          status: payload.status,
          tags: payload.tags,
        }
      : {
          basePoints: payload.basePoints,
          content: payload.content,
          explanation: payload.explanation,
          name: payload.name,
          options: {
            ...payload.options,
            choices: payload.options.choices.map((choice, ix) => ({
              ...choice,
              ix,
            })),
          },
          pointsMultiplier: payload.pointsMultiplier,
          status: payload.status,
          tags: payload.tags,
          type: payload.type,
        }

  return {
    extensions: {
      persistedQuery: {
        sha256Hash: getPersistedHash(operationName),
        version: 1,
      },
    },
    operationName,
    variables,
  }
}

export function getRequiredManageOrigin(
  env: Record<string, string | undefined> = process.env
) {
  const origin = env.APP_ORIGIN_MANAGE?.replace(/\/$/, '')
  if (!origin) {
    throw new Error('APP_ORIGIN_MANAGE is required')
  }
  return origin
}

export async function verifyManageProposalToken(
  token: string,
  userId: string,
  settings: { issuer: string; secret: string }
): Promise<ManageElementCreateProposal & { jti: string | null }> {
  let parsed: z.infer<typeof manageProposalTokenSchema>
  try {
    const payload = await verifyJWT(token, settings.secret, {
      issuer: settings.issuer,
    })
    parsed = manageProposalTokenSchema.parse(payload)

    if (parsed.sub !== userId) {
      throw new Error('Proposal token subject mismatch')
    }
  } catch {
    throw new Error('Invalid Manage proposal token')
  }

  // Outside the signature/shape try-catch above so this rejection is
  // distinguishable from "invalid token" (see claimProposalJti comment).
  if (parsed.jti && !claimProposalJti(parsed.jti)) {
    throw new Error('Manage proposal token already used')
  }

  return {
    // `jti` is absent on tokens signed before the replay guard existed (see
    // claimProposalJti comment above) — normalized to `null` here so callers
    // (e.g. the audit trail, X5) always get an explicit legacy marker rather
    // than `undefined`.
    jti: parsed.jti ?? null,
    kind: parsed.kind,
    payload: parsed.payload,
    requiresConfirmation: true,
    summary: parsed.summary,
  }
}

/**
 * Best-effort audit trail for a confirmed Manage-assistant proposal
 * (extension roadmap X5, plan finding §3.4: today there is no durable record
 * of who confirmed what and when — only the resulting object row).
 *
 * Persistence has already happened by the time this is called
 * (`confirmManageProposal` succeeded) — an audit-write failure must never
 * fail the confirmation response, so this function swallows its own errors
 * after logging them. The `message` column intentionally stays a short,
 * PII-free summary (kind + jti + the proposal's own short human-readable
 * summary) rather than a full payload dump.
 */
export async function recordProposalConfirmationAudit({
  jti,
  kind,
  objectId,
  summary,
  userId,
}: {
  jti: string | null
  kind: string
  objectId: string
  summary: string | undefined
  userId: string
}): Promise<void> {
  try {
    await prisma.auditLogEntry.create({
      data: {
        message: JSON.stringify({
          jti,
          kind,
          summary: summary ?? null,
        }),
        objectId,
        objectType: ObjectType.ELEMENT,
        sourceUserId: userId,
        type: AuditLogType.ASSISTANT_PROPOSAL_CONFIRMED,
      },
    })
  } catch (error) {
    console.error(
      'Failed to record Manage-assistant proposal confirmation audit entry:',
      error
    )
  }
}

export async function confirmManageProposal({
  fetchImpl = fetch,
  graphqlEndpoint,
  manageOrigin,
  proposal,
  sessionToken,
}: {
  fetchImpl?: typeof fetch
  graphqlEndpoint: string
  manageOrigin: string
  proposal: ManageElementCreateProposal
  sessionToken: string
}) {
  const response = await fetchImpl(graphqlEndpoint, {
    body: JSON.stringify(buildManageProposalGraphqlRequest(proposal)),
    headers: {
      authorization: `Bearer ${sessionToken}`,
      'content-type': 'application/json',
      cookie: `next-auth.session-token=${sessionToken}`,
      origin: manageOrigin,
      'x-graphql-yoga-csrf': 'true',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`Manage GraphQL confirmation failed: ${response.status}`)
  }

  const result = await response.json()
  if (
    result &&
    typeof result === 'object' &&
    Array.isArray((result as { errors?: unknown }).errors)
  ) {
    throw new Error('Manage GraphQL confirmation returned errors')
  }

  const data =
    result && typeof result === 'object'
      ? (result as { data?: Record<string, unknown> }).data
      : undefined
  const element =
    data?.manipulateChoicesQuestion ?? data?.manipulateFreeTextQuestion
  const parsed = confirmedElementSchema.safeParse(element)
  if (!parsed.success) {
    throw new Error('Manage GraphQL confirmation returned invalid element')
  }

  return { element: parsed.data }
}
