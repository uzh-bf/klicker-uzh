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

type RequestAttachmentInput = AttachmentIdentityInput & {
  imageBase64?: string | null
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

export type ChatRequestImageAttachment =
  | { type: 'new-image'; imageBase64: string }
  | { type: 'persisted-image'; id: string }

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

export function buildChatRequestImageAttachments(
  attachments?: RequestAttachmentInput[]
): ChatRequestImageAttachment[] {
  return (attachments ?? []).flatMap<ChatRequestImageAttachment>(
    (attachment) => {
      if (attachment.id) {
        return [{ type: 'persisted-image' as const, id: attachment.id }]
      }
      if (typeof attachment.imageBase64 === 'string') {
        return [
          {
            type: 'new-image' as const,
            imageBase64: attachment.imageBase64,
          },
        ]
      }
      return []
    }
  )
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

export function getEditedMessageSource({
  editedMessageId,
  messages,
}: {
  editedMessageId?: string | null
  messages: EditableMessage[]
}): EditableMessage | undefined {
  if (!editedMessageId) {
    return undefined
  }

  return messages.find((message) => message.id === editedMessageId)
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
