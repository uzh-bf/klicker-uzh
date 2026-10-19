'use client'

import type { DictationAdapter } from '@assistant-ui/react'
import { useLocale } from 'next-intl'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  type DictationAvailability,
  type DictationErrorCode,
  installOnDeviceDictation,
  OnDeviceDictationAdapter,
  probeOnDeviceDictation,
} from '../lib/speech/onDeviceDictation'

export interface DictationValue {
  availability: DictationAvailability
  /** Passed to the runtime only once on-device recognition is ready. */
  adapter: DictationAdapter | undefined
  error: DictationErrorCode | null
  clearError: () => void
  install: () => Promise<void>
  refresh: () => Promise<void>
  installSheetOpen: boolean
  setInstallSheetOpen: (open: boolean) => void
}

const DictationContext = createContext<DictationValue | null>(null)

export const DictationProvider = DictationContext.Provider

export function useDictationContext() {
  const context = useContext(DictationContext)
  if (!context) {
    throw new Error('useDictationContext must be used within DictationProvider')
  }
  return context
}

/**
 * Tracks on-device dictation availability for the chat locale. Embedded
 * (LTI/iframe) chats never dictate, so they skip the probe entirely.
 */
export function useOnDeviceDictation({
  disabled,
}: {
  disabled: boolean
}): DictationValue {
  const locale = useLocale()
  const language = locale.toLowerCase().startsWith('de') ? 'de-DE' : 'en-US'
  const [availability, setAvailability] =
    useState<DictationAvailability>('unsupported')
  const [error, setError] = useState<DictationErrorCode | null>(null)
  const [installSheetOpen, setInstallSheetOpen] = useState(false)

  const refresh = useCallback(async () => {
    if (disabled) {
      setAvailability('unsupported')
      return
    }
    try {
      setAvailability(await probeOnDeviceDictation(language))
    } catch {
      setAvailability('unavailable')
    }
  }, [disabled, language])

  const install = useCallback(async () => {
    setError(null)
    setAvailability('installing')
    try {
      if (!(await installOnDeviceDictation(language))) {
        setAvailability('needs-install')
        setError('install-failed')
        return
      }
    } catch {
      setAvailability('needs-install')
      setError('install-failed')
      return
    }
    await refresh()
  }, [language, refresh])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // A download started elsewhere (another tab, or a previous visit) reports
  // `downloading`; keep checking until the language pack settles.
  useEffect(() => {
    if (availability !== 'installing') return
    const interval = window.setInterval(() => void refresh(), 1000)
    return () => window.clearInterval(interval)
  }, [availability, refresh])

  const adapter = useMemo(
    () =>
      availability === 'ready'
        ? new OnDeviceDictationAdapter(language, setError)
        : undefined,
    [availability, language]
  )

  return {
    availability,
    adapter,
    error,
    clearError: () => setError(null),
    install,
    refresh,
    installSheetOpen,
    setInstallSheetOpen,
  }
}
