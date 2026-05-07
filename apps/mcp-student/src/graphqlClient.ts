import hashes from '@klicker-uzh/graphql/dist/client.json'
import type {
  GetCoursePracticeQuizWithoutSolutionsQuery,
  GetCoursePracticeQuizWithoutSolutionsQueryVariables,
  RespondToElementStackMutation,
  RespondToElementStackMutationVariables,
} from '@klicker-uzh/graphql/dist/ops.js'
import type {
  StudentMcpPracticeQuiz as PracticeQuiz,
  StudentMcpStackResponseInput as StackResponseInput,
} from '@klicker-uzh/types'

const PERSISTED_OPERATION_HASHES = hashes as Record<string, string>

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

function operationHash(operationName: string): string {
  const hash = PERSISTED_OPERATION_HASHES[operationName]
  if (!hash) {
    throw new Error(`GraphQL persisted hash missing for ${operationName}`)
  }
  return hash
}

export class PersistedGraphQLClient {
  constructor(
    private readonly endpoint: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async execute<TData, TVariables extends Record<string, unknown>>(
    operationName: string,
    variables: TVariables,
    bearerToken: string
  ): Promise<TData> {
    const response = await this.fetchImpl(this.endpoint, {
      body: JSON.stringify({
        operationName,
        variables,
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: operationHash(operationName),
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

  async getCoursePracticeQuiz(
    input: { chatbotId: string; courseId: string },
    bearerToken: string
  ): Promise<PracticeQuiz | null> {
    const data = await this.execute<
      GetCoursePracticeQuizWithoutSolutionsQuery,
      GetCoursePracticeQuizWithoutSolutionsQueryVariables
    >(
      'GetCoursePracticeQuizWithoutSolutions',
      {
        chatbotId: input.chatbotId,
        courseId: input.courseId,
      },
      bearerToken
    )

    return (
      (data.studentMcpCoursePracticeQuiz as unknown as PracticeQuiz | null) ??
      null
    )
  }

  async submitStackAnswer(
    input: SubmitStackAnswerInput,
    bearerToken: string
  ): Promise<unknown> {
    const data = await this.execute<
      RespondToElementStackMutation,
      RespondToElementStackMutationVariables
    >(
      'RespondToElementStack',
      {
        courseId: input.courseId,
        isOwner: false,
        responses:
          input.responses as unknown as RespondToElementStackMutationVariables['responses'],
        stackAnswerTime: input.stackAnswerTimeSeconds,
        stackId: input.stackId,
      },
      bearerToken
    )
    return data.respondToElementStack ?? null
  }
}
