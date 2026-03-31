'use client'
import { create } from 'zustand'

interface ComposerStore {
  attachmentError: string | null
  setAttachmentError: (error: string | null) => void
}

export const useComposerStore = create<ComposerStore>((set) => ({
  attachmentError: null,
  setAttachmentError: (error) => set({ attachmentError: error }),
}))
