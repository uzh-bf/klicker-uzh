import type { KlickerChatContextV2 } from '@klicker-uzh/types'
import { create } from 'zustand'

type ChatContextState = {
  context: KlickerChatContextV2 | null
  parentOrigin: string | null
  setContext: (context: KlickerChatContextV2, parentOrigin: string) => void
  clearContext: () => void
}

export const useChatContextStore = create<ChatContextState>((set) => ({
  context: null,
  parentOrigin: null,
  setContext: (context, parentOrigin) => set({ context, parentOrigin }),
  clearContext: () => set({ context: null, parentOrigin: null }),
}))
