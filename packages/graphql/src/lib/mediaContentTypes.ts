import path from 'node:path'

export const DEFAULT_MEDIA_CONTENT_TYPE = 'application/octet-stream'

export const SUPPORTED_MEDIA_CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'image/tiff': 'tiff',
  'image/bmp': 'bmp',
  'application/json': 'json',
}

export const SUPPORTED_MEDIA_FILE_EXTENSIONS = Object.values(
  SUPPORTED_MEDIA_CONTENT_TYPE_EXTENSIONS
)

export function isSupportedMediaContentType(contentType: string) {
  return Object.hasOwn(SUPPORTED_MEDIA_CONTENT_TYPE_EXTENSIONS, contentType)
}

export function inferMediaFileExtension(contentType: string, filename: string) {
  const configured = SUPPORTED_MEDIA_CONTENT_TYPE_EXTENSIONS[contentType]
  if (configured) return configured

  const extension = path.extname(filename).replace(/^\./, '').toLowerCase()
  return extension || 'bin'
}
