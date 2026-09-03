export type ChatbotMutation =
  | 'create'
  | 'metadata'
  | 'disclaimer'
  | 'publication'

type ChatbotErrorCode =
  | 'CHATBOT_NOT_EDITABLE'
  | 'CHATBOT_EDIT_CONFLICT'
  | 'CHATBOT_DISCLAIMER_CONFLICT'
  | 'CHATBOT_DISCLAIMER_REQUIRED'
  | 'BAD_USER_INPUT'
  | 'FORBIDDEN'

export type ChatbotErrorMessageKey =
  | 'manage.resources.chatbotErrorNotEditable'
  | 'manage.resources.chatbotErrorEditConflict'
  | 'manage.resources.chatbotErrorDisclaimerConflict'
  | 'manage.resources.chatbotErrorBadUserInput'
  | 'manage.resources.chatbotErrorForbidden'
  | 'manage.resources.chatbotCreateError'
  | 'manage.resources.chatbotMetadataSaveError'
  | 'manage.resources.chatbotDisclaimerSaveError'
  | 'manage.resources.chatbotPublicationRequestError'
  | 'manage.resources.chatbotPublicationUnauthorized'
  | 'manage.resources.chatbotPublicationUseCaseInvalid'
  | 'manage.resources.chatbotPublicationExpectedStudentCountInvalid'
  | 'manage.resources.chatbotPublicationProposedCreditsInvalid'
  | 'manage.resources.chatbotPublicationDisclaimerRequired'

const errorMessageKeys: Record<ChatbotErrorCode, ChatbotErrorMessageKey> = {
  CHATBOT_NOT_EDITABLE: 'manage.resources.chatbotErrorNotEditable',
  CHATBOT_EDIT_CONFLICT: 'manage.resources.chatbotErrorEditConflict',
  CHATBOT_DISCLAIMER_CONFLICT:
    'manage.resources.chatbotErrorDisclaimerConflict',
  CHATBOT_DISCLAIMER_REQUIRED:
    'manage.resources.chatbotPublicationDisclaimerRequired',
  BAD_USER_INPUT: 'manage.resources.chatbotErrorBadUserInput',
  FORBIDDEN: 'manage.resources.chatbotErrorForbidden',
}

const fallbackMessageKeys: Record<ChatbotMutation, ChatbotErrorMessageKey> = {
  create: 'manage.resources.chatbotCreateError',
  metadata: 'manage.resources.chatbotMetadataSaveError',
  disclaimer: 'manage.resources.chatbotDisclaimerSaveError',
  publication: 'manage.resources.chatbotPublicationRequestError',
}

function getGraphQLErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined

  const extensions = (error as { extensions?: { code?: unknown } }).extensions
  if (typeof extensions?.code === 'string') return extensions.code

  const graphQLErrors = (error as { graphQLErrors?: unknown }).graphQLErrors
  if (Array.isArray(graphQLErrors)) {
    for (const graphQLError of graphQLErrors) {
      const code = getGraphQLErrorCode(graphQLError)
      if (code) return code
    }
  }

  const errors = (error as { errors?: unknown }).errors
  if (Array.isArray(errors)) {
    for (const nestedError of errors) {
      const code = getGraphQLErrorCode(nestedError)
      if (code) return code
    }
  }

  return undefined
}

function getGraphQLErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined

  const message = (error as { message?: unknown }).message
  if (typeof message === 'string') return message

  const graphQLErrors = (error as { graphQLErrors?: unknown }).graphQLErrors
  if (Array.isArray(graphQLErrors)) {
    for (const graphQLError of graphQLErrors) {
      const nestedMessage = getGraphQLErrorMessage(graphQLError)
      if (nestedMessage) return nestedMessage
    }
  }

  const errors = (error as { errors?: unknown }).errors
  if (Array.isArray(errors)) {
    for (const nestedError of errors) {
      const nestedMessage = getGraphQLErrorMessage(nestedError)
      if (nestedMessage) return nestedMessage
    }
  }

  return undefined
}

export function getChatbotMutationErrorKey(
  error: unknown,
  mutation: ChatbotMutation
): ChatbotErrorMessageKey {
  const code = getGraphQLErrorCode(error)
  if (code && Object.hasOwn(errorMessageKeys, code)) {
    return errorMessageKeys[code as ChatbotErrorCode]
  }

  if (mutation === 'publication') {
    const message = getGraphQLErrorMessage(error)
    if (message?.includes('Account is not approved')) {
      return 'manage.resources.chatbotPublicationUnauthorized'
    }
    if (message?.includes('useCase must be')) {
      return 'manage.resources.chatbotPublicationUseCaseInvalid'
    }
    if (message?.includes('expectedStudentCount must be')) {
      return 'manage.resources.chatbotPublicationExpectedStudentCountInvalid'
    }
    if (message?.includes('proposedCredits must be')) {
      return 'manage.resources.chatbotPublicationProposedCreditsInvalid'
    }
  }

  return fallbackMessageKeys[mutation]
}
