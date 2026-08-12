import { sha256Hex } from '../canonical/hash.js'
import type { AssessmentBaselineContent } from './parts.js'

export type KnownKlickerMedia = {
  id: string
  href: string
  mimeType: string
}

export type OwnedBaselineMediaReference = {
  mediaId: string
  sourceUrl: string
  mimeType: string
}

export type BaselineMediaDiscovery = {
  owned: OwnedBaselineMediaReference[]
  limitations: Extract<AssessmentBaselineContent, { kind: 'LIMITATION' }>[]
}

const HTTPS_URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/giu

function canonicalMediaUrl(value: string): string | null {
  try {
    const url = new URL(value.replace(/&amp;/gu, '&'))
    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== ''
    ) {
      return null
    }
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

export function extractBaselineMediaUrls(
  markdown: readonly string[]
): string[] {
  const urls = new Set<string>()
  for (const value of markdown) {
    for (const match of value.matchAll(HTTPS_URL_PATTERN)) {
      const sourceUrl = canonicalMediaUrl(match[0])
      if (sourceUrl !== null) urls.add(sourceUrl)
    }
  }
  return [...urls].sort()
}

export function discoverBaselineMediaReferences(input: {
  markdown: readonly string[]
  knownMedia: readonly KnownKlickerMedia[]
}): BaselineMediaDiscovery {
  const knownByUrl = new Map<string, KnownKlickerMedia>()
  for (const media of input.knownMedia) {
    const sourceUrl = canonicalMediaUrl(media.href)
    if (sourceUrl === null) {
      throw new TypeError(`Klicker media ${media.id} has an invalid source URL`)
    }
    const previous = knownByUrl.get(sourceUrl)
    if (previous !== undefined && previous.id !== media.id) {
      throw new Error(`Multiple Klicker media records use ${sourceUrl}`)
    }
    knownByUrl.set(sourceUrl, media)
  }

  const ownedById = new Map<string, OwnedBaselineMediaReference>()
  const limitationsBySubject = new Map<
    string,
    Extract<AssessmentBaselineContent, { kind: 'LIMITATION' }>
  >()

  for (const sourceUrl of extractBaselineMediaUrls(input.markdown)) {
    const known = knownByUrl.get(sourceUrl)
    if (known !== undefined) {
      ownedById.set(known.id, {
        mediaId: known.id,
        sourceUrl,
        mimeType: known.mimeType,
      })
      continue
    }

    const subjectId = sha256Hex(sourceUrl)
    limitationsBySubject.set(subjectId, {
      kind: 'LIMITATION',
      subjectType: 'EXTERNAL_MEDIA',
      subjectId,
      reasonCode: 'EXTERNAL_MEDIA_NOT_CAPTURED',
    })
  }

  return {
    owned: [...ownedById.values()].sort((left, right) =>
      left.mediaId.localeCompare(right.mediaId)
    ),
    limitations: [...limitationsBySubject.values()].sort((left, right) =>
      left.subjectId!.localeCompare(right.subjectId!)
    ),
  }
}
