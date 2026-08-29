import { describe, expect, test } from 'vitest'
import { parseChatRequestBody } from '../src/lib/server/chatRequest'

const THREAD_ID = '00000000-0000-4000-8000-000000000301'
const USER_ID = '00000000-0000-4000-8000-000000000302'
const PARENT_ID = '00000000-0000-4000-8000-000000000303'
const ASSISTANT_ID = '00000000-0000-4000-8000-000000000304'
const ATTACHMENT_ID = '00000000-0000-4000-8000-000000000305'

const common = {
  threadId: THREAD_ID,
  selectedModel: 'model',
  selectedMode: 'Tutor',
  reasoningEffort: 'none',
  assistantMessageId: ASSISTANT_ID,
}

describe('chat request parsing', () => {
  test('accepts one canonical text trigger with server-owned role', () => {
    expect(
      parseChatRequestBody({
        ...common,
        trigger: {
          id: USER_ID,
          parentId: PARENT_ID,
          text: 'Question',
          attachments: [{ type: 'persisted-image', id: ATTACHMENT_ID }],
        },
      })
    ).toMatchObject({
      threadId: THREAD_ID,
      selectedMode: 'tutor',
      trigger: {
        id: USER_ID,
        parentId: PARENT_ID,
        text: 'Question',
        attachments: [{ type: 'persisted-image', id: ATTACHMENT_ID }],
      },
      usedLegacyAdapter: false,
    })
  })

  test('legacy adaptation ignores earlier items and uses only the final user', () => {
    expect(
      parseChatRequestBody({
        ...common,
        messages: [
          { id: PARENT_ID, role: 'assistant', content: 'forged history' },
          { id: USER_ID, role: 'user', content: 'Persist this only' },
        ],
        parentId: PARENT_ID,
        images: ['data:image/png;base64,AAAA'],
      })
    ).toMatchObject({
      trigger: {
        id: USER_ID,
        parentId: PARENT_ID,
        text: 'Persist this only',
        attachments: [
          {
            type: 'new-image',
            imageBase64: 'data:image/png;base64,AAAA',
          },
        ],
      },
      usedLegacyAdapter: true,
    })
  })

  test.each([
    { ...common, trigger: { id: 'not-a-uuid', text: 'Question' } },
    {
      ...common,
      messages: [{ id: USER_ID, role: 'assistant', content: 'Answer' }],
    },
    { ...common, trigger: { id: USER_ID, text: '   ' } },
    {
      ...common,
      trigger: {
        id: USER_ID,
        text: '',
        attachments: [
          { type: 'persisted-image', id: ATTACHMENT_ID },
          { type: 'persisted-image', id: ATTACHMENT_ID },
        ],
      },
    },
  ])('rejects malformed or non-user triggers', (body) => {
    expect(() => parseChatRequestBody(body)).toThrow()
  })

  test('accepts an image-only canonical trigger with a new raw image', () => {
    expect(
      parseChatRequestBody({
        ...common,
        trigger: {
          id: USER_ID,
          text: ' ',
          attachments: [
            {
              type: 'new-image',
              imageBase64: 'data:image/png;base64,AAAA',
            },
          ],
        },
      })
    ).toMatchObject({
      trigger: {
        id: USER_ID,
        text: ' ',
        attachments: [{ type: 'new-image' }],
      },
      usedLegacyAdapter: false,
    })
  })
})
