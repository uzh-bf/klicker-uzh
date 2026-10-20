import type { SpeechSynthesisAdapter } from '@assistant-ui/react'
import { useEffect, useMemo, useState } from 'react'
import { toSpeakableText } from './readAloudText'

// Read-aloud uses on-device voices only. Chrome also lists network voices
// ("Google Deutsch", ...) that send the text to Google, so a voice is chosen
// explicitly from `localService` voices, and without one the runtime gets no
// speech adapter and the button stays hidden.
export function pickLocalVoice(
  voices: readonly SpeechSynthesisVoice[],
  locale: string
): SpeechSynthesisVoice | null {
  const matching = voices.filter(
    (voice) =>
      voice.localService &&
      voice.lang.toLowerCase().replace('_', '-').split('-')[0] === locale
  )
  return matching.find((voice) => voice.default) ?? matching[0] ?? null
}

// Mirrors assistant-ui's `WebSpeechSynthesisAdapter`, which creates and queues
// its utterance in one step and so leaves no way to set the voice. This
// version cleans the Markdown first and pins the chosen local voice.
export class LocalSpeechSynthesisAdapter implements SpeechSynthesisAdapter {
  constructor(
    private readonly voice: SpeechSynthesisVoice,
    private readonly formulaLabel: string
  ) {}

  speak(text: string): SpeechSynthesisAdapter.Utterance {
    const utterance = new SpeechSynthesisUtterance(
      toSpeakableText(text, { formulaLabel: this.formulaLabel })
    )
    utterance.voice = this.voice
    utterance.lang = this.voice.lang

    const subscribers = new Set<() => void>()
    const handleEnd = (
      reason: 'finished' | 'cancelled' | 'error',
      error?: unknown
    ) => {
      if (result.status.type === 'ended') return
      result.status = { type: 'ended', reason, error }
      for (const callback of subscribers) callback()
    }
    utterance.addEventListener('end', () => handleEnd('finished'))
    utterance.addEventListener('error', (event) =>
      handleEnd('error', event.error)
    )

    const result: SpeechSynthesisAdapter.Utterance = {
      status: { type: 'running' },
      cancel: () => {
        window.speechSynthesis.cancel()
        handleEnd('cancelled')
      },
      subscribe: (callback) => {
        if (result.status.type === 'ended') {
          let unsubscribed = false
          queueMicrotask(() => {
            if (!unsubscribed) callback()
          })
          return () => {
            unsubscribed = true
          }
        }
        subscribers.add(callback)
        return () => {
          subscribers.delete(callback)
        }
      },
    }

    window.speechSynthesis.speak(utterance)
    return result
  }
}

export function useLocalSpeechSynthesis({
  locale,
  formulaLabel,
  disabled,
}: {
  locale: string
  formulaLabel: string
  disabled: boolean
}): SpeechSynthesisAdapter | undefined {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null)

  useEffect(() => {
    if (disabled || typeof window === 'undefined' || !window.speechSynthesis) {
      setVoice(null)
      return
    }
    const synth = window.speechSynthesis
    // Browsers load the voice list asynchronously and may refresh it later.
    const update = () => {
      const next = pickLocalVoice(synth.getVoices(), locale)
      setVoice((current) =>
        current?.voiceURI === next?.voiceURI ? current : next
      )
    }
    update()
    synth.addEventListener('voiceschanged', update)
    return () => synth.removeEventListener('voiceschanged', update)
  }, [disabled, locale])

  return useMemo(
    () =>
      voice ? new LocalSpeechSynthesisAdapter(voice, formulaLabel) : undefined,
    [voice, formulaLabel]
  )
}
