'use client'

import { useAui, useAuiEvent, useAuiState } from '@assistant-ui/react'
import { useParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { projectDictationDraft } from '../lib/speech/dictation-draft'
import {
  appendTranscript,
  createInitialDictationState,
  type DictationErrorCode,
  type DictationState,
  type DictationStatus,
  dictationReducer,
} from '../lib/speech/dictation-state'

export type LocalSpeechAvailability =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'

export interface LocalSpeechRecognitionEvent extends Event {
  resultIndex?: number
  results: {
    length: number
    [index: number]: {
      isFinal: boolean
      length: number
      [index: number]: { transcript: string }
    }
  }
}

export interface LocalSpeechRecognitionErrorEvent extends Event {
  error: string
}

export interface LocalSpeechRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  processLocally: boolean
  onend: (() => void) | null
  onerror: ((event: LocalSpeechRecognitionErrorEvent) => void) | null
  onresult: ((event: LocalSpeechRecognitionEvent) => void) | null
  onstart: (() => void) | null
  abort: () => void
  start: () => void
  stop: () => void
}

export interface LocalSpeechRecognitionConstructor {
  new (): LocalSpeechRecognition
  available?: (options: {
    langs: string[]
    processLocally: true
    quality: 'dictation'
  }) =>
    | Promise<LocalSpeechAvailability | boolean>
    | LocalSpeechAvailability
    | boolean
  install?: (options: {
    langs: string[]
    quality: 'dictation'
  }) => Promise<boolean> | boolean
}

interface SpeechWindow {
  SpeechRecognition?: LocalSpeechRecognitionConstructor
  webkitSpeechRecognition?: LocalSpeechRecognitionConstructor
}

interface SpeechNavigator extends Navigator {
  userAgentData?: { mobile?: boolean }
}

export interface DictationCapability {
  language: string
  mobile: boolean
  status: DictationStatus
}

export interface DictationValue extends DictationCapability {
  state: DictationState
  cancelDictation: () => void
  clearError: () => void
  closeInstallSheet: () => void
  installDictation: () => Promise<boolean>
  installSheetOpen: boolean
  openInstallSheet: () => void
  refreshCapability: () => Promise<void>
  startDictation: () => boolean
  stopDictation: () => void
}

const MOBILE_USER_AGENT =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i

export function getSpeechRecognitionConstructor(): LocalSpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const speechWindow = window as SpeechWindow
  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  )
}

export function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const speechNavigator = navigator as SpeechNavigator
  if (speechNavigator.userAgentData?.mobile === true) return true
  if (MOBILE_USER_AGENT.test(navigator.userAgent)) return true
  return /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1
}

export function mapRecognitionError(error: string): DictationErrorCode {
  switch (error) {
    case 'aborted':
    case 'audio-capture':
    case 'language-not-supported':
    case 'network':
    case 'no-speech':
    case 'not-allowed':
    case 'service-not-allowed':
      return error
    default:
      return 'unknown'
  }
}

function statusForAvailability(
  availability: LocalSpeechAvailability | boolean
): Extract<
  DictationStatus,
  'ready' | 'needs-install' | 'installing' | 'unavailable'
> {
  if (availability === true || availability === 'available') return 'ready'
  if (availability === 'downloadable') return 'needs-install'
  if (availability === 'downloading') return 'installing'
  return 'unavailable'
}

