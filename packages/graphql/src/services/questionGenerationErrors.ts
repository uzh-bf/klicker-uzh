import { GraphQLError } from 'graphql'

export type QuestionGenerationErrorCode =
  | 'ARTIFACT_DIGEST_MISMATCH'
  | 'ARTIFACT_INVALID'
  | 'ARTIFACT_NOT_FOUND'
  | 'ARTIFACT_UPLOAD_CONFLICT'
  | 'CONFIGURATION_INVALID'
  | 'CONCURRENT_MODIFICATION'
  | 'DRAFT_INVALID'
  | 'GENERATED_QUESTION_DRAFT_NOT_FOUND'
  | 'GENERATED_FLASHCARD_DRAFT_NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_STAGE'
  | 'KB_GRAPH_NOT_FOUND'
  | 'KB_GRAPH_STALE'
  | 'QUESTION_GENERATION_BUILD_NOT_FOUND'
  | 'FLASHCARD_GENERATION_BUILD_NOT_FOUND'
  | 'QUESTION_GENERATION_UNAVAILABLE'
  | 'REVIEW_CONFLICT'
  | 'REVIEW_WARNINGS_NOT_ACKNOWLEDGED'
  | 'SAVE_VALIDATION_FAILED'
  | 'WORKFLOW_DISPATCH_UNCERTAIN'
  | 'WORKFLOW_STATUS_UNAVAILABLE'

export class QuestionGenerationServiceError extends Error {
  readonly code: QuestionGenerationErrorCode
  readonly retryable: boolean

  constructor(
    code: QuestionGenerationErrorCode,
    message: string,
    retryable = false
  ) {
    super(message)
    this.name = 'QuestionGenerationServiceError'
    this.code = code
    this.retryable = retryable
  }
}

export function questionGenerationServiceError(
  code: QuestionGenerationErrorCode,
  message: string,
  retryable = false
): QuestionGenerationServiceError {
  return new QuestionGenerationServiceError(code, message, retryable)
}

export function questionGenerationGraphQLError(
  error: QuestionGenerationServiceError
): GraphQLError {
  return new GraphQLError(error.message, {
    extensions: {
      code: error.code,
      retryable: error.retryable,
    },
  })
}

export async function questionGenerationGraphQLResult<T>(
  result: Promise<T>
): Promise<T> {
  try {
    return await result
  } catch (error) {
    if (error instanceof QuestionGenerationServiceError) {
      throw questionGenerationGraphQLError(error)
    }
    throw error
  }
}

type PublicElementGenerationErrorCode =
  | Exclude<
      QuestionGenerationErrorCode,
      | 'QUESTION_GENERATION_BUILD_NOT_FOUND'
      | 'FLASHCARD_GENERATION_BUILD_NOT_FOUND'
      | 'GENERATED_QUESTION_DRAFT_NOT_FOUND'
      | 'GENERATED_FLASHCARD_DRAFT_NOT_FOUND'
      | 'QUESTION_GENERATION_UNAVAILABLE'
    >
  | 'ELEMENT_GENERATION_BUILD_NOT_FOUND'
  | 'GENERATED_ELEMENT_DRAFT_NOT_FOUND'
  | 'ELEMENT_GENERATION_UNAVAILABLE'

function publicElementGenerationErrorCode(
  code: QuestionGenerationErrorCode
): PublicElementGenerationErrorCode {
  switch (code) {
    case 'QUESTION_GENERATION_BUILD_NOT_FOUND':
    case 'FLASHCARD_GENERATION_BUILD_NOT_FOUND':
      return 'ELEMENT_GENERATION_BUILD_NOT_FOUND'
    case 'GENERATED_QUESTION_DRAFT_NOT_FOUND':
    case 'GENERATED_FLASHCARD_DRAFT_NOT_FOUND':
      return 'GENERATED_ELEMENT_DRAFT_NOT_FOUND'
    case 'QUESTION_GENERATION_UNAVAILABLE':
      return 'ELEMENT_GENERATION_UNAVAILABLE'
    default:
      return code
  }
}

export async function elementGenerationGraphQLResult<T>(
  result: Promise<T>
): Promise<T> {
  try {
    return await result
  } catch (error) {
    if (error instanceof QuestionGenerationServiceError) {
      throw new GraphQLError(error.message, {
        extensions: {
          code: publicElementGenerationErrorCode(error.code),
          retryable: error.retryable,
        },
      })
    }
    throw error
  }
}
