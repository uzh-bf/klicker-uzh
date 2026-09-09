'use client'

import { hasAvailableChatMode } from '@/src/lib/config/modes'
import { createContext, type PropsWithChildren, useContext } from 'react'

const ModeOptionsContext = createContext<Record<string, string> | null>(null)

const WritingCoachCustomContext = createContext(false)

export function useWritingCoachIsCustom(): boolean {
  return useContext(WritingCoachCustomContext)
}

export function ModeOptionsProvider({
  children,
  modeOptions,
  writingCoachIsCustom = false,
}: PropsWithChildren<{
  modeOptions: Record<string, string>
  writingCoachIsCustom?: boolean
}>) {
  return (
    <ModeOptionsContext.Provider value={modeOptions}>
      <WritingCoachCustomContext.Provider value={writingCoachIsCustom}>
        {children}
      </WritingCoachCustomContext.Provider>
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
