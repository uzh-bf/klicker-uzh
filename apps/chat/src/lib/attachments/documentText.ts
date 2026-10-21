/**
 * Document attachments are parsed in the browser and travel as plain text
 * inside the user message: the typed question first, then one block per file.
 * The block header is both readable for the model and the only structure the
 * client has to recover a file chip after a reload, because history returns a
 * user message as one text string. Header and footer wording are therefore a
 * stored format: changing them breaks chips for already-saved messages.
 */

export const MAX_DOCUMENT_ATTACHMENTS = 3
export const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024 // 15 MB
export const MAX_DOCUMENT_TOKENS = 20_000
// Token counts are estimated as characters / 4, so the cap is a character cap.
const CHARS_PER_TOKEN = 4
const MAX_DOCUMENT_CHARS = MAX_DOCUMENT_TOKENS * CHARS_PER_TOKEN
// PDF pages are also sent as images when the model can read them, up to this
// many pages per message across all attached documents.
export const MAX_VISUAL_REVIEW_PAGES = 10

/**
 * Whether the pages of a PDF went to the model as images. `skipped` covers
 * pages the student kept while editing a message: their images are not sent
 * again.
 */
export type VisualReviewStatus =
  | 'reviewed'
  | 'too-many-pages'
  | 'no-image-support'
  | 'skipped'

const VISUAL_REVIEW_META: Record<VisualReviewStatus, string> = {
  reviewed: 'pages reviewed visually',
  // Stored wording stays independent of the limit, so changing the limit
  // keeps older messages parseable.
  'too-many-pages': 'pages not reviewed visually: page limit per message',
  'no-image-support': 'pages not reviewed visually: model cannot read images',
  skipped: 'pages not reviewed visually',
}

const HEADER_PREFIX = '--- Attached document: '
const FOOTER = '--- End of attached document ---'
const HEADER_PATTERN = /^--- Attached document: (.+?)(?: \(([^()]*)\))? ---$/
const MARKER_LINE_PATTERN =
  /^--- (?:Attached document: .* ---|End of attached document ---)$/gm

