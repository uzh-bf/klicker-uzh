import { describe, expect, test } from 'vitest'
import { hasAnyImageAttachmentData } from '../src/lib/attachments/attachmentState'
import {
  canOpenMessageAttachment,
  canUseComposerAttachments,
  getAttachmentPreviewSrc,
} from '../src/lib/attachments/attachmentUi'

describe('message attachment behavior', () => {
  test('disables attachment ingestion when the surface allows zero images', () => {
    expect(
      canUseComposerAttachments({
        maxImageAttachments: 0,
        supportsImages: true,
      })
    ).toBe(false)
    expect(
      canUseComposerAttachments({
        maxImageAttachments: 1,
        supportsImages: true,
      })
    ).toBe(true)
  })

  test('same-session local images prefer previews inline and remain directly openable without persisted ids', () => {
    const attachment = {
      type: 'image' as const,
      imageBase64: 'data:image/png;base64,FULL',
      imagePreviewBase64: 'data:image/png;base64,PREVIEW',
      hasFullImage: true,
    }

    expect(getAttachmentPreviewSrc(attachment, 'history')).toBe(
      'data:image/png;base64,PREVIEW'
    )
    expect(
      canOpenMessageAttachment({
        attachment,
        canHydratePersistedAttachment: false,
      })
    ).toEqual({ canOpen: true, shouldHydrate: false })
  })

  test('persisted history attachments stay preview-only even after hydration', () => {
    const attachment = {
      id: 'att-1',
      type: 'image' as const,
      imageBase64: 'data:image/png;base64,FULL',
      imagePreviewBase64: 'data:image/png;base64,PREVIEW',
      hasFullImage: true,
    }

    expect(getAttachmentPreviewSrc(attachment, 'history')).toBe(
      'data:image/png;base64,PREVIEW'
    )
  })

  test('preview-only persisted images remain hydration-backed openable when message context exists', () => {
    const attachment = {
      id: 'att-1',
      type: 'image' as const,
      imagePreviewBase64: 'data:image/png;base64,PREVIEW',
      hasFullImage: false,
    }

    expect(
      canOpenMessageAttachment({
        attachment,
        canHydratePersistedAttachment: true,
      })
    ).toEqual({ canOpen: true, shouldHydrate: true })
  })

  test('preview-only attachments still count as image-bearing for edit guard logic', () => {
    expect(
      hasAnyImageAttachmentData([
        {
          id: 'att-1',
          type: 'image',
          position: 0,
          imagePreviewBase64: 'data:image/png;base64,PREVIEW',
          hasFullImage: false,
        },
      ])
    ).toBe(true)
  })
})
