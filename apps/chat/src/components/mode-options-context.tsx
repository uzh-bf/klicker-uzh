'use client'

import {
  hasAvailableChatMode,
  type ChatModeOptions,
} from '@/src/lib/config/modes'
import { createContext, type PropsWithChildren, useContext } from 'react'

const ModeOptionsContext = createContext<ChatModeOptions | null>(null)

export function ModeOptionsProvider({
  children,
  modeOptions,
}: PropsWithChildren<{ modeOptions: ChatModeOptions }>) {
  return (
    <ModeOptionsContext.Provider value={modeOptions}>
      {children}
    </ModeOptionsContext.Provider>
  )
}

export function useEffectiveModeOptions(): ChatModeOptions {
  const modeOptions = useContext(ModeOptionsContext)
  if (modeOptions === null) {
    throw new Error('useEffectiveModeOptions requires ModeOptionsProvider')
  }
  return modeOptions
}

export function useHasAvailableChatMode(): boolean {
  return hasAvailableChatMode(useEffectiveModeOptions())
}
