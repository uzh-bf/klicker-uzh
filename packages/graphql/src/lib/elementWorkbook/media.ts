import { randomUUID } from 'node:crypto'
import { BlobSASPermissions } from '@azure/storage-blob'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type { WorkbookElement } from './parse.js'
import { ELEMENT_WORKBOOK_CONTAINER, getBlobStorage } from './storage.js'

const COPY_CONCURRENCY = 4
/** Most image copies one import may make; bounds a single request's work. */
export const MAX_IMAGE_COPIES_PER_IMPORT = 500
// Keeps `IN` lists well below PostgreSQL's bind-parameter limit.
const QUERY_CHUNK = 1000
// Media-library containers are named after their owner's user id.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SOURCE_LINK_TTL_MS = 15 * 60 * 1000

// Markdown images, with optional <angle brackets> and "title", and HTML <img>.
const IMAGE_PATTERNS = [
  /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
  /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,
]

/** Every free-text field of a workbook element that may embed images. */
function elementTexts(element: WorkbookElement) {
  const texts = [element.content, element.explanation ?? '']
  if ('choices' in element.options) {
    for (const choice of element.options.choices) {
      texts.push(choice.value, choice.feedback ?? '')
    }
  }
  return texts
}

export function findImageLinks(text: string) {
  const links: string[] = []
  for (const pattern of IMAGE_PATTERNS) {
    for (const match of text.matchAll(pattern)) links.push(match[1]!)
  }
  return links
}

type FirstPartyImage = { href: string; container: string; blob: string }

export class ElementWorkbookMediaError extends Error {
  constructor(readonly code: 'TOO_MANY_IMAGES') {
    super(code)
  }
}

function chunks<T>(items: T[]) {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += QUERY_CHUNK)
    result.push(items.slice(index, index + QUERY_CHUNK))
  return result
}

/**
 * Candidate images in another lecturer's media container: a user-id container
 * and a single path segment. External images, the importer's own images and
 * private workbook files are excluded, so the server never fetches arbitrary
 * URLs. Candidates still have to be registered media (registeredImages).
 */
