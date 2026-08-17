import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  ATTACHMENT_ERROR_CODE,
  AttachmentAdapterError,
  imageAttachmentAdapter,
} from '../src/lib/attachments/imageAttachmentAdapter'

class MockFileReader {
  result: string | ArrayBuffer | null = null
  onload: null | (() => void) = null
  onerror: null | (() => void) = null

  readAsDataURL() {
    this.result = 'data:image/png;base64,FULL_IMAGE'
    this.onload?.()
  }
}

// Simulates a FileReader that fails to read the file (e.g. a corrupt or
// unreadable blob). The real FileReader invokes `onerror` with a
// ProgressEvent; the fake event object here stands in for it since the
// adapter must produce the same typed error regardless of the event shape.
class FailingMockFileReader {
  result: string | ArrayBuffer | null = null
  onload: null | (() => void) = null
  onerror: null | ((event: unknown) => void) = null

  readAsDataURL() {
    this.onerror?.({ type: 'error' })
  }
}

describe('imageAttachmentAdapter', () => {
  // The suite shares one fork, and the config-level `unstubGlobals` only runs
  // before each test — after the NEXT file has already been imported. A leaked
  // `window`/`URL` stub at that import breaks module-level feature detection
  // (e.g. zustand persist), so this file must restore globals itself.
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

  test('add rejects with a typed, stable-code error instead of the raw FileReader event', async () => {
    vi.stubGlobal('FileReader', FailingMockFileReader as any)
    const file = new File(['hello'], 'image.png', { type: 'image/png' })

    let caught: unknown
    try {
      await imageAttachmentAdapter.add({ file } as any)
    } catch (e) {
      caught = e
    }

    expect(caught).toBeInstanceOf(AttachmentAdapterError)
    expect((caught as AttachmentAdapterError).code).toBe(
      ATTACHMENT_ERROR_CODE.readFailed
    )
    // guards against the regression this fixes: stringifying the rejection
    // must never leak the raw FileReader event as "[object ProgressEvent]"
    // (or any other bare "[object ...]" stand-in)
    expect(String(caught)).not.toContain('[object')
  })
})
