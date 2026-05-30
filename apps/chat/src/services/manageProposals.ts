import hashes from '@klicker-uzh/graphql/dist/client.json'
import { verifyJWT } from '@klicker-uzh/util'
import { z } from 'zod'

const MANAGE_PROPOSAL_PURPOSE = 'manage-assistant-proposal'

const proposalChoiceSchema = z.object({
  correct: z.boolean(),
  feedback: z.string().trim().min(1).max(500).optional(),
  ix: z.number().int().min(0).optional(),
  value: z.string().trim().min(1).max(240),
})

const baseProposalPayloadSchema = z.object({
  basePoints: z.boolean().default(true),
  content: z.string().trim().min(1).max(4000),
  explanation: z.string().trim().min(1).max(2000).optional(),
  name: z.string().trim().min(1).max(160),
  pointsMultiplier: z.number().int().min(1).max(100).default(1),
  status: z.literal('DRAFT'),
  tags: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
})

const choicesProposalPayloadSchema = baseProposalPayloadSchema.extend({
  options: z.object({
    choices: z.array(proposalChoiceSchema).min(2).max(8),
    displayMode: z.literal('LIST').default('LIST'),
    hasAnswerFeedbacks: z.boolean().default(false),
    hasSampleSolution: z.boolean().default(true),
  }),
  type: z.enum(['SC', 'MC']),
})

const freeTextProposalPayloadSchema = baseProposalPayloadSchema.extend({
  options: z.object({
    hasSampleSolution: z.boolean().default(false),
    restrictions: z.object({
      maxLength: z.number().int().positive().optional(),
    }),
    solutions: z.array(z.string().trim().min(1).max(500)).optional(),
  }),
  type: z.literal('FREE_TEXT'),
})

const manageElementCreateProposalSchema = z.object({
  kind: z.literal('element.create.proposal'),
  payload: z.union([
    choicesProposalPayloadSchema,
    freeTextProposalPayloadSchema,
  ]),
  requiresConfirmation: z.literal(true),
  summary: z.string().trim().min(1).max(240).optional(),
})

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

export type ManageElementCreateProposal = z.infer<
  typeof manageElementCreateProposalSchema
>

type OperationName = 'ManipulateChoicesQuestion' | 'ManipulateFreeTextQuestion'

const MANIPULATE_CHOICES_QUESTION = `
mutation ManipulateChoicesQuestion(
  $id: Int
  $status: ElementStatus
  $type: ElementType!
  $name: String
  $content: String
  $explanation: String
  $options: OptionsChoicesInput
  $basePoints: Boolean
  $pointsMultiplier: Int
  $tags: [String!]
) {
  manipulateChoicesQuestion(
    id: $id
    status: $status
    type: $type
    name: $name
    content: $content
    explanation: $explanation
    options: $options
    basePoints: $basePoints
    pointsMultiplier: $pointsMultiplier
    tags: $tags
  ) {
    __typename
    ... on ChoicesElement {
      id
      name
      status
      type
    }
  }
}
`

const MANIPULATE_FREE_TEXT_QUESTION = `
mutation ManipulateFreeTextQuestion(
  $id: Int
  $status: ElementStatus
  $name: String
  $content: String
  $explanation: String
  $options: OptionsFreeTextInput
  $basePoints: Boolean
  $pointsMultiplier: Int
  $tags: [String!]
) {
  manipulateFreeTextQuestion(
    id: $id
    status: $status
    name: $name
    content: $content
    explanation: $explanation
    options: $options
    basePoints: $basePoints
    pointsMultiplier: $pointsMultiplier
    tags: $tags
  ) {
    __typename
    ... on FreeTextElement {
      id
      name
      status
      type
    }
  }
}
`

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
  const query =
    operationName === 'ManipulateFreeTextQuestion'
      ? MANIPULATE_FREE_TEXT_QUESTION
      : MANIPULATE_CHOICES_QUESTION

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
    query,
    variables,
  }
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