export function findForeignImages(
  elements: WorkbookElement[],
  ownerId: string,
  accountUrls: string | string[]
): FirstPartyImage[] {
  const bases = typeof accountUrls === 'string' ? [accountUrls] : accountUrls
  const images = new Map<string, FirstPartyImage>()
  for (const element of elements) {
    for (const text of elementTexts(element)) {
      for (const href of findImageLinks(text)) {
        const base = bases.find((url) => href.startsWith(`${url}/`))
        if (!base) continue
        const [container, ...rest] = href
          .slice(base.length + 1)
          .split(/[?#]/)[0]!
          .split('/')
        const blob = rest.join('/')
        if (
          !container ||
          !UUID_PATTERN.test(container) ||
          !blob ||
          blob.includes('/') ||
          blob.includes('..') ||
          container === ownerId ||
          container === ELEMENT_WORKBOOK_CONTAINER
        )
          continue
        images.set(href, { href, container, blob })
      }
    }
  }
  return [...images.values()]
}

/**
 * Only images registered in their owner's media library may be copied. The
 * storage key can read every container in the account, so an unregistered
 * link must never be dereferenced: it could point at private data.
 */
async function registeredImages(
  prisma: PrismaClient,
  images: FirstPartyImage[]
) {
  if (images.length === 0) return []
  const rows = (
    await Promise.all(
      chunks(images.map((image) => image.href)).map((hrefs) =>
        prisma.mediaFile.findMany({
          where: { href: { in: hrefs } },
          select: { href: true, ownerId: true, name: true },
        })
      )
    )
  ).flat()
  const registered = new Map(rows.map((row) => [row.href, row]))
  return images.flatMap((image) => {
    const row = registered.get(image.href)
    return row && row.ownerId === image.container
      ? [{ ...image, name: row.name }]
      : []
  })
}

/** Copies the importer already owns, keyed by the source link. */
async function existingCopies(
  prisma: PrismaClient,
  ownerId: string,
  hrefs: string[]
) {
  const copies = (
    await Promise.all(
      chunks(hrefs).map((part) =>
        prisma.mediaFile.findMany({
          where: { ownerId, originalId: { in: part } },
          select: { href: true, originalId: true },
        })
      )
    )
  ).flat()
  return new Map(copies.map((copy) => [copy.originalId!, copy.href]))
}

export async function countImagesToCopy(
  prisma: PrismaClient,
  ownerId: string,
  elements: WorkbookElement[]
) {
  const images = await registeredImages(
    prisma,
    findForeignImages(elements, ownerId, getBlobStorage().accountUrls)
  )
  if (images.length === 0) return 0
  const copied = await existingCopies(
    prisma,
    ownerId,
    images.map((image) => image.href)
  )
  return images.filter((image) => !copied.has(image.href)).length
}

/**
 * Copies foreign first-party images into the importer's media container and
 * registers them in the importer's media library. Copies are recorded by their
 * source link (`MediaFile.originalId`), so retries and repeated imports reuse
 * them. Unregistered or missing source images keep their original link.
 */
export async function copyImagesForImport(
  prisma: PrismaClient,
  ownerId: string,
  elements: WorkbookElement[]
) {
  const { accountUrls, publicUrl, service } = getBlobStorage()
  const images = await registeredImages(
    prisma,
    findForeignImages(elements, ownerId, accountUrls)
  )
  const links = await existingCopies(
    prisma,
    ownerId,
    images.map((image) => image.href)
  )
  const pending = images.filter((image) => !links.has(image.href))
  if (pending.length === 0) return links
  if (pending.length > MAX_IMAGE_COPIES_PER_IMPORT)
    throw new ElementWorkbookMediaError('TOO_MANY_IMAGES')

  const target = service.getContainerClient(ownerId)
  // Same public read access as media-library uploads (getFileUploadSas).
  await target.createIfNotExists({ access: 'blob' })

  const copyOne = async (image: FirstPartyImage & { name: string }) => {
    const source = service
      .getContainerClient(image.container)
      .getBlobClient(image.blob)
    let contentType: string
    try {
      contentType =
        (await source.getProperties()).contentType ?? 'application/octet-stream'
    } catch {
      return
    }
    const extension = image.blob.includes('.')
      ? `.${image.blob.split('.').pop()}`
      : ''
    const blobName = `${randomUUID()}${extension}`
    // Server-side copy: the bytes never pass through this process.
    const sourceUrl = await source.generateSasUrl({
      permissions: BlobSASPermissions.parse('r'),
      expiresOn: new Date(Date.now() + SOURCE_LINK_TTL_MS),
    })
    const poller = await target
      .getBlobClient(blobName)
      .beginCopyFromURL(sourceUrl)
    await poller.pollUntilDone()
    const copy = await prisma.mediaFile.upsert({
      where: { ownerId_originalId: { ownerId, originalId: image.href } },
      create: {
        ownerId,
        originalId: image.href,
        href: `${publicUrl}/${ownerId}/${blobName}`,
        name: image.name,
        type: contentType,
      },
      update: {},
      select: { href: true },
    })
    links.set(image.href, copy.href)
  }

  for (let index = 0; index < pending.length; index += COPY_CONCURRENCY) {
    await Promise.all(
      pending.slice(index, index + COPY_CONCURRENCY).map(copyOne)
    )
  }
  return links
}

function replaceLinks(text: string, links: [string, string][]) {
  let result = text
  for (const [from, to] of links) result = result.replaceAll(from, to)
  return result
}

/** Rewrites image links in every text field; longest links first. */
export function rewriteImageLinks(
  elements: WorkbookElement[],
  links: Map<string, string>
): WorkbookElement[] {
  if (links.size === 0) return elements
  const ordered = [...links].sort(([a], [b]) => b.length - a.length)
  return elements.map((element) => {
    const options =
      'choices' in element.options
        ? {
            ...element.options,
            choices: element.options.choices.map((choice) => ({
              ...choice,
              value: replaceLinks(choice.value, ordered),
              ...(choice.feedback === undefined
                ? {}
                : { feedback: replaceLinks(choice.feedback, ordered) }),
            })),
          }
        : element.options
    return {
      ...element,
      content: replaceLinks(element.content, ordered),
      explanation:
        element.explanation === null
          ? null
          : replaceLinks(element.explanation, ordered),
      options,
    } as WorkbookElement
  })
}
