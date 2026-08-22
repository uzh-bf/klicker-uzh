'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useDictation, type DictationValue } from '../hooks/useDictation'

const DictationContext = createContext<DictationValue | null>(null)

export function DictationProvider({ children }: { children: ReactNode }) {
  const value = useDictation()
  return (
    <DictationContext.Provider value={value}>
      {children}
    </DictationContext.Provider>
  )
}

export function useDictationContext() {
  const context = useContext(DictationContext)
  if (!context) {
    throw new Error('useDictationContext must be used within DictationProvider')
  }
  return context
}
