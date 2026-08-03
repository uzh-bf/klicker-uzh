import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  from,
  type NormalizedCacheObject,
  type OperationVariables,
  type TypedDocumentNode,
} from '@apollo/client/core'
import { createPersistedQueryLink } from '@apollo/client/link/persisted-queries'
import hashes from '@klicker-uzh/graphql/dist/client.json' with { type: 'json' }
import {
  GetCoursePracticeQuizWithoutSolutionsDocument,
  RespondToElementStackDocument,
  type GetCoursePracticeQuizWithoutSolutionsQuery,
  type GetCoursePracticeQuizWithoutSolutionsQueryVariables,
  type RespondToElementStackMutation,
  type RespondToElementStackMutationVariables,
} from '@klicker-uzh/graphql/dist/ops.js'
import type {
  StudentMcpPracticeQuiz as PracticeQuiz,
  StudentMcpStackResponseInput as StackResponseInput,
} from '@klicker-uzh/types'
import type { DocumentNode, OperationDefinitionNode } from 'graphql'

const PERSISTED_OPERATION_HASHES = hashes as Record<string, string>

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

function documentOperationName(document: DocumentNode): string {
  const definition = document.definitions.find(
    (value): value is OperationDefinitionNode =>
      value.kind === 'OperationDefinition'
  )

  if (!definition?.name?.value) {
    throw new Error('GraphQL document is missing an operation name')
  }

  return definition.name.value
}

export class PersistedGraphQLClient {
  private readonly client: ApolloClient<NormalizedCacheObject>

  constructor(endpoint: string, fetchImpl: typeof fetch = fetch) {
    this.client = new ApolloClient({
      cache: new InMemoryCache(),
      link: from([
        createPersistedQueryLink({
          generateHash: (document) =>
            operationHash(documentOperationName(document)),
          retry: () => false,
        }),
        new HttpLink({
          fetch: fetchImpl,
          headers: {
            Accept: 'application/json',
            'x-graphql-yoga-csrf': 'true',
          },
          uri: endpoint,
        }),
      ]),
    })
  }

  private authContext(bearerToken: string) {
    return {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    }
  }

  private async query<
    TData,
    TVariables extends OperationVariables = OperationVariables,
  >(
    query: TypedDocumentNode<TData, TVariables>,
    variables: TVariables,
    bearerToken: string
  ): Promise<TData> {
    const operationName = documentOperationName(query)
    const result = await this.withOperationError(
      operationName,
      this.client.query<TData, TVariables>({
        context: this.authContext(bearerToken),
        fetchPolicy: 'no-cache',
        query,
        variables,
      })
    )

    return this.requireData(operationName, result)
  }

  private async mutate<
    TData,
    TVariables extends OperationVariables = OperationVariables,
  >(
    mutation: TypedDocumentNode<TData, TVariables>,
    variables: TVariables,
    bearerToken: string
  ): Promise<TData> {
    const operationName = documentOperationName(mutation)
    const result = await this.withOperationError(
      operationName,
      this.client.mutate<TData, TVariables>({
        context: this.authContext(bearerToken),
        fetchPolicy: 'no-cache',
        mutation,
        variables,
      })
    )

    return this.requireData(operationName, result)
  }

  private async withOperationError<T>(
    operationName: string,
    operation: Promise<T>
  ): Promise<T> {
    try {
      return await operation
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`GraphQL ${operationName} failed: ${message}`)
    }
  }

  private requireData<TData>(
    operationName: string,
    result: { data?: TData | null }
  ): TData {
    if (!result.data) {
      throw new Error(`GraphQL ${operationName} returned no data`)
    }

    return result.data
  }

  async getCoursePracticeQuiz(
    input: { chatbotId: string; courseId: string },
    bearerToken: string
  ): Promise<PracticeQuiz | null> {
    const data = await this.query<
      GetCoursePracticeQuizWithoutSolutionsQuery,
      GetCoursePracticeQuizWithoutSolutionsQueryVariables
    >(
      GetCoursePracticeQuizWithoutSolutionsDocument,
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
    const data = await this.mutate<
      RespondToElementStackMutation,
      RespondToElementStackMutationVariables
    >(
      RespondToElementStackDocument,
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
