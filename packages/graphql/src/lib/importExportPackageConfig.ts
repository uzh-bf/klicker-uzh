import { ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES } from '@klicker-uzh/types'

export const IMPORT_EXPORT_PACKAGE_TYPE = 'klicker-element-package'
export const IMPORT_EXPORT_PACKAGE_VERSION = 3

export const MAX_IMPORT_EXPORT_PACKAGE_BYTES =
  ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES
export const MAX_IMPORT_EXPORT_JSON_BYTES = 2 * 1024 * 1024
export const MAX_IMPORT_EXPORT_ELEMENTS = 100
export const MAX_IMPORT_EXPORT_ANSWER_COLLECTIONS = 50
export const MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES = 2000
export const MAX_IMPORT_EXPORT_MEDIA_FILES = 100
export const MAX_IMPORT_EXPORT_MEDIA_BYTES = 5 * 1024 * 1024
export const MAX_IMPORT_EXPORT_TAGS = 50
export const MAX_IMPORT_EXPORT_NAME_LENGTH = 255
export const MAX_IMPORT_EXPORT_CONTENT_LENGTH = 200_000
export const MAX_IMPORT_EXPORT_DESCRIPTION_LENGTH = 20_000
export const MAX_IMPORT_EXPORT_OPTIONS_BYTES = 200_000
export const MAX_ELEMENT_POINTS_MULTIPLIER = 4

export function isImportExportLocalRuntime() {
  return (
    process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
  )
}

export function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : fallback
}