export function useDictation(): DictationValue {
  const locale = useLocale()
  const { threadId } = useParams<{ threadId?: string }>()
  const language = locale.toLowerCase().startsWith('de') ? 'de-DE' : 'en-US'
  const aui = useAui()
  const composerText = useAuiState((state) => state.composer.text)
  const [state, dispatch] = useReducer(
    dictationReducer,
    createInitialDictationState()
  )
  const [mobile, setMobile] = useState(false)
  const [installSheetOpen, setInstallSheetOpen] = useState(false)
  const stateRef = useRef(state)
  const recognitionRef = useRef<LocalSpeechRecognition | null>(null)
  const capturedDraftRef = useRef<string | null>(null)
  // Set when the user sends while a recognition session is still active:
  // assistant-ui has already cleared the composer, so any later projection
  // of this session's transcript would resurrect text the user sent.
  const discardProjectionRef = useRef(false)
  const activeThreadRef = useRef(threadId)
  const transcriptRef = useRef({ finalTranscript: '', interimTranscript: '' })

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const refreshCapability = useCallback(async () => {
    const mobileBrowser = isMobileBrowser()
    setMobile(mobileBrowser)

    if (mobileBrowser) {
      dispatch({ type: 'capability', status: 'unsupported' })
      return
    }

    const constructor = getSpeechRecognitionConstructor()
    if (!constructor) {
      dispatch({ type: 'capability', status: 'unsupported' })
      return
    }

    // Calling the on-device availability probe below terminates the whole
    // renderer in headless Chromium builds that ship the JS interface
    // without the media service binder (bad Mojo message, IPC reason 123),
    // so a browser-provided recognition object is never probed under
    // automation (navigator.webdriver); test polyfills are exempt because
    // they own their availability answer. Real browsers keep the probe.
    if (navigator.webdriver === true && !constructor.available) {
      dispatch({ type: 'capability', status: 'unsupported' })
      return
    }

    if (!constructor.available) {
      dispatch({ type: 'capability', status: 'unavailable' })
      return
    }

    try {
      const availability = await constructor.available({
        langs: [language],
        processLocally: true,
        quality: 'dictation',
      })
      dispatch({
        type: 'capability',
        status: statusForAvailability(availability),
      })
    } catch {
      dispatch({ type: 'error', error: 'availability-check-failed' })
    }
  }, [language])

  const installDictation = useCallback(async () => {
    const canInstall =
      stateRef.current.status === 'needs-install' ||
      (stateRef.current.status === 'error' &&
        stateRef.current.error === 'install-failed')
    if (!canInstall) return false

    const constructor = getSpeechRecognitionConstructor()
    if (!constructor?.install) {
      dispatch({ type: 'error', error: 'install-failed' })
      return false
    }

    dispatch({ type: 'install-start' })
    try {
      const installed = await constructor.install({
        langs: [language],
        quality: 'dictation',
      })
      if (!installed) {
        dispatch({ type: 'install-result', available: false })
        return false
      }

      await refreshCapability()
      return true
    } catch {
      dispatch({ type: 'error', error: 'install-failed' })
      return false
    }
  }, [language, refreshCapability])

  const restoreCapturedDraft = useCallback(() => {
    discardProjectionRef.current = false
    const capturedDraft = capturedDraftRef.current
    if (capturedDraft === null) return
    aui.composer.setText(capturedDraft)
    capturedDraftRef.current = null
  }, [aui])

  const startDictation = useCallback(() => {
    if (stateRef.current.status !== 'ready') return false

    // A fresh session owns the composer again; without this reset a send
    // from an earlier session would suppress its final projection forever.
    discardProjectionRef.current = false

    const constructor = getSpeechRecognitionConstructor()
    if (!constructor) {
      dispatch({ type: 'capability', status: 'unsupported' })
      return false
    }

    const recognition = new constructor()
    capturedDraftRef.current = composerText
    transcriptRef.current = { finalTranscript: '', interimTranscript: '' }
    recognition.lang = language
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.processLocally = true
    recognition.onstart = () => {
      if (recognitionRef.current !== recognition) return
      dispatch({ type: 'start' })
    }
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return
      const firstResultIndex = event.resultIndex ?? 0
      for (
        let index = firstResultIndex;
        index < event.results.length;
        index++
      ) {
        const result = event.results[index]
        if (!result) continue
        const transcript = Array.from({ length: result.length })
          .map(
            (_, alternativeIndex) => result[alternativeIndex]?.transcript ?? ''
          )
          .join(' ')
        transcriptRef.current = result.isFinal
          ? {
              finalTranscript: appendTranscript(
                transcriptRef.current.finalTranscript,
                transcript
              ),
              interimTranscript: '',
            }
          : {
              ...transcriptRef.current,
              interimTranscript: transcript,
            }
        dispatch({
          type: result.isFinal ? 'final' : 'interim',
          text: transcript,
        })
      }
    }
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return
      restoreCapturedDraft()
      transcriptRef.current = { finalTranscript: '', interimTranscript: '' }
      dispatch({ type: 'error', error: mapRecognitionError(event.error) })
    }
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return
      const capturedDraft = capturedDraftRef.current
      // A send that raced this end event already cleared the composer via
      // the runtime; projecting now would resurrect text the user sent.
      if (capturedDraft !== null && !discardProjectionRef.current) {
        aui.composer.setText(
          projectDictationDraft(
            capturedDraft,
            transcriptRef.current.finalTranscript,
            transcriptRef.current.interimTranscript
          )
        )
      }
      recognitionRef.current = null
      capturedDraftRef.current = null
      transcriptRef.current = { finalTranscript: '', interimTranscript: '' }
      dispatch({ type: 'end' })
    }

    // This is intentionally synchronous and immediately precedes recognition
    // start so local read-aloud never overlaps the microphone session.
    window.speechSynthesis?.cancel()
    recognitionRef.current = recognition
    dispatch({ type: 'start' })
    try {
      recognition.start()
      return true
    } catch {
      recognitionRef.current = null
      restoreCapturedDraft()
      transcriptRef.current = { finalTranscript: '', interimTranscript: '' }
      dispatch({ type: 'error', error: 'unknown' })
      return false
    }
  }, [aui, composerText, language, restoreCapturedDraft])

  const stopDictation = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  // A send while listening clears the composer via the runtime; drop this
  // session's projection so its end event cannot resurrect sent text.
  useAuiEvent('composer.send', () => {
    if (recognitionRef.current === null) return
    discardProjectionRef.current = true
    capturedDraftRef.current = null
    transcriptRef.current = { finalTranscript: '', interimTranscript: '' }
  })

  const cancelDictation = useCallback(() => {
    recognitionRef.current?.abort()
    recognitionRef.current = null
    restoreCapturedDraft()
    transcriptRef.current = { finalTranscript: '', interimTranscript: '' }
    dispatch({ type: 'error', error: 'aborted' })
  }, [restoreCapturedDraft])

  useEffect(() => {
    if (state.status !== 'listening') return
    const capturedDraft = capturedDraftRef.current
    if (capturedDraft === null) return
    if (discardProjectionRef.current) return
    aui.composer.setText(
      projectDictationDraft(
        capturedDraft,
        state.finalTranscript,
        state.interimTranscript
      )
    )
  }, [aui, state.finalTranscript, state.interimTranscript, state.status])

  useEffect(() => {
    void refreshCapability()
  }, [refreshCapability])

  useEffect(() => {
    if (activeThreadRef.current === threadId) return

    activeThreadRef.current = threadId
    discardProjectionRef.current = false
    const recognition = recognitionRef.current
    recognitionRef.current = null
    capturedDraftRef.current = null
    transcriptRef.current = { finalTranscript: '', interimTranscript: '' }
    recognition?.abort()
    // The composer text survives a runtime thread switch, so an in-flight
    // dictation would otherwise leak the old draft into the new thread.
    void aui.composer.reset()
    dispatch({ type: 'reset' })
    void refreshCapability()
  }, [aui, refreshCapability, threadId])

  useEffect(() => {
    if (state.status !== 'installing') return
    const interval = window.setInterval(() => {
      void refreshCapability()
    }, 1000)
    return () => window.clearInterval(interval)
  }, [refreshCapability, state.status])

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current
      recognitionRef.current = null
      discardProjectionRef.current = false
      capturedDraftRef.current = null
      transcriptRef.current = { finalTranscript: '', interimTranscript: '' }
      recognition?.abort()
    }
  }, [])

  return {
    language,
    mobile,
    cancelDictation,
    clearError: () => {
      void refreshCapability()
    },
    closeInstallSheet: () => setInstallSheetOpen(false),
    installDictation,
    installSheetOpen,
    openInstallSheet: () => setInstallSheetOpen(true),
    refreshCapability,
    state,
    startDictation,
    status: state.status,
    stopDictation,
  }
}
