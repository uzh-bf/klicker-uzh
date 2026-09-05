import { fromMarkdown } from 'mdast-util-from-markdown'
import {
  IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER,
  isPackageMediaHref,
  MediaReferenceKind,
  type ElementMediaReference,
  type MediaReferenceKind as MediaReferenceKindType,
} from './importExportMediaReferenceTypes.js'

type MarkdownRoot = ReturnType<typeof fromMarkdown>
type MarkdownNode = MarkdownRoot | MarkdownRoot['children'][number]
type MarkdownDefinitionNode = Extract<MarkdownNode, { type: 'definition' }>

type MarkdownNodeVisit = {
  node: MarkdownNode
  scanText: boolean
}

type MarkdownDefinition = {
  href: string
  node: MarkdownDefinitionNode
}

type MarkdownEdit = {
  start: number
  end: number
  value: string
}

const RAW_URL_SOURCE =
  '(?:https?:\\/\\/|klicker-package-media:\\/\\/)[^\\s<>"\')\\]]+'
const RAW_URL_PATTERN = new RegExp(RAW_URL_SOURCE, 'gi')

export function canContainSupportedHref(source: string) {
  return source.includes('//')
}

export function canContainMarkdownImage(source: string) {
  return source.includes('![')
}

function normalizeRawHref(value: string) {
  return value.replace(/[.,;:!?]+$/, '')
}

function isSupportedReferenceHref(value: string) {
  return /^(?:https?:\/\/|\/\/)/i.test(value) || isPackageMediaHref(value)
}

function getMarkdownChildren(node: MarkdownNode): readonly MarkdownNode[] {
  return 'children' in node ? node.children : []
}

function collectMarkdownNodes(root: MarkdownRoot) {
  const visits: MarkdownNodeVisit[] = []
  const stack: MarkdownNodeVisit[] = [{ node: root, scanText: true }]

  while (stack.length > 0) {
    const visit = stack.pop()!
    visits.push(visit)

    const scanChildText =
      visit.scanText &&
      visit.node.type !== 'link' &&
      visit.node.type !== 'linkReference'
    const children = getMarkdownChildren(visit.node)
    for (let index = children.length - 1; index >= 0; index--) {
      stack.push({ node: children[index]!, scanText: scanChildText })
    }
  }

  return visits
}

function normalizeIdentifier(identifier: string) {
  return identifier.toLowerCase()
}

function collectDefinitions(visits: readonly MarkdownNodeVisit[]) {
  const definitions = new Map<string, MarkdownDefinition>()

  for (const { node } of visits) {
    if (node.type !== 'definition' || !node.identifier || !node.url) continue

    const identifier = normalizeIdentifier(node.identifier)
    if (!definitions.has(identifier)) {
      definitions.set(identifier, { href: node.url, node })
    }
  }

  return definitions
}

function getNodeOffsets(node: MarkdownNode) {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  if (
    typeof start !== 'number' ||
    typeof end !== 'number' ||
    start < 0 ||
    end < start
  ) {
    return null
  }

  return { start, end }
}

function getRawTextReferences(source: string, start = 0, end = source.length) {
  const raw = source.slice(start, end)
  const references: Array<{ href: string; start: number; end: number }> = []
  RAW_URL_PATTERN.lastIndex = 0

  for (const match of raw.matchAll(RAW_URL_PATTERN)) {
    const href = normalizeRawHref(match[0])
    if (!href || typeof match.index !== 'number') continue

    references.push({
      href,
      start: start + match.index,
      end: start + match.index + href.length,
    })
  }

  return references
}

