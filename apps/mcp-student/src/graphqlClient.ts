import type { StackResponseInput } from './types.js'

const OPERATION_HASHES = {
  RespondToElementStack:
    '900f2b533ba1e22d5bc1683c3c29eab93fc4cad1496feba858fe9f6a7b2ddc69',
} as const

type OperationName = keyof typeof OPERATION_HASHES

type GraphQLResponse<T> = {
  data?: T
  errors?: Array<{ message?: string }>
}

export type SubmitStackAnswerInput = {
  courseId: string
  responses: StackResponseInput[]
  stackAnswerTimeSeconds: number
  stackId: number
}

export class PersistedGraphQLClient {
  constructor(
    private readonly endpoint: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async execute<TData>(
    operationName: OperationName,
    variables: Record<string, unknown>,
    bearerToken: string
  ): Promise<TData> {
    const response = await this.fetchImpl(this.endpoint, {
      body: JSON.stringify({
        operationName,
        variables,
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: OPERATION_HASHES[operationName],
          },
        },
      }),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
        'x-graphql-yoga-csrf': 'true',
      },
      method: 'POST',
    })

    if (!response.ok) {
      throw new Error(
        `GraphQL ${operationName} failed with HTTP ${response.status}`
      )
    }

    const payload = (await response.json()) as GraphQLResponse<TData>
    if (payload.errors?.length) {
      throw new Error(
        payload.errors
          .map((error) => error.message ?? 'Unknown GraphQL error')
          .join('; ')
      )
    }

    if (!payload.data) {
      throw new Error(`GraphQL ${operationName} returned no data`)
    }

    return payload.data
  }

  async submitStackAnswer(
    input: SubmitStackAnswerInput,
    bearerToken: string
  ): Promise<unknown> {
    const data = await this.execute<{
      respondToElementStack?: unknown
    }>(
      'RespondToElementStack',
      {
        courseId: input.courseId,
        isOwner: false,
        responses: input.responses,
        stackAnswerTime: input.stackAnswerTimeSeconds,
        stackId: input.stackId,
      },
      bearerToken
    )
    return data.respondToElementStack ?? null
  }
}
