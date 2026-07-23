import hashes from '@klicker-uzh/graphql/dist/client.json'
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
  kind: z.literal('element.create.proposal'),
  payload: z.union([
    choicesProposalPayloadSchema,
    freeTextProposalPayloadSchema,
  ]),
  purpose: z.literal(MANAGE_PROPOSAL_PURPOSE),
  sub: z.string().trim().min(1),
  summary: z.string().trim().min(1).max(240).optional(),
})

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
): Promise<ManageElementCreateProposal> {
  try {
    const payload = await verifyJWT(token, settings.secret, {
      issuer: settings.issuer,
    })
    const parsed = manageProposalTokenSchema.parse(payload)

    if (parsed.sub !== userId) {
      throw new Error('Proposal token subject mismatch')
    }

    return {
      kind: parsed.kind,
      payload: parsed.payload,
      requiresConfirmation: true,
      summary: parsed.summary,
    }
  } catch {
    throw new Error('Invalid Manage proposal token')
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
