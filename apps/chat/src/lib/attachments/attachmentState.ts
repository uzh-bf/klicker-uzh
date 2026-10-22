import type { DocumentForSending } from './documentText'

type AttachmentRecord = {
  id: string
  type: 'image'
  position: number
  imageBase64?: string | null
  imagePreviewBase64?: string | null
  imageDescription?: string | null
  hasFullImage?: boolean
}

type ImageAttachmentPayload = {
  imageBase64?: string | null
  imagePreviewBase64?: string | null
}

type EditableMessage = {
  id?: string
  role: 'user' | 'assistant' | 'system'
  attachmentSourceMessageId?: string | null
  imageAttachments?: {
    id?: string
    type: 'image'
    position?: number
    imageBase64?: string | null
    imagePreviewBase64?: string | null
    imageDescription?: string | null
    hasFullImage?: boolean
  }[]
}

type HistoryAttachmentInput = {
  id: string
  position: number
  imageBase64?: string | null
  imagePreviewBase64?: string | null
  imageDescription?: string | null
}

type AttachmentIdentityInput = {
  id?: string
  position?: number
}

type ComposerImageContentPart = {
  type: 'image'
  image: string
  imagePreview?: string
}

type ComposerAttachmentInput = {
  content?: readonly unknown[]
}

export type LocalImageAttachment = {
  type: 'image'
  imageBase64: string
  imagePreviewBase64: string
  imageDescription: null
}

export function sortAttachmentsByPosition<T extends { position: number }>(
  attachments: T[]
): T[] {
  return [...attachments].sort((a, b) => a.position - b.position)
}

export function getImageAttachmentKey(
  attachment: AttachmentIdentityInput,
  index: number
): string {
  if (attachment.id) {
    return `id:${attachment.id}`
  }

  return `pos:${attachment.position ?? index}`
}

export function hasAllImageAttachmentsHydrated<
  T extends { imageBase64?: string | null },
>(attachments?: T[]): boolean {
  return (attachments ?? []).every(
    (attachment) => attachment.imageBase64 != null
  )
}

export function hasAnyImageAttachmentData<T extends ImageAttachmentPayload>(
  attachments?: T[]
): boolean {
  return (attachments ?? []).some(
    (attachment) =>
      attachment.imageBase64 != null || attachment.imagePreviewBase64 != null
  )
}

type MessageWithParentAndImageAttachments = {
  id?: string
  parentId?: string | null
  imageAttachments?: ImageAttachmentPayload[] | null
}

/**
 * True when the message identified by `messageId` responds to a parent
 * (one hop up the branch's `parentId` chain) that carries at least one
 * image attachment with actual image data. Drives the "image analyzed"
 * activity chip on an assistant reply — no new persisted state, the
 * parent's `imageAttachments` are already loaded with the thread.
 */
export function parentMessageHasImageAttachment(
  messages: MessageWithParentAndImageAttachments[],
  messageId?: string | null
): boolean {
  if (!messageId) return false
  const message = messages.find((m) => m.id === messageId)
  if (!message?.parentId) return false
  const parent = messages.find((m) => m.id === message.parentId)
  return hasAnyImageAttachmentData(parent?.imageAttachments ?? [])
}

function isComposerImageContentPart(
  part: unknown
): part is ComposerImageContentPart {
  return (
    typeof part === 'object' &&
    part !== null &&
    'type' in part &&
    part.type === 'image' &&
    'image' in part &&
    typeof part.image === 'string'
  )
}

export function extractLocalImageAttachments(
  attachments?: readonly ComposerAttachmentInput[]
): LocalImageAttachment[] {
  return (attachments ?? [])
    .flatMap((attachment) => attachment.content ?? [])
    .filter(isComposerImageContentPart)
    .map((part) => ({
      type: 'image' as const,
      imageBase64: part.image,
      imagePreviewBase64:
        typeof part.imagePreview === 'string' ? part.imagePreview : part.image,
      imageDescription: null,
    }))
}

type ComposerDocumentAttachmentInput = {
  type?: string
  content?: readonly unknown[]
  file?: unknown
}

