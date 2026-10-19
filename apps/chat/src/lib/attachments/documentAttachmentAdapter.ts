import type {
  AttachmentAdapter,
  CompleteAttachment,
  PendingAttachment,
} from '@assistant-ui/react'
import {
  buildDocumentBlock,
  MAX_DOCUMENT_SIZE_BYTES,
  truncateDocumentText,
} from './documentText'
import { AttachmentAdapterError } from './imageAttachmentAdapter'
import { extractPdfPages } from './pdfText'

export const DOCUMENT_ERROR_CODE = {
  tooLarge: 'document-too-large',
  noText: 'document-no-text',
  pdfNoText: 'document-pdf-no-text',
  readFailed: 'document-read-failed',
} as const

type DocumentKind = 'text' | 'pdf' | 'docx'

const DOCX_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

// Extensions as well as MIME types: browsers often report `.md` and `.csv`
// files with an empty or platform-specific type.
const ACCEPT = [
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.pdf',
  '.docx',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/pdf',
  DOCX_TYPE,
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

async function extractPdfInWorker(data: ArrayBuffer): Promise<string[]> {
  if (typeof Worker === 'undefined') return await extractPdfPages(data)

  const worker = new Worker(new URL('./pdfText.worker.ts', import.meta.url), {
    type: 'module',
  })
  try {
    return await new Promise<string[]>((resolve, reject) => {
      worker.onmessage = (
        event: MessageEvent<
          { ok: true; pages: string[] } | { ok: false; message: string }
        >
      ) => {
        if (event.data.ok) resolve(event.data.pages)
        else reject(new Error(event.data.message))
      }
      worker.onerror = (event) => reject(new Error(event.message))
      worker.postMessage(data, [data])
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

async function extractText(
  file: File,
  kind: DocumentKind
): Promise<{ text: string; pages: number | null }> {
  if (kind === 'text') return { text: await file.text(), pages: null }
  const data = await file.arrayBuffer()
  if (kind === 'docx') return { text: await extractDocxText(data), pages: null }

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
  let extracted: { text: string; pages: number | null }
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
 * Reads PDF, Word and plain-text files in the browser and turns them into one
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
