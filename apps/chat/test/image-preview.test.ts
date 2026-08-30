import { beforeEach, describe, expect, test, vi } from 'vitest'

const sharpMock = vi.fn()
const metadataMock = vi.fn()
const rotateMock = vi.fn()
const resizeMock = vi.fn()
const jpegMock = vi.fn()
const toBufferMock = vi.fn()

vi.mock('sharp', () => ({
  default: sharpMock,
}))

describe('ensureImagePreviewBase64', () => {
  beforeEach(() => {
    metadataMock.mockReset().mockResolvedValue({ format: 'png' })
    toBufferMock.mockReset()
    jpegMock.mockReset().mockReturnValue({ toBuffer: toBufferMock })
    resizeMock.mockReset().mockReturnValue({ jpeg: jpegMock })
    rotateMock.mockReset().mockReturnValue({ resize: resizeMock })
    sharpMock
      .mockReset()
      .mockReturnValue({ metadata: metadataMock, rotate: rotateMock })
  })

  test('returns the existing preview without invoking sharp', async () => {
    const { ensureImagePreviewBase64 } = await import(
      '../src/lib/server/imagePreview'
    )

    const result = await ensureImagePreviewBase64({
      imageBase64: 'data:image/png;base64,FULL_IMAGE',
      imagePreviewBase64: 'data:image/jpeg;base64,EXISTING_PREVIEW',
    })

    expect(result).toEqual({
      imageBase64: 'data:image/png;base64,FULL_IMAGE',
      imagePreviewBase64: 'data:image/jpeg;base64,EXISTING_PREVIEW',
    })
    expect(sharpMock).not.toHaveBeenCalled()
  })

  test('generates a jpeg preview when one is missing', async () => {
    toBufferMock.mockResolvedValue(Buffer.from('preview-binary'))

    const { ensureImagePreviewBase64 } = await import(
      '../src/lib/server/imagePreview'
    )

    const result = await ensureImagePreviewBase64({
      imageBase64: 'data:image/png;base64,RlVMTF9JTUFHRQ==',
      imagePreviewBase64: null,
    })

    expect(sharpMock).toHaveBeenCalledWith(Buffer.from('FULL_IMAGE'))
    expect(metadataMock).toHaveBeenCalledOnce()
    expect(resizeMock).toHaveBeenCalledWith({
      width: 256,
      height: 256,
      fit: 'inside',
      withoutEnlargement: true,
    })
    expect(jpegMock).toHaveBeenCalledWith({ quality: 75 })
    expect(result).toEqual({
      imageBase64: 'data:image/png;base64,RlVMTF9JTUFHRQ==',
      imagePreviewBase64: 'data:image/jpeg;base64,cHJldmlldy1iaW5hcnk=',
    })
  })

  test('reports syntactically valid but undecodable image data', async () => {
    metadataMock.mockRejectedValue(new Error('synthetic decode failure'))

    const { ensureImagePreviewBase64, InvalidImageDataError } = await import(
      '../src/lib/server/imagePreview'
    )

    await expect(
      ensureImagePreviewBase64({
        imageBase64: 'data:image/png;base64,AAAA',
        imagePreviewBase64: null,
      })
    ).rejects.toBeInstanceOf(InvalidImageDataError)
    expect(rotateMock).not.toHaveBeenCalled()
  })

  test('preserves failures after image input validation', async () => {
    const processingError = new Error('synthetic processing failure')
    toBufferMock.mockRejectedValue(processingError)

    const { ensureImagePreviewBase64 } = await import(
      '../src/lib/server/imagePreview'
    )

    await expect(
      ensureImagePreviewBase64({
        imageBase64: 'data:image/png;base64,AAAA',
        imagePreviewBase64: null,
      })
    ).rejects.toBe(processingError)
  })
})
