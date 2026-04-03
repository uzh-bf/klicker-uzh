'use client'
import { create } from 'zustand'

export const MAX_IMAGE_ATTACHMENTS = 3

interface ComposerStore {
  attachmentError: string | null
  setAttachmentError: (error: string | null) => void
  attachmentCount: number
  setAttachmentCount: (count: number) => void
}

export const useComposerStore = create<ComposerStore>((set) => ({
  attachmentError: null,
  setAttachmentError: (error) => set({ attachmentError: error }),
  attachmentCount: 0,
  setAttachmentCount: (count) => set({ attachmentCount: count }),
}))
