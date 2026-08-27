type UiImageAttachment = {
  id?: string
  imageBase64?: string | null
  imagePreviewBase64?: string | null
}

type AttachmentVariant = 'history' | 'edit'

export function canUseComposerAttachments({
  maxImageAttachments,
  supportsImages,
}: {
  maxImageAttachments: number
  supportsImages: boolean
}): boolean {
  return supportsImages && maxImageAttachments > 0
}

export function getAttachmentPreviewSrc(
  attachment: UiImageAttachment,
  variant: AttachmentVariant
): string | null {
  if (variant === 'edit') {
    return attachment.imageBase64 ?? attachment.imagePreviewBase64 ?? null
  }

  // Persisted history stays preview-only; unsaved local attachments can still
  // fall back to the full image so same-session UX remains usable.
  return (
    attachment.imagePreviewBase64 ??
    (attachment.id ? null : (attachment.imageBase64 ?? null))
  )
}

export function canOpenMessageAttachment({
  attachment,
  canHydratePersistedAttachment,
}: {
  attachment: UiImageAttachment
  canHydratePersistedAttachment: boolean
}): {
  canOpen: boolean
  shouldHydrate: boolean
} {
  if (attachment.imageBase64) {
    return { canOpen: true, shouldHydrate: false }
  }

  if (canHydratePersistedAttachment && attachment.id) {
    return { canOpen: true, shouldHydrate: true }
  }

  return { canOpen: false, shouldHydrate: false }
}
