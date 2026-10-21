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
        },
      ]
    })
}

// Page images ride along with the request that answers their message and
// are then dropped: they are neither kept in the thread state nor stored.
const pendingDocumentPages = new Map<string, string[]>()

export function setPendingDocumentPages(
  messageId: string,
  pageImages: string[]
): void {
  if (pageImages.length > 0) pendingDocumentPages.set(messageId, pageImages)
  else pendingDocumentPages.delete(messageId)
}

export function clearPendingDocumentPages(messageId: string): void {
  pendingDocumentPages.delete(messageId)
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
