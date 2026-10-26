import assert from 'node:assert/strict'
import {
  getChatbotGraphQLErrorMessage,
  getChatbotMutationErrorKey,
} from '../src/components/resources/chatbots/chatbotErrorMessages.ts'

// The custom-mode section shows the server message because it names the field
// that has to be corrected. Every other failure class carries transport or
// server text, which the localized fallbacks own.
assert.equal(
  getChatbotGraphQLErrorMessage({
    graphQLErrors: [
      {
        message: 'Mode name "Tutor" is reserved',
        extensions: { code: 'BAD_USER_INPUT' },
      },
    ],
  }),
  'Mode name "Tutor" is reserved'
)

assert.equal(
  getChatbotGraphQLErrorMessage({
    message: 'Response not successful: Received status code 500',
  }),
  undefined
)

assert.equal(
  getChatbotGraphQLErrorMessage(new Error('Failed to fetch')),
  undefined
)

assert.equal(
  getChatbotGraphQLErrorMessage({
    graphQLErrors: [
      {
        message: 'Chatbot is not editable',
        extensions: { code: 'CHATBOT_NOT_EDITABLE' },
      },
    ],
  }),
  undefined
)

// The localized key is what the caller falls back to for those errors.
assert.equal(
  getChatbotMutationErrorKey(new Error('Failed to fetch'), 'customMode'),
  'manage.resources.chatbotCustomModesSaveError'
)
