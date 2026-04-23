'use client'
import { create } from 'zustand'

export const MAX_IMAGE_ATTACHMENTS = 3

interface ComposerStore {
  attachmentError: string | null
  setAttachmentError: (error: string | null) => void
  attachmentCount: number
  setAttachmentCount: (count: number) => void
  editRemovedAttachmentKeysByMessageId: Record<string, string[]>
  addEditRemovedAttachmentKey: (messageId: string, key: string) => void
  clearEditRemovedAttachmentKeys: (messageId: string) => void
}

export const useComposerStore = create<ComposerStore>((set) => ({
  attachmentError: null,
  setAttachmentError: (error) => set({ attachmentError: error }),
  attachmentCount: 0,
  setAttachmentCount: (count) => set({ attachmentCount: count }),
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
