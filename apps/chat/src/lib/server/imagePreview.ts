import sharp from 'sharp'

const DATA_URL_PREFIX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/
const IMAGE_PREVIEW_MAX_DIMENSION = 256
const IMAGE_PREVIEW_QUALITY = 75

export type ImagePreviewInput = {
  imageBase64: string
  imagePreviewBase64: string | null
}

export class InvalidImageDataError extends Error {
  constructor() {
    super('Invalid image data')
    this.name = 'InvalidImageDataError'
  }
}

function extractBase64Payload(dataUrl: string) {
  const prefixMatch = dataUrl.match(DATA_URL_PREFIX)

  if (!prefixMatch) {
    throw new Error('Invalid image data URL')
  }

  return dataUrl.slice(prefixMatch[0].length)
}

export async function ensureImagePreviewBase64<T extends ImagePreviewInput>(
  image: T
): Promise<T> {
  if (image.imagePreviewBase64) {
    return image
  }

  let previewBuffer: Buffer
  try {
    const inputBuffer = Buffer.from(
      extractBase64Payload(image.imageBase64),
      'base64'
    )

    previewBuffer = await sharp(inputBuffer)
      .rotate()
      .resize({
        width: IMAGE_PREVIEW_MAX_DIMENSION,
        height: IMAGE_PREVIEW_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: IMAGE_PREVIEW_QUALITY })
      .toBuffer()
  } catch {
    throw new InvalidImageDataError()
  }

  return {
    ...image,
    imagePreviewBase64: `data:image/jpeg;base64,${previewBuffer.toString('base64')}`,
  }
}