function collectMarkdownReferences(source: string) {
  const references = new Map<string, MediaReferenceKindType>()

  const addReference = (href: string, kind: MediaReferenceKindType) => {
    if (!isSupportedReferenceHref(href)) return

    const previousKind = references.get(href)
    if (!previousKind || kind === MediaReferenceKind.AUTO_LOAD) {
      references.set(href, kind)
    }
  }

  if (!canContainSupportedHref(source)) return references

  const visits = collectMarkdownNodes(fromMarkdown(source))
  const definitions = collectDefinitions(visits)

  for (const { node, scanText } of visits) {
    if (node.type === 'image' && node.url) {
      addReference(node.url, MediaReferenceKind.AUTO_LOAD)
    } else if (node.type === 'link' && node.url) {
      addReference(node.url, MediaReferenceKind.LINK)
    } else if (node.type === 'imageReference' && node.identifier) {
      const definition = definitions.get(normalizeIdentifier(node.identifier))
      if (definition) {
        addReference(definition.href, MediaReferenceKind.AUTO_LOAD)
      }
    } else if (node.type === 'linkReference' && node.identifier) {
      const definition = definitions.get(normalizeIdentifier(node.identifier))
      if (definition) addReference(definition.href, MediaReferenceKind.LINK)
    } else if (node.type === 'text' && scanText) {
      const offsets = getNodeOffsets(node)
      if (!offsets) continue
      for (const reference of getRawTextReferences(
        source,
        offsets.start,
        offsets.end
      )) {
        addReference(reference.href, MediaReferenceKind.LINK)
      }
    }
  }

  return references
}

export function collectMarkdownMediaReferences(
  source: string
): ElementMediaReference[] {
  return Array.from(collectMarkdownReferences(source), ([href, kind]) => ({
    href,
    kind,
  }))
}

export function collectPlainTextMediaReferences(
  source: string
): ElementMediaReference[] {
  const references = new Map<string, MediaReferenceKindType>()

  for (const reference of getRawTextReferences(source)) {
    if (isSupportedReferenceHref(reference.href)) {
      references.set(reference.href, MediaReferenceKind.LINK)
    }
  }

  return Array.from(references, ([href, kind]) => ({ href, kind }))
}

function applyMarkdownEdits(source: string, edits: readonly MarkdownEdit[]) {
  if (edits.length === 0) return source

  const ordered = [...edits].sort((left, right) => left.start - right.start)
  const parts: string[] = []
  let cursor = 0

  for (const edit of ordered) {
    if (
      !Number.isInteger(edit.start) ||
      !Number.isInteger(edit.end) ||
      edit.start < cursor ||
      edit.end < edit.start ||
      edit.end > source.length
    ) {
      throw new TypeError('Invalid or overlapping Markdown rewrite range.')
    }
    parts.push(source.slice(cursor, edit.start), edit.value)
    cursor = edit.end
  }
  parts.push(source.slice(cursor))
  return parts.join('')
}

function findClosingBracket(value: string, openingIndex: number) {
  let depth = 0

  for (let index = openingIndex; index < value.length; index++) {
    const character = value[index]
    if (character === '\\') {
      index++
      continue
    }
    if (character === '[') depth++
    if (character === ']') {
      depth--
      if (depth === 0) return index
    }
  }

  return -1
}

function findDestinationRange(
  value: string,
  startIndex: number,
  stopAtUnmatchedClosingParenthesis: boolean
) {
  let start = startIndex
  while (/\s/.test(value[start] ?? '')) start++
  if (start >= value.length) return null

  if (value[start] === '<') {
    for (let index = start + 1; index < value.length; index++) {
      if (value[index] === '\\') {
        index++
        continue
      }
      if (value[index] === '>') return { start, end: index + 1 }
    }
    return null
  }

  let depth = 0
  let end = start
  for (; end < value.length; end++) {
    const character = value[end]
    if (character === '\\') {
      end++
      continue
    }
    if (/\s/.test(character ?? '') && depth === 0) break
    if (character === '(') {
      depth++
      continue
    }
    if (character === ')') {
      if (depth === 0 && stopAtUnmatchedClosingParenthesis) break
      if (depth > 0) depth--
    }
  }

  return end > start ? { start, end } : null
}

function getMarkdownDestinationRange(source: string, node: MarkdownNode) {
  const offsets = getNodeOffsets(node)
  if (!offsets) return null

  const raw = source.slice(offsets.start, offsets.end)
  const openingBracket = raw.indexOf('[')
  if (openingBracket < 0) return null

  const closingBracket = findClosingBracket(raw, openingBracket)
  if (closingBracket < 0) return null

  let destinationRange: { start: number; end: number } | null = null
  if (node.type === 'definition') {
    if (raw[closingBracket + 1] !== ':') return null
    destinationRange = findDestinationRange(raw, closingBracket + 2, false)
  } else if (node.type === 'image' || node.type === 'link') {
    if (raw[closingBracket + 1] !== '(') return null
    destinationRange = findDestinationRange(raw, closingBracket + 2, true)
  }

  return destinationRange
    ? {
        start: offsets.start + destinationRange.start,
        end: offsets.start + destinationRange.end,
      }
    : null
}

