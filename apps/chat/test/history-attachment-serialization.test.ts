import { describe, expect, test } from 'vitest'
import {
  convertApiMessageToMessage,
  type ApiMessage,
} from '../src/lib/api/types'
import { buildHistoryAttachmentDto } from '../src/lib/attachments/attachmentState'

describe('buildHistoryAttachmentDto', () => {
  test('returns preview-safe history data and never exposes imageBase64', () => {
    const result = buildHistoryAttachmentDto({
      id: 'att-1',
      position: 0,
      imageBase64: 'data:image/png;base64,FULL',
      imagePreviewBase64: 'data:image/png;base64,PREVIEW',
      imageDescription: 'chart screenshot',
    })

    expect(result).toEqual({
      id: 'att-1',
      type: 'image',
      position: 0,
      imagePreviewBase64: 'data:image/png;base64,PREVIEW',
      imageDescription: 'chart screenshot',
      hasFullImage: true,
    })

    expect(result).not.toHaveProperty('imageBase64')
  })
})

describe('convertApiMessageToMessage', () => {
  test('preserves preview-safe history attachment fields and sorts by position', () => {
    const apiMessage: ApiMessage = {
      id: 'msg-1',
      threadId: 'thread-1',
      role: 'user',
      content: [{ type: 'text', text: 'hello' }],
      imageAttachments: [
        {
          id: 'att-2',
          type: 'image',
          position: 1,
          imagePreviewBase64: 'data:image/png;base64,PREVIEW_2',
          imageDescription: 'second image',
          hasFullImage: true,
        },
        {
          id: 'att-1',
          type: 'image',
          position: 0,
          imagePreviewBase64: 'data:image/png;base64,PREVIEW_1',
          imageDescription: 'first image',
          hasFullImage: false,
        },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    expect(convertApiMessageToMessage(apiMessage).imageAttachments).toEqual([
      {
        id: 'att-1',
        type: 'image',
        position: 0,
        imagePreviewBase64: 'data:image/png;base64,PREVIEW_1',
        imageDescription: 'first image',
        hasFullImage: false,
      },
      {
        id: 'att-2',
        type: 'image',
        position: 1,
        imagePreviewBase64: 'data:image/png;base64,PREVIEW_2',
        imageDescription: 'second image',
        hasFullImage: true,
      },
    ])
  })
})
