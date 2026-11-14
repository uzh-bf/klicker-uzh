import { randomUUID } from 'node:crypto'
import { BlobSASPermissions } from '@azure/storage-blob'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type { WorkbookElement } from './parse.js'
import { ELEMENT_WORKBOOK_CONTAINER, getBlobStorage } from './storage.js'

const COPY_CONCURRENCY = 4
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

/**
 * Candidate images in another lecturer's media container: a user-id container
 * and a single path segment. External images, the importer's own images and
 * private workbook files are excluded, so the server never fetches arbitrary
 * URLs. Candidates still have to be registered media (registeredImages).
 */
export function findForeignImages(
  elements: WorkbookElement[],
  ownerId: string,
  publicUrl: string
): FirstPartyImage[] {
  const images = new Map<string, FirstPartyImage>()
  for (const element of elements) {
    for (const text of elementTexts(element)) {
      for (const href of findImageLinks(text)) {
        if (!href.startsWith(`${publicUrl}/`)) continue
        const [container, ...rest] = href
          .slice(publicUrl.length + 1)
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
  const rows = await prisma.mediaFile.findMany({
    where: { href: { in: images.map((image) => image.href) } },
    select: { href: true, ownerId: true, name: true },
  })
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
  const copies = await prisma.mediaFile.findMany({
    where: { ownerId, originalId: { in: hrefs } },
    select: { href: true, originalId: true },
  })
  return new Map(copies.map((copy) => [copy.originalId!, copy.href]))
}

export async function countImagesToCopy(
  prisma: PrismaClient,
  ownerId: string,
  elements: WorkbookElement[]
) {
  const images = await registeredImages(
    prisma,
    findForeignImages(elements, ownerId, getBlobStorage().publicUrl)
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
  const { publicUrl, service } = getBlobStorage()
  const images = await registeredImages(
    prisma,
    findForeignImages(elements, ownerId, publicUrl)
  )
  const links = await existingCopies(
    prisma,
    ownerId,
    images.map((image) => image.href)
  )
  const pending = images.filter((image) => !links.has(image.href))
  if (pending.length === 0) return links

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