function formatMarkdownDestination(value: string) {
  const safeValue = value.replace(/[\\<>\s]/g, (character) =>
    encodeURIComponent(character)
  )
  return `<${safeValue}>`
}

export function rewriteMarkdownMediaReferences(
  source: string,
  replacements: ReadonlyMap<string, string>
) {
  if (replacements.size === 0 || !canContainSupportedHref(source)) {
    return source
  }

  const visits = collectMarkdownNodes(fromMarkdown(source))
  const definitions = collectDefinitions(visits)
  const activeDefinitionIdentifiers = new Set<string>()
  const edits = new Map<string, MarkdownEdit>()

  const addDestinationEdit = (node: MarkdownNode, href: string) => {
    const replacement = replacements.get(href)
    if (!replacement) return

    const range = getMarkdownDestinationRange(source, node)
    if (!range) return

    edits.set(`${range.start}:${range.end}`, {
      ...range,
      value: formatMarkdownDestination(replacement),
    })
  }

  for (const { node, scanText } of visits) {
    if ((node.type === 'image' || node.type === 'link') && node.url) {
      addDestinationEdit(node, node.url)
    } else if (
      (node.type === 'imageReference' || node.type === 'linkReference') &&
      node.identifier
    ) {
      activeDefinitionIdentifiers.add(normalizeIdentifier(node.identifier))
    } else if (node.type === 'text' && scanText) {
      const offsets = getNodeOffsets(node)
      if (!offsets) continue
      for (const reference of getRawTextReferences(
        source,
        offsets.start,
        offsets.end
      )) {
        const replacement = replacements.get(reference.href)
        if (!replacement) continue
        edits.set(`${reference.start}:${reference.end}`, {
          start: reference.start,
          end: reference.end,
          value: replacement,
        })
      }
    }
  }

  for (const identifier of activeDefinitionIdentifiers) {
    const definition = definitions.get(identifier)
    if (definition) addDestinationEdit(definition.node, definition.href)
  }

  return applyMarkdownEdits(source, Array.from(edits.values()))
}

export function rewritePlainTextMediaReferences(
  source: string,
  replacements: ReadonlyMap<string, string>
) {
  if (replacements.size === 0) return source

  const edits = getRawTextReferences(source).flatMap(
    (reference): MarkdownEdit[] => {
      const replacement = replacements.get(reference.href)
      return replacement ? [{ ...reference, value: replacement }] : []
    }
  )

  return applyMarkdownEdits(source, edits)
}

function escapeMarkdownPlainText(value: string) {
  return value.replace(
    /[\u0021-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e]/g,
    '\\$&'
  )
}

function createExternalMediaOmissionMarker(altText?: string | null) {
  const alt = altText?.replace(/\s+/g, ' ').trim()
  const label = alt
    ? `${IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER}: ${alt}`
    : IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER

  return `\\[${escapeMarkdownPlainText(label)}\\]`
}

function createPackagedMarkdownImage(
  altText: string | null | undefined,
  href: string
) {
  const alt = escapeMarkdownPlainText(
    altText?.replace(/\s+/g, ' ').trim() ?? ''
  )
  return `![${alt}](${formatMarkdownDestination(href)})`
}

/**
 * Rewrites only auto-loading Markdown image uses for package export.
 *
 * A URL can occur as both an image source and a user-activated link. Rewriting
 * by URL alone would silently change the link into a package transport href,
 * so edits are derived from the parsed reference kind instead. Images without
 * a verified package replacement become a non-loading omission marker.
 */
