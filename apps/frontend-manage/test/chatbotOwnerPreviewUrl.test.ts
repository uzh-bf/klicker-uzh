import assert from 'node:assert/strict'
import { buildChatbotOwnerPreviewUrl } from '../src/components/resources/chatbots/chatbotOwnerPreviewUrl'

assert.equal(
  buildChatbotOwnerPreviewUrl({
    chatbotId: 'chatbot/id',
    chatUrl: 'https://chat.klicker.test/',
  }),
  'https://chat.klicker.test/preview/chatbot%2Fid'
)

assert.equal(
  buildChatbotOwnerPreviewUrl({
    chatbotId: 'chatbot-id',
  }),
  null
)
