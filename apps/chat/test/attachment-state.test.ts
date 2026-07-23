import { describe, expect, test } from 'vitest'
import {
  hasAllImageAttachmentsHydrated,
  mergeHydratedAttachments,
  sortAttachmentsByPosition,
} from '../src/lib/attachments/attachmentState'

describe('attachmentState', () => {
  test('sortAttachmentsByPosition sorts attachments by ascending position', () => {
    expect(
      sortAttachmentsByPosition([
        { id: 'b', position: 1 },
        { id: 'a', position: 0 },
        { id: 'c', position: 2 },
      ])
    ).toEqual([
      { id: 'a', position: 0 },
      { id: 'b', position: 1 },
      { id: 'c', position: 2 },
    ])
  })

  test('mergeHydratedAttachments merges by id, keeps preview fields, and returns stable position order', () => {
    const previewOnly = [
      {
        id: 'att-2',
        type: 'image' as const,
        position: 1,
        imagePreviewBase64: 'preview-2',
        imageDescription: 'second attachment',
      },
      {
        id: 'att-1',
        type: 'image' as const,
        position: 0,
        imagePreviewBase64: 'preview-1',
        imageDescription: 'first attachment',
      },
    ]

    const hydrated = [
      {
        id: 'att-2',
        type: 'image' as const,
        position: 1,
        imageBase64: 'full-2',
      },
      {
        id: 'att-1',
        type: 'image' as const,
        position: 0,
        imageBase64: 'full-1',
        imagePreviewBase64: null,
        imageDescription: null,
      },
    ]

    expect(mergeHydratedAttachments(previewOnly, hydrated)).toEqual([
      {
        id: 'att-1',
        type: 'image',
        position: 0,
        imageBase64: 'full-1',
        imagePreviewBase64: 'preview-1',
        imageDescription: 'first attachment',
        hasFullImage: true,
      },
      {
        id: 'att-2',
        type: 'image',
        position: 1,
        imageBase64: 'full-2',
        imagePreviewBase64: 'preview-2',
        imageDescription: 'second attachment',
        hasFullImage: true,
      },
    ])
  })

  test('mergeHydratedAttachments preserves source structural fields while hydrating payload fields', () => {
    const previewOnly = [
      {
        id: 'att-1',
        type: 'image' as const,
        position: 0,
        imagePreviewBase64: 'preview-1',
        imageDescription: 'first attachment',
      },
    ]

    const hydrated = [
      {
        id: 'att-1',
        type: 'image' as const,
        position: 99,
        imageBase64: 'full-1',
        imagePreviewBase64: 'preview-1-hydrated',
        imageDescription: 'first attachment hydrated',
      },
    ]

    expect(mergeHydratedAttachments(previewOnly, hydrated)).toEqual([
      {
        id: 'att-1',
        type: 'image',
        position: 0,
        imageBase64: 'full-1',
        imagePreviewBase64: 'preview-1-hydrated',
        imageDescription: 'first attachment hydrated',
        hasFullImage: true,
      },
    ])
  })

  test('hasAllImageAttachmentsHydrated returns true for empty attachments', () => {
    expect(hasAllImageAttachmentsHydrated()).toBe(true)
    expect(hasAllImageAttachmentsHydrated([])).toBe(true)
  })

  test('hasAllImageAttachmentsHydrated returns false when any attachment is preview-only', () => {
    expect(
      hasAllImageAttachmentsHydrated([
        {
          id: 'att-1',
          type: 'image',
          position: 0,
          imageBase64: 'full-1',
        },
        {
          id: 'att-2',
          type: 'image',
          position: 1,
          imagePreviewBase64: 'preview-2',
          imageDescription: 'second attachment',
        },
      ])
    ).toBe(false)
  })

  test('hasAllImageAttachmentsHydrated returns true only when every image attachment has full image data', () => {
    expect(
      hasAllImageAttachmentsHydrated([
        {
          id: 'att-2',
          type: 'image',
          position: 1,
          imageBase64: 'full-2',
          imagePreviewBase64: 'preview-2',
          imageDescription: 'second attachment',
        },
        {
          id: 'att-1',
          type: 'image',
          position: 0,
          imageBase64: 'full-1',
          imagePreviewBase64: 'preview-1',
          imageDescription: 'first attachment',
        },
      ])
    ).toBe(true)
  })
})
