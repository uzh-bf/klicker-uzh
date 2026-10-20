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

const HEADER_PREFIX = '--- Attached document: '
const FOOTER = '--- End of attached document ---'
const HEADER_PATTERN = /^--- Attached document: (.+?)(?: \(([^()]*)\))? ---$/
const MARKER_LINE_PATTERN =
  /^--- (?:Attached document: .* ---|End of attached document ---)$/gm

export type DocumentAttachmentInfo = {
  name: string
  pages: number | null
  shortened: boolean
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
}: {
  name: string
  text: string
  pages?: number | null
  shortened: boolean
}): string {
  const meta = [
    pages != null ? `${pages} ${pages === 1 ? 'page' : 'pages'}` : null,
    shortened ? `shortened to ~${MAX_DOCUMENT_TOKENS} tokens` : null,
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
  const meta = match[2] ?? ''
  const pages = /(\d+) pages?/.exec(meta)
  return {
    name: match[1],
    pages: pages ? Number(pages[1]) : null,
    shortened: /shortened/.test(meta),
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