export function rewriteExportMarkdownImages(
  source: string,
  replacements: ReadonlyMap<string, string>
) {
  if (!canContainMarkdownImage(source)) return source

  const visits = collectMarkdownNodes(fromMarkdown(source))
  const definitions = collectDefinitions(visits)
  const imageDefinitionIdentifiers = new Set<string>()
  const linkDefinitionIdentifiers = new Set<string>()
  const edits = new Map<string, MarkdownEdit>()

  const addEdit = (edit: MarkdownEdit) => {
    edits.set(`${edit.start}:${edit.end}`, edit)
  }

  for (const { node } of visits) {
    if (node.type === 'linkReference' && node.identifier) {
      linkDefinitionIdentifiers.add(normalizeIdentifier(node.identifier))
      continue
    }

    if (node.type === 'image' && node.url) {
      const replacement = replacements.get(node.url)
      if (replacement) {
        const range = getMarkdownDestinationRange(source, node)
        if (range) {
          addEdit({ ...range, value: formatMarkdownDestination(replacement) })
        } else {
          const nodeRange = getNodeOffsets(node)
          if (nodeRange) {
            addEdit({
              ...nodeRange,
              value: createPackagedMarkdownImage(node.alt, replacement),
            })
          }
        }
      } else {
        const range = getNodeOffsets(node)
        if (range) {
          addEdit({
            ...range,
            value: createExternalMediaOmissionMarker(node.alt),
          })
        }
      }
      continue
    }

    if (node.type !== 'imageReference' || !node.identifier) continue

    const identifier = normalizeIdentifier(node.identifier)
    const definition = definitions.get(identifier)
    if (!definition) continue

    imageDefinitionIdentifiers.add(identifier)
    const range = getNodeOffsets(node)
    if (!range) continue

    const replacement = replacements.get(definition.href)
    addEdit({
      ...range,
      value: replacement
        ? createPackagedMarkdownImage(node.alt, replacement)
        : createExternalMediaOmissionMarker(node.alt),
    })
  }

  // Once every image reference has become either an inline package image or an
  // omission marker, its source definition is no longer needed. Keep shared
  // definitions only when an ordinary link reference still depends on them.
  for (const { node } of visits) {
    if (node.type !== 'definition' || !node.identifier) continue

    const identifier = normalizeIdentifier(node.identifier)
    if (
      !imageDefinitionIdentifiers.has(identifier) ||
      linkDefinitionIdentifiers.has(identifier)
    ) {
      continue
    }

    const range = getNodeOffsets(node)
    if (range) addEdit({ ...range, value: '' })
  }

  return applyMarkdownEdits(source, Array.from(edits.values()))
}

export function omitExternalAutoLoadingMarkdownImages(source: string) {
  if (!canContainMarkdownImage(source)) return source

  const visits = collectMarkdownNodes(fromMarkdown(source))
  const definitions = collectDefinitions(visits)
  const edits: MarkdownEdit[] = []
  const removedReferenceIdentifiers = new Set<string>()
  const retainedReferenceIdentifiers = new Set<string>()

  for (const { node } of visits) {
    let href: string | undefined
    if (node.type === 'image') {
      href = node.url
    } else if (node.type === 'imageReference' && node.identifier) {
      href = definitions.get(normalizeIdentifier(node.identifier))?.href
    }

    if (
      (node.type === 'imageReference' || node.type === 'linkReference') &&
      node.identifier
    ) {
      const identifier = normalizeIdentifier(node.identifier)
      if (!href || isPackageMediaHref(href) || node.type === 'linkReference') {
        retainedReferenceIdentifiers.add(identifier)
      }
    }

    if (!href || isPackageMediaHref(href)) continue

    const range = getNodeOffsets(node)
    if (!range) continue
    if (node.type === 'imageReference' && node.identifier) {
      removedReferenceIdentifiers.add(normalizeIdentifier(node.identifier))
    }
    edits.push({
      ...range,
      value: createExternalMediaOmissionMarker(
        node.type === 'image' || node.type === 'imageReference'
          ? node.alt
          : undefined
      ),
    })
  }

  for (const { node } of visits) {
    if (
      node.type !== 'definition' ||
      !node.identifier ||
      !removedReferenceIdentifiers.has(normalizeIdentifier(node.identifier)) ||
      retainedReferenceIdentifiers.has(normalizeIdentifier(node.identifier))
    ) {
      continue
    }
    const range = getNodeOffsets(node)
    if (range) edits.push({ ...range, value: '' })
  }

  return applyMarkdownEdits(source, edits)
}