export type DocumentAttachmentInfo = {
  name: string
  pages: number | null
  shortened: boolean
  visualReview: VisualReviewStatus | null
  tokenEstimate: number
  text: string
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Cuts text to the per-document token budget. The cut prefers the last
 * whitespace in the final 1,000 characters so a word is not split in half.
 */
export function truncateDocumentText(text: string): {
  text: string
  shortened: boolean
} {
  if (text.length <= MAX_DOCUMENT_CHARS) return { text, shortened: false }

  const hardCut = text.slice(0, MAX_DOCUMENT_CHARS)
  const lastBreak = hardCut.search(/\s\S*$/)
  const cut =
    lastBreak > MAX_DOCUMENT_CHARS - 1_000
      ? hardCut.slice(0, lastBreak)
      : hardCut
  return { text: cut.trimEnd(), shortened: true }
}

const sanitizeName = (name: string): string =>
  name
    .replace(/[\r\n]+/g, ' ')
    .replace(/[()]/g, '')
    .trim() || 'document'

// A body line that looks like a header or footer would end the block early or
// start a phantom one when the message is parsed again.
const neutralizeMarkerLines = (text: string): string =>
  text.replace(MARKER_LINE_PATTERN, (line) => ` ${line}`)

export function buildDocumentBlock({
  name,
  text,
  pages,
  shortened,
  visualReview,
}: {
  name: string
  text: string
  pages?: number | null
  shortened: boolean
  visualReview?: VisualReviewStatus | null
}): string {
  const meta = [
    pages != null ? `${pages} ${pages === 1 ? 'page' : 'pages'}` : null,
    shortened ? `shortened to ~${MAX_DOCUMENT_TOKENS} tokens` : null,
    visualReview ? VISUAL_REVIEW_META[visualReview] : null,
  ].filter(Boolean)
  const header = `${HEADER_PREFIX}${sanitizeName(name)}${
    meta.length > 0 ? ` (${meta.join(', ')})` : ''
  } ---`
  return `${header}\n${neutralizeMarkerLines(text.trim())}\n${FOOTER}`
}

/**
 * Joins the typed question and the document blocks. The question comes first
 * so thread titles and history labels, which read the start of the message,
 * stay readable.
 */
export function composeMessageText(
  question: string,
  documentBlocks: string[]
): string {
  const trimmedQuestion = question.trim()
  if (documentBlocks.length === 0) return trimmedQuestion
  return [trimmedQuestion, ...documentBlocks].filter(Boolean).join('\n\n')
}

function parseHeader(
  line: string
): Omit<DocumentAttachmentInfo, 'text' | 'tokenEstimate'> | null {
  const match = HEADER_PATTERN.exec(line)
  if (!match) return null
  const meta = (match[2] ?? '').split(', ')
  const pages = meta.map((part) => /^(\d+) pages?$/.exec(part)).find(Boolean)
  const visualReview = (
    Object.entries(VISUAL_REVIEW_META) as [VisualReviewStatus, string][]
  ).find(([, text]) => meta.includes(text))?.[0]
  return {
    name: match[1],
    pages: pages ? Number(pages[1]) : null,
    shortened: meta.some((part) => part.startsWith('shortened')),
    visualReview: visualReview ?? null,
  }
}

/**
 * Splits a stored user message into the typed question and its document
 * blocks. Text that does not end in well-formed blocks is returned unchanged
 * as the question, so ordinary messages never lose content.
 */
export function parseMessageDocuments(text: string): {
  question: string
  documents: DocumentAttachmentInfo[]
} {
  const lines = text.split('\n')
  const firstHeader = lines.findIndex((line) => HEADER_PATTERN.test(line))
  if (firstHeader === -1) return { question: text, documents: [] }

  const documents: DocumentAttachmentInfo[] = []
  let index = firstHeader
  while (index < lines.length) {
    if (lines[index].trim() === '') {
      index++
      continue
    }
    const header = parseHeader(lines[index])
    const footer = lines.indexOf(FOOTER, index + 1)
    if (!header || footer === -1) return { question: text, documents: [] }
    const body = lines.slice(index + 1, footer).join('\n')
    documents.push({
      ...header,
      text: body,
      tokenEstimate: estimateTokens(body),
    })
    index = footer + 1
  }

  return {
    question: lines.slice(0, firstHeader).join('\n').trim(),
    documents,
  }
}

export function getDocumentBlocks(text: string): string[] {
  return parseMessageDocuments(text).documents.map((document) =>
    buildDocumentBlock(document)
  )
}

/** The typed question alone, for titles, history labels and editing. */
export function stripDocumentBlocks(text: string): string {
  return parseMessageDocuments(text).question
}

export type DocumentForSending = {
  /** The stored text block, as built when the file was attached. */
  block: string
  /** JPEG data URLs of the rendered pages; empty when none were rendered. */
  pageImages: string[]
}

/**
 * Decides at send time which PDF pages go to the model as images. Pages are
 * only sent when the selected model reads images and all pages of a document
 * fit into the per-message budget; the block header then records what was
 * actually sent, so the chip after a reload matches the request.
 */
export function applyVisualReview(
  documents: DocumentForSending[],
  { supportsImages }: { supportsImages: boolean }
): { blocks: string[]; pageImages: string[] } {
  const pageImages: string[] = []
  const blocks = documents.map(({ block, pageImages: pages }) => {
    const document = parseMessageDocuments(block).documents[0]
    if (!document || document.visualReview == null) return block

    let visualReview = document.visualReview
    // Read for a text-only model, sent with one that reads images: the pages
    // were never rendered, so the stored reason would be wrong.
    if (visualReview === 'no-image-support' && supportsImages) {
      visualReview = 'skipped'
    }
    if (visualReview === 'reviewed' || pages.length > 0) {
      if (!supportsImages) {
        visualReview = 'no-image-support'
      } else if (
        pages.length === 0 ||
        pageImages.length + pages.length > MAX_VISUAL_REVIEW_PAGES
      ) {
        visualReview = pages.length === 0 ? 'skipped' : 'too-many-pages'
      } else {
        visualReview = 'reviewed'
        pageImages.push(...pages)
      }
    }
    return visualReview === document.visualReview
      ? block
      : buildDocumentBlock({ ...document, visualReview })
  })
  return { blocks, pageImages }
}
