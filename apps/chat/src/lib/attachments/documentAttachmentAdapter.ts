import type {
  AttachmentAdapter,
  CompleteAttachment,
  PendingAttachment,
} from '@assistant-ui/react'
import type JSZip from 'jszip'
import {
  buildDocumentBlock,
  MAX_DOCUMENT_SIZE_BYTES,
  truncateDocumentText,
} from './documentText'
import { AttachmentAdapterError } from './imageAttachmentAdapter'
import { extractPdfPages, PDF_TEXT_MESSAGE } from './pdfText'

export const DOCUMENT_ERROR_CODE = {
  tooLarge: 'document-too-large',
  noText: 'document-no-text',
  pdfNoText: 'document-pdf-no-text',
  readFailed: 'document-read-failed',
} as const

type DocumentKind = 'text' | 'pdf' | 'docx' | 'pptx'

const DOCX_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PPTX_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'

// Extensions as well as MIME types: browsers often report `.md` and `.csv`
// files with an empty or platform-specific type.
const ACCEPT = [
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.pdf',
  '.docx',
  '.pptx',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/pdf',
  DOCX_TYPE,
  PPTX_TYPE,
].join(',')

export function getDocumentKind(file: {
  name: string
  type: string
}): DocumentKind | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (file.type === 'application/pdf' || extension === 'pdf') return 'pdf'
  if (file.type === DOCX_TYPE || extension === 'docx') return 'docx'
  if (file.type === PPTX_TYPE || extension === 'pptx') return 'pptx'
  if (
    ['txt', 'md', 'markdown', 'csv'].includes(extension) ||
    ['text/plain', 'text/markdown', 'text/csv'].includes(file.type)
  ) {
    return 'text'
  }
  return null
}

async function extractPdfInWorker(data: ArrayBuffer): Promise<string[]> {
  if (typeof Worker === 'undefined') return await extractPdfPages(data)

  const worker = new Worker(new URL('./pdfText.worker.ts', import.meta.url), {
    type: 'module',
  })
  try {
    return await new Promise<string[]>((resolve, reject) => {
      worker.onmessage = (
        event: MessageEvent<
          | { type?: unknown; ok: true; pages: string[] }
          | { type?: unknown; ok: false; message: string }
        >
      ) => {
        if (event.data?.type !== PDF_TEXT_MESSAGE) return
        if (event.data.ok) resolve(event.data.pages)
        else reject(new Error(event.data.message))
      }
      worker.onerror = (event) => reject(new Error(event.message))
      worker.postMessage({ type: PDF_TEXT_MESSAGE, data }, [data])
    })
  } finally {
    worker.terminate()
  }
}

async function extractDocxText(data: ArrayBuffer): Promise<string> {
  const mammothModule = await import('mammoth')
  const mammoth = mammothModule.default ?? mammothModule
  const { value } = await mammoth.extractRawText({ arrayBuffer: data })
  return value
}

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

const decodeXml = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) =>
    entity.startsWith('#x') || entity.startsWith('#X')
      ? String.fromCodePoint(Number.parseInt(entity.slice(2), 16))
      : entity.startsWith('#')
        ? String.fromCodePoint(Number(entity.slice(1)))
        : XML_ENTITIES[entity.toLowerCase()]
  )

const readAttribute = (tag: string, name: string): string | undefined =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1]

/**
 * The visible text of a slide or notes part, one line per paragraph. Fields
 * such as slide numbers and dates are layout chrome, not content.
 */
function readDrawingText(xml: string): string {
  return xml
    .replace(/<a:fld\b[\s\S]*?<\/a:fld>/g, '')
    .replace(/<a:br\b[^>]*\/>/g, '<a:t>\n</a:t>')
    .split('</a:p>')
    .map((paragraph) =>
      [...paragraph.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)]
        .map((match) => decodeXml(match[1]))
        .join('')
        .trim()
    )
    .filter(Boolean)
    .join('\n')
}

// Relationship targets are relative to the part that declares them.
function resolvePartPath(fromPart: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const segments = fromPart.split('/').slice(0, -1)
  for (const segment of target.split('/')) {
    if (segment === '..') segments.pop()
    else if (segment !== '.') segments.push(segment)
  }
  return segments.join('/')
}

async function readRelationships(
  zip: JSZip,
  part: string
): Promise<{ type: string; target: string; id: string }[]> {
  const folder = part.split('/').slice(0, -1).join('/')
  const name = part.split('/').pop()
  const xml = await zip.file(`${folder}/_rels/${name}.rels`)?.async('string')
  return [...(xml ?? '').matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => ({
    id: readAttribute(tag, 'Id') ?? '',
    type: readAttribute(tag, 'Type') ?? '',
    target: resolvePartPath(part, readAttribute(tag, 'Target') ?? ''),
  }))
}

/**
 * Slide text in presentation order, with speaker notes. Slide files are
 * numbered by creation, so the order comes from the presentation's slide list.
 */
