import type {
  AttachmentAdapter,
  CompleteAttachment,
  PendingAttachment,
} from '@assistant-ui/react'
import {
  buildDocumentBlock,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_VISUAL_REVIEW_PAGES,
  truncateDocumentText,
  type VisualReviewStatus,
} from './documentText'
import { AttachmentAdapterError } from './imageAttachmentAdapter'
import { type PdfReadResult, PDF_TEXT_MESSAGE, readPdf } from './pdfText'

export const DOCUMENT_ERROR_CODE = {
  tooLarge: 'document-too-large',
  noText: 'document-no-text',
  pdfNoText: 'document-pdf-no-text',
  presentation: 'document-presentation',
  readFailed: 'document-read-failed',
} as const

type DocumentKind = 'text' | 'pdf' | 'docx'

const DOCX_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PRESENTATION_TYPES = [
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
]

// Extensions as well as MIME types: browsers often report `.md` and `.csv`
// files with an empty or platform-specific type.
const ACCEPT = [
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.pdf',
  '.docx',
  // Presentations are accepted only to tell the student to attach a PDF.
  '.pptx',
  '.ppt',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/pdf',
  DOCX_TYPE,
  ...PRESENTATION_TYPES,
].join(',')

export function getDocumentKind(file: {
  name: string
  type: string
}): DocumentKind | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (file.type === 'application/pdf' || extension === 'pdf') return 'pdf'
  if (file.type === DOCX_TYPE || extension === 'docx') return 'docx'
  if (
    ['txt', 'md', 'markdown', 'csv'].includes(extension) ||
    ['text/plain', 'text/markdown', 'text/csv'].includes(file.type)
  ) {
    return 'text'
  }
  return null
}

async function readPdfInWorker(
  data: ArrayBuffer,
  maxRenderedPages: number
): Promise<PdfReadResult> {
  if (typeof Worker === 'undefined') {
    return await readPdf(data, { maxRenderedPages })
  }

  const worker = new Worker(new URL('./pdfText.worker.ts', import.meta.url), {
    type: 'module',
  })
  try {
    return await new Promise<PdfReadResult>((resolve, reject) => {
      worker.onmessage = (
        event: MessageEvent<
          | ({ type?: unknown; ok: true } & PdfReadResult)
          | { type?: unknown; ok: false; message: string }
        >
      ) => {
        if (event.data?.type !== PDF_TEXT_MESSAGE) return
        if (event.data.ok) {
          resolve({
            pages: event.data.pages,
            pageImages: event.data.pageImages,
          })
        } else reject(new Error(event.data.message))
      }
      worker.onerror = (event) => reject(new Error(event.message))
      worker.postMessage({ type: PDF_TEXT_MESSAGE, data, maxRenderedPages }, [
        data,
      ])
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

type ExtractedDocument = {
  text: string
  pages: number | null
  pageImages: string[] | null
}

async function extractText(
  file: File,
  kind: DocumentKind,
  renderPages: boolean
): Promise<ExtractedDocument> {
  if (kind === 'text') {
    return { text: await file.text(), pages: null, pageImages: null }
  }
  const data = await file.arrayBuffer()
  if (kind === 'docx') {
    return { text: await extractDocxText(data), pages: null, pageImages: null }
  }

  const { pages, pageImages } = await readPdfInWorker(
    data,
    renderPages ? MAX_VISUAL_REVIEW_PAGES : 0
  )
  return {
    text: pages
      .map((page) => page.trim())
      .filter(Boolean)
      .join('\n\n'),
    pages: pages.length,
    pageImages,
  }
}

function getVisualReviewStatus(
  extracted: ExtractedDocument,
  renderPages: boolean
): VisualReviewStatus | null {
  if (extracted.pages == null) return null
  if (extracted.pageImages) return 'reviewed'
  return renderPages ? 'too-many-pages' : 'no-image-support'
}

async function readDocument(
  file: File,
  kind: DocumentKind,
  renderPages: boolean
): Promise<{ block: string; pageImages: string[] }> {
  let extracted: ExtractedDocument
  try {
    extracted = await extractText(file, kind, renderPages)
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
  return {
    block: buildDocumentBlock({
      name: file.name,
      text,
      pages: extracted.pages,
      shortened,
      visualReview: getVisualReviewStatus(extracted, renderPages),
    }),
    pageImages: extracted.pageImages ?? [],
  }
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
 * Reads PDF, Word and plain-text files in the browser and turns them into one
 * text part. The file itself never leaves the device; only the extracted text
 * is sent with the message. With `renderPages`, every page of a PDF of up to
 * ten pages is also rendered as a JPEG and kept as a `file` part, so the
 * model can see slides and figures; those images are sent with the message
 * but never stored. Errors carry stable codes so the composer can show a
 * localized message.
 */
const createDocumentAttachmentAdapter = ({
  renderPages,
}: {
  renderPages: boolean
}): AttachmentAdapter => ({
  accept: ACCEPT,

  async *add({ file }) {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (
      PRESENTATION_TYPES.includes(file.type) ||
      ['pptx', 'ppt'].includes(extension)
    ) {
      throw new AttachmentAdapterError(DOCUMENT_ERROR_CODE.presentation)
    }
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

      let document: { block: string; pageImages: string[] }
      try {
        document = await readDocument(file, kind, renderPages)
      } catch (error) {
        if (removedWhileReading.has(attachment.id)) return
        throw error
      }
      if (removedWhileReading.has(attachment.id)) return

      yield {
        ...attachment,
        content: [
          { type: 'text', text: document.block },
          ...document.pageImages.map((data, index) => ({
            type: 'file' as const,
            mimeType: 'image/jpeg',
            filename: `${file.name} – page ${index + 1}.jpg`,
            data,
          })),
        ],
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
})

/** Text only, for models that cannot read images. */
export const documentAttachmentAdapter = createDocumentAttachmentAdapter({
  renderPages: false,
})

/** Text plus rendered PDF pages, for models that read images. */
export const visualDocumentAttachmentAdapter = createDocumentAttachmentAdapter({
  renderPages: true,
})
