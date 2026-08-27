import { describe, expect, it } from 'vitest'
import { buildChatbotOwnerPreviewUrl } from '../../frontend-manage/src/components/resources/chatbots/chatbotOwnerPreviewUrl'

describe('buildChatbotOwnerPreviewUrl', () => {
  it('builds a stable preview URL without locale or embed parameters', () => {
    expect(
      buildChatbotOwnerPreviewUrl({
        chatbotId: 'chatbot/id',
        chatUrl: 'https://chat.klicker.test/',
      })
    ).toBe('https://chat.klicker.test/preview/chatbot%2Fid')
  })

  it('keeps the preview action unavailable without a configured chat URL', () => {
    expect(
      buildChatbotOwnerPreviewUrl({
        chatbotId: 'chatbot-id',
      })
    ).toBeNull()
  })
})