/** Text blocks of the document attachments, in the order they were added. */
export function extractDocumentBlocks(
  attachments?: readonly ComposerDocumentAttachmentInput[]
): string[] {
  return (attachments ?? [])
    .filter((attachment) => attachment.type === 'document')
    .flatMap((attachment) => attachment.content ?? [])
    .filter(
      (part): part is { type: 'text'; text: string } =>
        typeof part === 'object' &&
        part !== null &&
        'type' in part &&
        part.type === 'text' &&
        'text' in part &&
        typeof part.text === 'string'
    )
    .map((part) => part.text)
}

const isPageImagePart = (
  part: unknown
): part is { type: 'file'; mimeType: string; data: string } =>
  typeof part === 'object' &&
  part !== null &&
  'type' in part &&
  part.type === 'file' &&
  'mimeType' in part &&
  part.mimeType === 'image/jpeg' &&
  'data' in part &&
  typeof part.data === 'string'

/**
 * Each document attachment with its text block and the JPEG pages rendered
 * for it, in the order the files were added.
 */
export function extractDocumentsForSending(
  attachments?: readonly ComposerDocumentAttachmentInput[]
): DocumentForSending[] {
  return (attachments ?? [])
    .filter((attachment) => attachment.type === 'document')
    .flatMap((attachment) => {
      const block = extractDocumentBlocks([attachment])[0]
      if (block == null) return []
      return [
        {
          block,
          pageImages: (attachment.content ?? [])
            .filter(isPageImagePart)
            .map((part) => part.data),
          ...(attachment.file instanceof Blob ? { file: attachment.file } : {}),
        },
      ]
    })
}

// Original files of sent documents, for the preview until the page reloads.
// Only the extracted text is stored; after a reload the preview shows that.
// Keyed by message ID and the document's position in the message.
export type DocumentOriginal = { url: string; type: string; size: number }
const documentOriginals = new Map<string, DocumentOriginal>()
const MAX_DOCUMENT_ORIGINALS = 20
// Each object URL keeps its whole file in memory, so the total is capped too.
const MAX_DOCUMENT_ORIGINAL_BYTES = 50 * 1024 * 1024
const documentOriginalKey = (messageId: string, index: number) =>
  `${messageId}:${index}`

// Shared URLs (an edited message and its source) count once.
const originalBytes = () =>
  [
    ...new Map(
      [...documentOriginals.values()].map((entry) => [entry.url, entry.size])
    ).values(),
  ].reduce((total, size) => total + size, 0)

function storeDocumentOriginal(key: string, original: DocumentOriginal) {
  documentOriginals.delete(key)
  documentOriginals.set(key, original)
  for (const [oldestKey, oldest] of documentOriginals) {
    if (
      documentOriginals.size <= MAX_DOCUMENT_ORIGINALS &&
      originalBytes() <= MAX_DOCUMENT_ORIGINAL_BYTES
    ) {
      break
    }
    // The newest entry stays, even when it alone exceeds the budget.
    if (oldestKey === key) break
    documentOriginals.delete(oldestKey)
    // An edited message shares the URL of the message it was edited from.
    const stillUsed = [...documentOriginals.values()].some(
      (entry) => entry.url === oldest.url
    )
    if (!stillUsed) URL.revokeObjectURL(oldest.url)
  }
}

export function rememberDocumentOriginal(
  messageId: string,
  index: number,
  file: Blob
): void {
  storeDocumentOriginal(documentOriginalKey(messageId, index), {
    url: URL.createObjectURL(file),
    type: file.type,
    size: file.size,
  })
}

export function copyDocumentOriginal(
  from: { messageId: string; index: number },
  to: { messageId: string; index: number }
): void {
  const original = documentOriginals.get(
    documentOriginalKey(from.messageId, from.index)
  )
  if (original) {
    storeDocumentOriginal(documentOriginalKey(to.messageId, to.index), original)
  }
}

export function getDocumentOriginal(
  messageId: string,
  index: number
): DocumentOriginal | null {
  return documentOriginals.get(documentOriginalKey(messageId, index)) ?? null
}

// Page images ride along with the request that answers their message and
// are then dropped: they are neither kept in the thread state nor stored.
const pendingDocumentPages = new Map<string, string[]>()
const MAX_PENDING_DOCUMENT_MESSAGES = 3

