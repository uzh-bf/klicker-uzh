import hashes from '@klicker-uzh/graphql/dist/client.json'
import type {
  CardGenerationLeaseInput,
  MAbortCardGenerationLeaseMutation,
  MClaimCardGenerationLeaseMutation,
  MCompleteCardGenerationLeaseMutation,
  MDiscardPersonalElementCandidateMutation,
  MPrepareCardPlanMutation,
  MSavePersonalElementCandidateMutation,
  MUpdatePersonalElementMutation,
  MValidateCardCandidateMutation,
  PersonalElement,
  QPersonalElementGenerationContextQuery,
  QPersonalElementsQuery,
  QSavedPersonalElementCandidateIdsQuery,
  UpdatePersonalElementInput,
} from '@klicker-uzh/graphql/dist/ops'
import {
  ElementSourceKind,
  ElementSourceLocatorType,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { prisma } from '@klicker-uzh/prisma'
import type { ElementSourceReference } from '@klicker-uzh/types'
import { signJWT } from '@klicker-uzh/util'

const JWT_TTL_SECONDS = 5 * 60

/**
 * Mints a short-lived HS256 participant JWT for one server-to-server GraphQL
 * request. The token carries only the participant subject, the PARTICIPANT
 * role, and expiry metadata; it is used exclusively in the GraphQL
 * authorization header and is never returned to the client, persisted, or
 * logged. Minting fails closed when APP_SECRET is missing.
 */
export async function mintParticipantToken(
  participantId: string
): Promise<string> {
  const secret = process.env.APP_SECRET
  if (!secret) {
    throw new Error('APP_SECRET is not set; cannot mint participant token')
  }

  return signJWT({ sub: participantId, role: 'PARTICIPANT' }, secret, {
    algorithm: 'HS256',
    expiresIn: `${JWT_TTL_SECONDS}s`,
    issuer: process.env.APP_ORIGIN_API,
  })
}

function getApiOrigin() {
  const origin = process.env.APP_ORIGIN_API?.replace(/\/$/, '')
  if (!origin) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('APP_ORIGIN_API is required')
    }
    console.warn(
      'APP_ORIGIN_API is not set; falling back to http://localhost:3000 for local dev only'
    )
  }
  return origin ?? 'http://localhost:3000'
}

function getGraphqlEndpoint() {
  return `${getApiOrigin()}/api/graphql`
}

function getRequestOrigin() {
  return process.env.APP_ORIGIN_CHAT?.replace(/\/$/, '') ?? getApiOrigin()
}

function getPersistedHash(operationName: string): string {
  const hash = (hashes as Record<string, string>)[operationName]
  if (!hash) {
    throw new Error(`Missing persisted GraphQL hash for ${operationName}`)
  }
  return hash
}

class PersonalElementGraphQLError extends Error {
  readonly extensions: Record<string, unknown> | undefined

  constructor(message: string, extensions?: Record<string, unknown>) {
    super(message)
    this.name = 'PersonalElementGraphQLError'
    this.extensions = extensions
  }
}

type GraphQLResponse = {
  data?: unknown
  errors?: Array<{
    message?: string
    extensions?: Record<string, unknown>
  }>
}

/**
 * Executes one generated personal-element operation against the GraphQL
 * endpoint with a freshly minted participant token. Persisted-query hashes
 * come from the generated client map; the backend rejects unknown hashes.
 * GraphQL errors are rethrown with their extensions so callers can map
 * conflict codes (for example PERSONAL_ELEMENTS_CANDIDATE_DISCARDED).
 */
