import type { KlickerChatContext } from '@klicker-uzh/types'
import { create } from 'zustand'

type ChatContextState = {
  context: KlickerChatContext | null
  parentOrigin: string | null
  setContext: (context: KlickerChatContext, parentOrigin: string) => void
  clearContext: () => void
}

export const useChatContextStore = create<ChatContextState>((set) => ({
  context: null,
  parentOrigin: null,
  setContext: (context, parentOrigin) => set({ context, parentOrigin }),
  clearContext: () => set({ context: null, parentOrigin: null }),
}))