export async function extractPptxSlides(data: ArrayBuffer): Promise<string[]> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(data)
  const presentationPart = 'ppt/presentation.xml'
  const presentation = await zip.file(presentationPart)?.async('string')
  if (!presentation) throw new Error('Not a PowerPoint presentation')

  const targets = new Map(
    (await readRelationships(zip, presentationPart)).map((relation) => [
      relation.id,
      relation.target,
    ])
  )
  const slideParts = [...presentation.matchAll(/<p:sldId\b[^>]*>/g)]
    .map(([tag]) => targets.get(readAttribute(tag, 'r:id') ?? ''))
    .filter((part): part is string => Boolean(part))

  return Promise.all(
    slideParts.map(async (slidePart) => {
      const slide = readDrawingText(
        (await zip.file(slidePart)?.async('string')) ?? ''
      )
      const notesPart = (await readRelationships(zip, slidePart)).find(
        (relation) => relation.type.endsWith('/notesSlide')
      )?.target
      const notes = notesPart
        ? readDrawingText((await zip.file(notesPart)?.async('string')) ?? '')
        : ''
      return notes ? `${slide}\nSpeaker notes: ${notes}`.trim() : slide
    })
  )
}

async function extractText(
  file: File,
  kind: DocumentKind
): Promise<{ text: string; pages: number | null; slides?: number }> {
  if (kind === 'text') return { text: await file.text(), pages: null }
  const data = await file.arrayBuffer()
  if (kind === 'docx') return { text: await extractDocxText(data), pages: null }
  if (kind === 'pptx') {
    const slides = await extractPptxSlides(data)
    return {
      text: slides
        .map((slide, index) =>
          slide.trim() ? `Slide ${index + 1}\n${slide.trim()}` : ''
        )
        .filter(Boolean)
        .join('\n\n'),
      pages: null,
      slides: slides.length,
    }
  }

  const pages = await extractPdfInWorker(data)
  return {
    text: pages
      .map((page) => page.trim())
      .filter(Boolean)
      .join('\n\n'),
    pages: pages.length,
  }
}

async function readDocumentBlock(file: File, kind: DocumentKind) {
  let extracted: Awaited<ReturnType<typeof extractText>>
  try {
    extracted = await extractText(file, kind)
  } catch (error) {
    console.error('Document text extraction failed:', error)
    throw new AttachmentAdapterError(DOCUMENT_ERROR_CODE.readFailed)
  }

  if (!extracted.text.trim()) {
    throw new AttachmentAdapterError(
      kind === 'pdf'
        ? DOCUMENT_ERROR_CODE.pdfNoText
        : DOCUMENT_ERROR_CODE.noText
    )
  }

  const { text, shortened } = truncateDocumentText(extracted.text.trim())
  return buildDocumentBlock({
    name: file.name,
    text,
    pages: extracted.pages,
    slides: extracted.slides,
    shortened,
  })
}

// How many documents are being read right now. Sending waits for this to
// reach zero, because a message sent mid-read would go out without the text.
let readingCount = 0
const readingListeners = new Set<() => void>()

function setReadingCount(next: number) {
  readingCount = next
  for (const listener of readingListeners) listener()
}

export function subscribeDocumentReading(listener: () => void): () => void {
  readingListeners.add(listener)
  return () => readingListeners.delete(listener)
}

export const isReadingDocument = (): boolean => readingCount > 0

// Documents the student removed while they were still being read. Yielding
// their result would put the chip back into the composer.
const removedWhileReading = new Set<string>()

/**
 * Reads PDF, Word, PowerPoint and plain-text files in the browser and turns them into one
 * text part. The file itself never leaves the device; only the extracted text
 * is sent with the message. Errors carry stable codes so the composer can
 * show a localized message.
 */
export const documentAttachmentAdapter: AttachmentAdapter = {
  accept: ACCEPT,

  async *add({ file }) {
    const kind = getDocumentKind(file)
    if (!kind) {
      throw new AttachmentAdapterError(DOCUMENT_ERROR_CODE.readFailed)
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      throw new AttachmentAdapterError(DOCUMENT_ERROR_CODE.tooLarge)
    }

    const attachment = {
      id: crypto.randomUUID(),
      type: 'document',
      name: file.name,
      contentType: file.type,
      file,
    } as const

    setReadingCount(readingCount + 1)
    try {
      yield {
        ...attachment,
        status: { type: 'running', reason: 'uploading', progress: 0 },
      } satisfies PendingAttachment

      let text: string
      try {
        text = await readDocumentBlock(file, kind)
      } catch (error) {
        if (removedWhileReading.has(attachment.id)) return
        throw error
      }
      if (removedWhileReading.has(attachment.id)) return

      yield {
        ...attachment,
        content: [{ type: 'text', text }],
        status: { type: 'requires-action', reason: 'composer-send' },
      } satisfies PendingAttachment
    } finally {
      removedWhileReading.delete(attachment.id)
      setReadingCount(readingCount - 1)
    }
  },

  async send(attachment) {
    return {
      ...attachment,
      status: { type: 'complete' },
    } as CompleteAttachment
  },

  async remove(attachment) {
    if (attachment.status.type === 'running') {
      removedWhileReading.add(attachment.id)
    }
  },
}
