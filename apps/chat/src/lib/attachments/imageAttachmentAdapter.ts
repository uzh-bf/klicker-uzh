import type {
  AttachmentAdapter,
  CompleteAttachment,
  PendingAttachment,
} from '@assistant-ui/react'

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB

export const imageAttachmentAdapter: AttachmentAdapter = {
  accept: 'image/jpeg,image/png,image/gif,image/webp',

  async add({ file }) {
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(
        `Image must be smaller than 2 MB (got ${(file.size / 1024 / 1024).toFixed(1)} MB)`
      )
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    return {
      id: crypto.randomUUID(),
      type: 'image',
      name: file.name,
      contentType: file.type,
      file,
      content: [{ type: 'image', image: dataUrl }],
      status: { type: 'requires-action', reason: 'composer-send' },
    } satisfies PendingAttachment
  },

  async send(attachment) {
    return {
      ...attachment,
      status: { type: 'complete' },
    } as CompleteAttachment
  },

  async remove() {
    // no-op: remove from local composer state only
  },
}
