import type { KlickerChatContextV2 } from '@klicker-uzh/types'
import { create } from 'zustand'

type ChatContextState = {
  context: KlickerChatContextV2 | null
  parentOrigin: string | null
  contextUnavailable: boolean
  setContext: (context: KlickerChatContextV2, parentOrigin: string) => void
  clearContext: () => void
}

export const useChatContextStore = create<ChatContextState>((set) => ({
  context: null,
  parentOrigin: null,
  contextUnavailable: false,
  setContext: (context, parentOrigin) =>
    set({ context, parentOrigin, contextUnavailable: false }),
  clearContext: () =>
    set({ context: null, parentOrigin: null, contextUnavailable: false }),
}))