export async function executePersonalElementOperation<TData>({
  operationName,
  variables,
  participantId,
  fetchImpl = fetch,
}: {
  operationName: string
  variables: Record<string, unknown>
  participantId: string
  fetchImpl?: typeof fetch
}): Promise<TData> {
  const token = await mintParticipantToken(participantId)
  const response = await fetchImpl(getGraphqlEndpoint(), {
    body: JSON.stringify({
      extensions: {
        persistedQuery: {
          sha256Hash: getPersistedHash(operationName),
          version: 1,
        },
      },
      operationName,
      variables,
    }),
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin: getRequestOrigin(),
      'x-graphql-yoga-csrf': 'true',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(
      `Personal element GraphQL request failed: ${response.status}`
    )
  }

  const result = (await response.json()) as GraphQLResponse
  if (result.errors && result.errors.length > 0) {
    const first = result.errors[0]
    throw new PersonalElementGraphQLError(
      first?.message ?? 'Personal element GraphQL request failed',
      first?.extensions
    )
  }

  return result.data as TData
}

export async function claimCardGenerationLease(
  input: CardGenerationLeaseInput,
  participantId: string
): Promise<{ id: string; attemptToken: string }> {
  const data =
    await executePersonalElementOperation<MClaimCardGenerationLeaseMutation>({
      operationName: 'MClaimCardGenerationLease',
      variables: { input },
      participantId,
    })
  const lease = data.claimCardGenerationLease
  if (!lease) {
    throw new Error('Card generation lease claim returned no lease')
  }
  return lease
}

export async function completeCardGenerationLease(
  id: string,
  attemptToken: string,
  participantId: string
): Promise<boolean> {
  const data =
    await executePersonalElementOperation<MCompleteCardGenerationLeaseMutation>(
      {
        operationName: 'MCompleteCardGenerationLease',
        variables: { id, attemptToken },
        participantId,
      }
    )
  return data.completeCardGenerationLease
}

export async function abortCardGenerationLease(
  id: string,
  attemptToken: string,
  participantId: string
): Promise<boolean> {
  const data =
    await executePersonalElementOperation<MAbortCardGenerationLeaseMutation>({
      operationName: 'MAbortCardGenerationLease',
      variables: { id, attemptToken },
      participantId,
    })
  return data.abortCardGenerationLease
}

export async function savePersonalElementCandidate(
  input: {
    courseId: string
    messageId: string
    toolCallId: string
    candidateId: string
  },
  participantId: string
): Promise<PersonalElement> {
  const data =
    await executePersonalElementOperation<MSavePersonalElementCandidateMutation>(
      {
        operationName: 'MSavePersonalElementCandidate',
        variables: { input },
        participantId,
      }
    )
  const element = data.savePersonalElementCandidate
  if (!element) throw new Error('Personal element save returned no element')
  return element
}

export async function discardPersonalElementCandidate(
  input: {
    courseId: string
    messageId: string
    toolCallId: string
    candidateId: string
  },
  participantId: string
): Promise<boolean> {
  const data =
    await executePersonalElementOperation<MDiscardPersonalElementCandidateMutation>(
      {
        operationName: 'MDiscardPersonalElementCandidate',
        variables: { input },
        participantId,
      }
    )
  return data.discardPersonalElementCandidate
}

export async function prepareCardPlan(
  input: {
    courseId: string
    topic: string
    cards: Array<{
      type: 'FLASHCARD'
      title: string
      intent: string
      query: string
    }>
  },
  participantId: string
) {
  const data = await executePersonalElementOperation<MPrepareCardPlanMutation>({
    operationName: 'MPrepareCardPlan',
    variables: {
      input: {
        ...input,
        cards: input.cards.map((card) => ({
          ...card,
          type: ElementType.Flashcard,
        })),
      },
    },
    participantId,
  })
  const plan = data.prepareCardPlan
  if (!plan) throw new Error('Card plan preparation returned no plan')
  return {
    ...plan,
    cards: plan.cards.map((card) => ({
      ...card,
      type: 'FLASHCARD' as const,
    })),
  }
}

export async function validateCardCandidate(
  input: {
    courseId: string
    candidateId: string
    title: string
    front: string
    back: string
    sources: ElementSourceReference[]
    sourceMessageId: string
    sourceToolCallId: string
  },
  participantId: string
): Promise<boolean> {
  const data =
    await executePersonalElementOperation<MValidateCardCandidateMutation>({
      operationName: 'MValidateCardCandidate',
      variables: {
        input: {
          ...input,
          sources: input.sources.map(toGraphqlSourceReference),
        },
      },
      participantId,
    })
  return data.validateCardCandidate
}

export async function listPersonalElements(
  courseId: string,
  participantId: string
): Promise<PersonalElement[]> {
  const data = await executePersonalElementOperation<QPersonalElementsQuery>({
    operationName: 'QPersonalElements',
    variables: { courseId },
    participantId,
  })
  return data.personalElements ?? []
}

export async function getPersonalElementGenerationContext(
  courseId: string,
  participantId: string
) {
  const data =
    await executePersonalElementOperation<QPersonalElementGenerationContextQuery>(
      {
        operationName: 'QPersonalElementGenerationContext',
        variables: { courseId },
        participantId,
      }
    )
  return data.personalElementGenerationContext
}

export async function listSavedPersonalElementCandidateIds(
  courseId: string,
  candidateIds: readonly string[],
  participantId: string
): Promise<string[]> {
  if (candidateIds.length === 0) return []
  const data =
    await executePersonalElementOperation<QSavedPersonalElementCandidateIdsQuery>(
      {
        operationName: 'QSavedPersonalElementCandidateIds',
        variables: { courseId, candidateIds: [...candidateIds] },
        participantId,
      }
    )
  return data.savedPersonalElementCandidateIds
}

export async function updatePersonalElement(
  input: Omit<UpdatePersonalElementInput, 'sources'> & {
    sources?: ElementSourceReference[] | null
  },
  participantId: string
): Promise<PersonalElement> {
  const { sources, ...update } = input
  const graphqlInput: UpdatePersonalElementInput = {
    ...update,
    ...(sources
      ? { sources: sources.map(toGraphqlSourceReference) }
      : sources === null
        ? { sources: null }
        : {}),
  }
  const data =
    await executePersonalElementOperation<MUpdatePersonalElementMutation>({
      operationName: 'MUpdatePersonalElement',
      variables: { input: graphqlInput },
      participantId,
    })
  const element = data.updatePersonalElement
  if (!element) {
    throw new Error('Personal element update returned no element')
  }
  return element
}

function toGraphqlSourceReference(source: ElementSourceReference) {
  return {
    sourceId: source.sourceId,
    kind:
      source.kind === 'DOCUMENT'
        ? ElementSourceKind.Document
        : ElementSourceKind.Web,
    title: source.title,
    canonicalUrl: source.canonicalUrl,
    chunkIds: source.chunkIds,
    locators: source.locators.map((locator) =>
      locator.type === 'PAGE_RANGE'
        ? {
            type: ElementSourceLocatorType.PageRange,
            pageFrom: locator.pageFrom,
            pageTo: locator.pageTo,
            labelFrom: locator.labelFrom,
            labelTo: locator.labelTo,
          }
        : {
            type: ElementSourceLocatorType.WebAnchor,
            url: locator.url,
            label: locator.label,
          }
    ),
  }
}

/**
 * Loads the durable lease state for one generation attempt. The GraphQL
 * surface exposes no read operation for lease state, so this read stays
 * inside the adapter behind the same participant-scoped boundary.
 */
export async function getGenerationLeaseState({
  participantId,
  attemptToken,
}: {
  participantId: string
  attemptToken: string
}): Promise<{ completedAt: Date | null } | null> {
  return prisma.cardGenerationLease.findFirst({
    where: { participantId, attemptToken },
    select: { completedAt: true },
  })
}

/**
 * Loads the discarded candidate IDs for one participant and course. The
 * GraphQL surface exposes no read operation for discard state, so this read
 * stays inside the adapter behind the same participant-scoped boundary.
 */
export async function listDiscardedCandidateIds({
  participantId,
  courseId,
  candidateIds,
}: {
  participantId: string
  courseId: string
  candidateIds: readonly string[]
}): Promise<string[]> {
  if (candidateIds.length === 0) return []
  const discarded = await prisma.personalElementDiscard.findMany({
    where: {
      participantId,
      courseId,
      candidateId: { in: [...candidateIds] },
    },
    select: { candidateId: true },
  })
  return discarded.map(({ candidateId }) => candidateId)
}

/**
 * Loads the attempt tokens of completed generation leases for one
 * participant. The GraphQL surface exposes no read operation for lease
 * state, so this read stays inside the adapter behind the same
 * participant-scoped boundary.
 */
export async function listCompletedGenerationLeaseAttemptTokens({
  participantId,
  attemptTokens,
}: {
  participantId: string
  attemptTokens: readonly string[]
}): Promise<string[]> {
  if (attemptTokens.length === 0) return []
  const leases = await prisma.cardGenerationLease.findMany({
    where: {
      participantId,
      attemptToken: { in: [...attemptTokens] },
      completedAt: { not: null },
    },
    select: { attemptToken: true },
  })
  return leases.map(({ attemptToken }) => attemptToken)
}