export function setPendingDocumentPages(
  messageId: string,
  pageImages: string[]
): void {
  // Entries stay per message, so another send cannot drop the restored pages
  // of a failed message before its retry. Only the newest few are kept, so
  // pages of discarded messages cannot pile up for the rest of the session.
  pendingDocumentPages.delete(messageId)
  if (pageImages.length === 0) return
  pendingDocumentPages.set(messageId, pageImages)
  for (const oldestId of pendingDocumentPages.keys()) {
    if (pendingDocumentPages.size <= MAX_PENDING_DOCUMENT_MESSAGES) break
    pendingDocumentPages.delete(oldestId)
  }
}

export function takePendingDocumentPages(messageId?: string | null): string[] {
  if (!messageId) return []
  const pageImages = pendingDocumentPages.get(messageId) ?? []
  pendingDocumentPages.delete(messageId)
  return pageImages
}

// Kept documents of an edited message are removed by key, like its images.
export function getDocumentAttachmentKey(index: number): string {
  return `doc:${index}`
}

export function mergeHydratedAttachments(
  attachments: AttachmentRecord[],
  hydratedAttachments: AttachmentRecord[]
): AttachmentRecord[] {
  const hydratedById = new Map(
    hydratedAttachments.map((attachment) => [attachment.id, attachment])
  )

  return sortAttachmentsByPosition(
    attachments.map((attachment) => {
      const hydrated = hydratedById.get(attachment.id)

      if (!hydrated) {
        return { ...attachment }
      }

      const merged: AttachmentRecord = {
        ...attachment,
        imageBase64: hydrated.imageBase64 ?? attachment.imageBase64 ?? null,
        imagePreviewBase64:
          hydrated.imagePreviewBase64 ?? attachment.imagePreviewBase64 ?? null,
        imageDescription:
          hydrated.imageDescription ?? attachment.imageDescription ?? null,
      }

      const inferredHasFullImage =
        hydrated.imageBase64 != null || attachment.imageBase64 != null

      merged.hasFullImage =
        hydrated.hasFullImage ?? attachment.hasFullImage ?? inferredHasFullImage

      return merged
    })
  )
}

export function getEditedMessageSource<T extends EditableMessage>({
  editedMessageId,
  messages,
}: {
  editedMessageId?: string | null
  messages: T[]
}): T | undefined {
  if (!editedMessageId) {
    return undefined
  }

  return messages.find((message) => message.id === editedMessageId)
}

/**
 * The visual summary of a message's PDF pages is stored as a ChatAttachment
 * row without any image data, next to the message's image rows. Only rows
 * with image data are images; the summary row is model context and never
 * shown as an attachment.
 */
export const IMAGE_ROW_FILTER = { imageBase64: { not: null } } as const
export const DOCUMENT_PAGE_SUMMARY_ROW_FILTER = {
  imageBase64: null,
  imagePreviewBase64: null,
} as const

// About 1.5 MB of JPEG per page; a 1,600 px page is usually far smaller.
export const MAX_DOCUMENT_PAGE_DATA_URL_LENGTH = 2_000_000

export function buildDocumentPageSummaryRow({
  messageId,
  position,
  summary,
}: {
  messageId: string
  position: number
  summary: string
}) {
  return {
    type: 'IMAGE' as const,
    messageId,
    position,
    imageBase64: null,
    imagePreviewBase64: null,
    imageDescription: summary,
  }
}

export function buildHistoryAttachmentDto(attachment: HistoryAttachmentInput): {
  id: string
  type: 'image'
  position: number
  imagePreviewBase64: string | null
  imageDescription: string | null
  hasFullImage: boolean
} {
  return {
    id: attachment.id,
    type: 'image',
    position: attachment.position,
    imagePreviewBase64: attachment.imagePreviewBase64 ?? null,
    imageDescription: attachment.imageDescription ?? null,
    hasFullImage: attachment.imageBase64 != null,
  }
}

/**
 * Appends a text note to a model message's content. A regenerated message
 * that re-sends its images already carries text and image parts, so the note
 * joins them as one more part instead of turning the parts into a string.
 */
export function appendTextToModelContent<Part>(
  content: string | Part[],
  text: string
): string | (Part | { type: 'text'; text: string })[] {
  return typeof content === 'string'
    ? `${content}\n\n${text}`
    : [...content, { type: 'text' as const, text }]
}
