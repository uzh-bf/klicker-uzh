import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { imageAttachmentAdapter } from '../src/lib/attachments/imageAttachmentAdapter'

class MockFileReader {
  result: string | ArrayBuffer | null = null
  onload: null | (() => void) = null
  onerror: null | (() => void) = null

  readAsDataURL() {
    this.result = 'data:image/png;base64,FULL_IMAGE'
    this.onload?.()
  }
}

describe('imageAttachmentAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    vi.stubGlobal('FileReader', MockFileReader as any)
    vi.stubGlobal('crypto', {
      randomUUID: () => 'attachment-1',
    })
    vi.stubGlobal('window', {} as Window & typeof globalThis)
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:preview-source',
      revokeObjectURL: vi.fn(),
    })

    const drawImage = vi.fn()
    const toDataURL = vi.fn(() => 'data:image/jpeg;base64,PREVIEW_IMAGE')
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({ drawImage })),
        toDataURL,
      })),
    } as unknown as Document)

    vi.stubGlobal(
      'Image',
      class MockImage {
        width = 1024
        height = 768
        onload: null | (() => void) = null
        onerror: null | (() => void) = null

        set src(_value: string) {
          this.onload?.()
        }
      } as unknown as typeof Image
    )
  })

  test('add returns image content with a generated preview payload', async () => {
    const file = new File(['hello'], 'image.png', { type: 'image/png' })

    const attachment = await imageAttachmentAdapter.add({ file } as any)

    expect(attachment).toMatchObject({
      id: 'attachment-1',
      type: 'image',
      content: [
        {
          type: 'image',
          image: 'data:image/png;base64,FULL_IMAGE',
          imagePreview: 'data:image/jpeg;base64,PREVIEW_IMAGE',
        },
      ],
    })
  })
})
