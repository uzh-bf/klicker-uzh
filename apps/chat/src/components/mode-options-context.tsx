'use client'

import { hasAvailableChatMode } from '@/src/lib/config/modes'
import { createContext, type PropsWithChildren, useContext } from 'react'

const ModeOptionsContext = createContext<Record<string, string> | null>(null)

export function ModeOptionsProvider({
  children,
  modeOptions,
}: PropsWithChildren<{ modeOptions: Record<string, string> }>) {
  return (
    <ModeOptionsContext.Provider value={modeOptions}>
      {children}
    </ModeOptionsContext.Provider>
  )
}

export function useEffectiveModeOptions(): Record<string, string> {
  const modeOptions = useContext(ModeOptionsContext)
  if (modeOptions === null) {
    throw new Error('useEffectiveModeOptions requires ModeOptionsProvider')
  }
  return modeOptions
}

export function useHasAvailableChatMode(): boolean {
  return hasAvailableChatMode(useEffectiveModeOptions())
}
