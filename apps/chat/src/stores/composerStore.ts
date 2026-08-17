'use client'
import { create } from 'zustand'

export { MAX_IMAGE_ATTACHMENTS } from '@/src/lib/config/attachmentLimits'

interface ComposerStore {
  editRemovedAttachmentKeysByMessageId: Record<string, string[]>
  addEditRemovedAttachmentKey: (messageId: string, key: string) => void
  clearEditRemovedAttachmentKeys: (messageId: string) => void
}

export const useComposerStore = create<ComposerStore>((set) => ({
  editRemovedAttachmentKeysByMessageId: {},
  addEditRemovedAttachmentKey: (messageId, key) =>
    set((state) => {
      const existing =
        state.editRemovedAttachmentKeysByMessageId[messageId] ?? []
      if (existing.includes(key)) {
        return state
      }

      return {
        editRemovedAttachmentKeysByMessageId: {
          ...state.editRemovedAttachmentKeysByMessageId,
          [messageId]: [...existing, key],
        },
      }
    }),
  clearEditRemovedAttachmentKeys: (messageId) =>
    set((state) => {
      const rest = { ...state.editRemovedAttachmentKeysByMessageId }
      delete rest[messageId]
      return {
        editRemovedAttachmentKeysByMessageId: rest,
      }
    }),
}))
