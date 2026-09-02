export type ChatbotMutation = 'create' | 'metadata' | 'disclaimer'

type ChatbotErrorCode =
  | 'CHATBOT_NOT_EDITABLE'
  | 'CHATBOT_EDIT_CONFLICT'
  | 'CHATBOT_DISCLAIMER_CONFLICT'
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

const errorMessageKeys: Record<ChatbotErrorCode, ChatbotErrorMessageKey> = {
  CHATBOT_NOT_EDITABLE: 'manage.resources.chatbotErrorNotEditable',
  CHATBOT_EDIT_CONFLICT: 'manage.resources.chatbotErrorEditConflict',
  CHATBOT_DISCLAIMER_CONFLICT:
    'manage.resources.chatbotErrorDisclaimerConflict',
  BAD_USER_INPUT: 'manage.resources.chatbotErrorBadUserInput',
  FORBIDDEN: 'manage.resources.chatbotErrorForbidden',
}

const fallbackMessageKeys: Record<ChatbotMutation, ChatbotErrorMessageKey> = {
  create: 'manage.resources.chatbotCreateError',
  metadata: 'manage.resources.chatbotMetadataSaveError',
  disclaimer: 'manage.resources.chatbotDisclaimerSaveError',
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

export function getChatbotMutationErrorKey(
  error: unknown,
  mutation: ChatbotMutation
): ChatbotErrorMessageKey {
  const code = getGraphQLErrorCode(error)
  if (code && Object.hasOwn(errorMessageKeys, code)) {
    return errorMessageKeys[code as ChatbotErrorCode]
  }

  return fallbackMessageKeys[mutation]
}
