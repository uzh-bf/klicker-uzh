'use client'
import { create } from 'zustand'

// Caches the verified origin of the embedding Manage parent window once a
// `klicker:manage-context` message from it has passed validation. Kept as a
// standalone store (rather than folded into chatContextStore, which tracks
// the unrelated PWA embed context) because the two embeddings have
// independent lifecycles and message types.
type ManageParentState = {
  manageParentOrigin: string | null
  setManageParentOrigin: (manageParentOrigin: string | null) => void
}

export const useManageParentStore = create<ManageParentState>((set) => ({
  manageParentOrigin: null,
  setManageParentOrigin: (manageParentOrigin) => set({ manageParentOrigin }),
}))
