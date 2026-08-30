import sharp from 'sharp'

const DATA_URL_PREFIX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/
const IMAGE_PREVIEW_MAX_DIMENSION = 256
const IMAGE_PREVIEW_QUALITY = 75

export type ImagePreviewInput = {
  imageBase64: string
  imagePreviewBase64: string | null
}

export class InvalidImageDataError extends Error {
  constructor(options?: ErrorOptions) {
    super('Invalid image data', options)
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

  let imagePipeline: sharp.Sharp
  try {
    const inputBuffer = Buffer.from(
      extractBase64Payload(image.imageBase64),
      'base64'
    )
    imagePipeline = sharp(inputBuffer)
    await imagePipeline.metadata()
  } catch (cause) {
    throw new InvalidImageDataError({ cause })
  }

  const previewBuffer = await imagePipeline
    .rotate()
    .resize({
      width: IMAGE_PREVIEW_MAX_DIMENSION,
      height: IMAGE_PREVIEW_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: IMAGE_PREVIEW_QUALITY })
    .toBuffer()

  return {
    ...image,
    imagePreviewBase64: `data:image/jpeg;base64,${previewBuffer.toString('base64')}`,
  }
}
