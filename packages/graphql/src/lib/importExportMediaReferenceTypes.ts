import type { ElementType } from '@klicker-uzh/prisma/client'

export const PACKAGE_MEDIA_HREF_PREFIX = 'klicker-package-media://'
export const IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER = '⚠️ 🖼️'

export const MediaReferenceKind = {
  AUTO_LOAD: 'AUTO_LOAD',
  LINK: 'LINK',
} as const

export type MediaReferenceKind =
  (typeof MediaReferenceKind)[keyof typeof MediaReferenceKind]

export type ElementMediaReference = {
  href: string
  kind: MediaReferenceKind
}

export type ElementMediaReferenceSource = {
  type: ElementType
  content: string
  explanation?: string | null
  options: unknown
}

export type AnswerCollectionMediaReferenceSource = {
  description: string
  entries: readonly { value: string }[]
}

export type MediaReferenceWork = Readonly<{
  candidateOccurrences: number
  markdownWorkUnits: number
}>

export function isPackageMediaHref(href: string) {
  return href.startsWith(PACKAGE_MEDIA_HREF_PREFIX)
}

export function createPackageMediaHref(ref: string) {
  return `${PACKAGE_MEDIA_HREF_PREFIX}${ref}`
}
