import hashes from '@klicker-uzh/graphql/dist/client.json'
import { z } from 'zod'

const captureResultSchema = z.object({
  exampleId: z.string().uuid(),
  created: z.boolean(),
})

export const RESPONSE_EXAMPLE_CAPTURE_OPERATION = 'CaptureResponseExample'

export class ResponseExampleCaptureRequestError extends Error {
  constructor(
    public readonly code: string | null,
    message: string
  ) {
    super(message)
    this.name = 'ResponseExampleCaptureRequestError'
  }
}

function getPersistedHash() {
  const hash = (hashes as Record<string, string>)[
    RESPONSE_EXAMPLE_CAPTURE_OPERATION
  ]
  if (!hash) {
    throw new Error(
      `Missing persisted GraphQL hash for ${RESPONSE_EXAMPLE_CAPTURE_OPERATION}`
    )
  }
  return hash
}

export function buildResponseExampleCaptureGraphqlRequest(input: {
  chatbotId: string
  receipt: string
  question: string
  answer: string
}) {
  return {
    extensions: {
      persistedQuery: {
        sha256Hash: getPersistedHash(),
        version: 1,
      },
    },
    operationName: RESPONSE_EXAMPLE_CAPTURE_OPERATION,
    variables: input,
  }
}

export async function captureResponseExampleThroughManage({
  fetchImpl = fetch,
  graphqlEndpoint,
  input,
  manageOrigin,
  sessionToken,
}: {
  fetchImpl?: typeof fetch
  graphqlEndpoint: string
  input: {
    chatbotId: string
    receipt: string
    question: string
    answer: string
  }
  manageOrigin: string
  sessionToken: string
}) {
  const response = await fetchImpl(graphqlEndpoint, {
    body: JSON.stringify(buildResponseExampleCaptureGraphqlRequest(input)),
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
    throw new ResponseExampleCaptureRequestError(
      null,
      `Manage GraphQL capture failed: ${response.status}`
    )
  }

  const result = (await response.json()) as {
    data?: { captureResponseExample?: unknown }
    errors?: { message?: unknown; extensions?: { code?: unknown } }[]
  }
  const error = result.errors?.[0]
  if (error) {
    throw new ResponseExampleCaptureRequestError(
      typeof error.extensions?.code === 'string' ? error.extensions.code : null,
      typeof error.message === 'string'
        ? error.message
        : 'Manage GraphQL capture returned an error'
    )
  }

  if (result.data?.captureResponseExample == null) {
    throw new ResponseExampleCaptureRequestError(
      'NOT_FOUND',
      'Chatbot not found'
    )
  }
  const parsed = captureResultSchema.safeParse(
    result.data.captureResponseExample
  )
  if (!parsed.success) {
    throw new ResponseExampleCaptureRequestError(
      null,
      'Manage GraphQL capture returned an invalid result'
    )
  }
  return parsed.data
}
