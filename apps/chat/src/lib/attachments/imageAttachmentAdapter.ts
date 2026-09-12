import type {
  AttachmentAdapter,
  CompleteAttachment,
  PendingAttachment,
} from '@assistant-ui/react'

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const IMAGE_PREVIEW_MAX_DIMENSION = 256
const HEIC_TYPES = new Set(['image/heic', 'image/heif'])
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export const ATTACHMENT_ERROR_CODE = {
  readFailed: 'attachment-read-failed',
} as const

/**
 * Rejecting with the raw FileReader `ProgressEvent` (as `reader.onerror =
 * reject` used to) stringifies to "[object ProgressEvent]" wherever a caller
 * falls back to `String(error)`. A typed error with a stable code lets the
 * composer UI (thread.tsx) map it to a localized message instead — this
 * module stays locale-free.
 */
export class AttachmentAdapterError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'AttachmentAdapterError'
  }
}

async function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () =>
      reject(new AttachmentAdapterError(ATTACHMENT_ERROR_CODE.readFailed))
    reader.readAsDataURL(blob)
  })
}

async function createPreviewDataUrl(blob: Blob): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return await readBlobAsDataUrl(blob)
  }

  return await new Promise<string>((resolve) => {
    const objectUrl = URL.createObjectURL(blob)
    const image = new Image()

    image.onload = () => {
      try {
        const longestSide = Math.max(image.width, image.height)
        const scale =
          longestSide > IMAGE_PREVIEW_MAX_DIMENSION
            ? IMAGE_PREVIEW_MAX_DIMENSION / longestSide
            : 1

        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))

        const context = canvas.getContext('2d')
        if (!context) {
          resolve(readBlobAsDataUrl(blob))
          return
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.75))
      } catch {
        resolve(readBlobAsDataUrl(blob))
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(readBlobAsDataUrl(blob))
    }

    image.src = objectUrl
  })
}

/**
 * Downscale JPEG blob to fit within maxBytes using canvas.
 * Reduces dimensions proportionally and re-encodes at 0.85 quality.
 */
async function downscaleToFit(blob: Blob, maxBytes: number): Promise<Blob> {
  console.warn(
    `Downscaling image from ${(blob.size / 1024 / 1024).toFixed(1)} MB to fit under ${maxBytes / 1024 / 1024} MB`
  )
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.sqrt(maxBytes / blob.size) * 0.9 // 10% safety margin
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (result) => {
          if (!result) reject(new Error('Canvas conversion failed'))
          else resolve(result)
        },
        'image/jpeg',
        0.85
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for downscaling'))
    }
    img.src = url
  })
}

/**
 * Convert a HEIC/HEIF blob to JPEG using heic2any (lazy-loaded).
 * Returns first frame for multi-frame HEIF sequences.
 */
async function convertHeic(file: File): Promise<Blob> {
  const heic2any = (await import('heic2any')).default
  const result = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.9,
  })
  return Array.isArray(result) ? result[0] : result
}

export const imageAttachmentAdapter: AttachmentAdapter = {
  accept: [...ACCEPTED_TYPES, ...HEIC_TYPES].join(','),

  async add({ file }) {
    // validate MIME type
    if (!ACCEPTED_TYPES.includes(file.type) && !HEIC_TYPES.has(file.type)) {
      throw new Error(
        `Unsupported image format "${file.type || file.name.split('.').pop()}". Please use JPEG, PNG, GIF, WebP, or HEIC.`
      )
    }

    let blob: Blob = file
    let contentType = file.type

    // convert HEIC/HEIF to JPEG
    if (HEIC_TYPES.has(file.type)) {
      try {
        blob = await convertHeic(file)
        contentType = 'image/jpeg'
      } catch {
        throw new Error(
          'Could not convert this HEIC image. Try saving it as JPEG first.'
        )
      }
    }

    // downscale if over limit after conversion
    if (blob.size > MAX_IMAGE_SIZE_BYTES) {
      try {
        blob = await downscaleToFit(blob, MAX_IMAGE_SIZE_BYTES)
        console.log(
          'new size after downscaling:',
          (blob.size / 1024 / 1024).toFixed(1),
          'MB'
        )
      } catch {
        throw new Error(
          'Image is too large and could not be resized automatically.'
        )
      }
    }

    // Final size guard
    if (blob.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(
        `Image must be smaller than 5 MB after conversion (got ${(blob.size / 1024 / 1024).toFixed(1)} MB).`
      )
    }

    const dataUrl = await readBlobAsDataUrl(blob)
    const previewDataUrl = await createPreviewDataUrl(blob)

    return {
      id: crypto.randomUUID(),
      type: 'image',
      name: file.name,
      contentType,
      file,
      content: [
        {
          type: 'image',
          image: dataUrl,
          imagePreview: previewDataUrl,
        } as any,
      ],
      status: { type: 'requires-action', reason: 'composer-send' },
    } satisfies PendingAttachment
  },

  async send(attachment) {
    return {
      ...attachment,
      status: { type: 'complete' },
    } as CompleteAttachment
  },

  async remove() {},
}
