import type { DictationAdapter } from '@assistant-ui/react'

// Chat dictation is on-device only: every recognition session sets
// `processLocally`, and the probe below admits only browsers that report a
// local language pack. Audio never reaches a cloud recognizer or the chat
// service, and there is no fallback that would change that.

export type OnDeviceAvailability =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'

export type DictationAvailability =
  | 'unsupported'
  | 'unavailable'
  | 'needs-install'
  | 'installing'
  | 'ready'

export type DictationErrorCode =
  | 'aborted'
  | 'audio-capture'
  | 'install-failed'
  | 'language-not-supported'
  | 'network'
  | 'no-speech'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'unknown'

interface LocalSpeechRecognitionEvent extends Event {
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

interface LocalSpeechRecognitionErrorEvent extends Event {
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
  }) => Promise<OnDeviceAvailability | boolean> | OnDeviceAvailability | boolean
  install?: (options: {
    langs: string[]
    quality: 'dictation'
  }) => Promise<boolean> | boolean
}

const MOBILE_USER_AGENT =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i

export function getSpeechRecognitionConstructor(): LocalSpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const speechWindow = window as {
    SpeechRecognition?: LocalSpeechRecognitionConstructor
    webkitSpeechRecognition?: LocalSpeechRecognitionConstructor
  }
  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  )
}

function isMobileBrowser(): boolean {
  const speechNavigator = navigator as Navigator & {
    userAgentData?: { mobile?: boolean }
  }
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

/**
 * Resolves whether this browser can dictate `language` on the device. Mobile
 * browsers are excluded because their on-device contract is unproven.
 */
export async function probeOnDeviceDictation(
  language: string
): Promise<DictationAvailability> {
  if (typeof navigator === 'undefined' || isMobileBrowser()) {
    return 'unsupported'
  }
  const Recognition = getSpeechRecognitionConstructor()
  if (!Recognition) return 'unsupported'

  // Calling the on-device availability probe terminates the whole renderer
  // in headless Chromium builds that ship the JS interface without the media
  // service binder (bad Mojo message, IPC reason 123). Under automation the
  // probe therefore runs only when an E2E polyfill installed its own
  // constructor and set the `window.__dictationFake` marker; real browsers
  // never set `webdriver` and always probe.
  if (navigator.webdriver === true && !('__dictationFake' in window)) {
    return 'unsupported'
  }
  if (!Recognition.available) return 'unavailable'

  const availability = await Recognition.available({
    langs: [language],
    processLocally: true,
    quality: 'dictation',
  })
  if (availability === true || availability === 'available') return 'ready'
  if (availability === 'downloadable') return 'needs-install'
  if (availability === 'downloading') return 'installing'
  return 'unavailable'
}

export async function installOnDeviceDictation(
  language: string
): Promise<boolean> {
  const Recognition = getSpeechRecognitionConstructor()
  if (!Recognition?.install) return false
  return await Recognition.install({
    langs: [language],
    quality: 'dictation',
  })
}

type Result = DictationAdapter.Result

/**
 * assistant-ui dictation adapter over the browser's on-device recognizer.
 * The composer runtime owns draft merging, interim text, and cancelling the
 * session on send; this adapter only translates recognizer events.
 */
export class OnDeviceDictationAdapter implements DictationAdapter {
  // The runtime writes interim text into the input, so typing at the same
  // time would be overwritten by the next recognition result.
  disableInputDuringDictation = true

  constructor(
    private readonly language: string,
    private readonly onError: (error: DictationErrorCode) => void
  ) {}

  listen(): DictationAdapter.Session {
    const Recognition = getSpeechRecognitionConstructor()
    if (!Recognition) throw new Error('Speech recognition is unavailable')

    const recognition = new Recognition()
    recognition.lang = this.language
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.processLocally = true

    const startListeners = new Set<() => void>()
    const endListeners = new Set<(result: Result) => void>()
    const speechListeners = new Set<(result: Result) => void>()
    let finalTranscript = ''
    let cancelled = false
    let resolveEnded: () => void = () => {}
    const ended = new Promise<void>((resolve) => {
      resolveEnded = resolve
    })

    const subscribe =
      <T>(listeners: Set<T>) =>
      (callback: T) => {
        listeners.add(callback)
        return () => {
          listeners.delete(callback)
        }
      }

    const session: DictationAdapter.Session = {
      status: { type: 'starting' },
      stop: () => {
        if (session.status.type !== 'ended') recognition.stop()
        return ended
      },
      cancel: () => {
        if (session.status.type === 'ended') return
        cancelled = true
        recognition.abort()
      },
      onSpeechStart: subscribe(startListeners),
      onSpeechEnd: subscribe(endListeners),
      onSpeech: subscribe(speechListeners),
    }

    const end = (reason: 'stopped' | 'cancelled' | 'error') => {
      if (session.status.type === 'ended') return
      session.status = { type: 'ended', reason }
      for (const listener of endListeners)
        listener({ transcript: finalTranscript })
      resolveEnded()
    }

    recognition.onstart = () => {
      if (session.status.type !== 'starting') return
      session.status = { type: 'running' }
      for (const listener of startListeners) listener()
    }
    recognition.onresult = (event) => {
      for (
        let index = event.resultIndex ?? 0;
        index < event.results.length;
        index++
      ) {
        const result = event.results[index]
        if (!result) continue
        const transcript = (result[0]?.transcript ?? '').trim()
        if (!transcript) continue
        if (result.isFinal) {
          finalTranscript = finalTranscript
            ? `${finalTranscript} ${transcript}`
            : transcript
        }
        for (const listener of speechListeners) {
          listener({ transcript, isFinal: result.isFinal })
        }
      }
    }
    recognition.onerror = (event) => {
      const error = mapRecognitionError(event.error)
      // An abort the user asked for is not a failure worth reporting.
      if (!(cancelled && error === 'aborted')) this.onError(error)
      end(cancelled ? 'cancelled' : 'error')
    }
    recognition.onend = () => end(cancelled ? 'cancelled' : 'stopped')

    try {
      recognition.start()
    } catch {
      this.onError('unknown')
      end('error')
    }
    return session
  }
}
