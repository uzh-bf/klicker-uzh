import { describe, expect, it, vi } from 'vitest'
import {
  type DictationErrorCode,
  type LocalSpeechRecognition,
  OnDeviceDictationAdapter,
} from '../src/lib/speech/onDeviceDictation'

type Results = Array<{ transcript: string; isFinal: boolean }>

function installFakeRecognition() {
  const instances: FakeRecognition[] = []
  class FakeRecognition implements LocalSpeechRecognition {
    continuous = true
    interimResults = false
    lang = ''
    maxAlternatives = 0
    processLocally = false
    onend: (() => void) | null = null
    onerror: ((event: Event & { error: string }) => void) | null = null
    onresult: LocalSpeechRecognition['onresult'] = null
    onstart: (() => void) | null = null
    start = vi.fn(() => this.onstart?.())
    stop = vi.fn(() => this.onend?.())
    abort = vi.fn(() => {
      this.onerror?.(Object.assign(new Event('error'), { error: 'aborted' }))
      this.onend?.()
    })
    constructor() {
      instances.push(this)
    }
    emit(results: Results) {
      const list = Object.assign(
        results.map((r) =>
          Object.assign([{ transcript: r.transcript }], { isFinal: r.isFinal })
        ),
        { length: results.length }
      )
      this.onresult?.(
        Object.assign(new Event('result'), { resultIndex: 0, results: list })
      )
    }
  }
  vi.stubGlobal('window', { SpeechRecognition: FakeRecognition })
  return instances
}

function listen() {
  const errors: DictationErrorCode[] = []
  const adapter = new OnDeviceDictationAdapter('de-DE', (error) =>
    errors.push(error)
  )
  const session = adapter.listen()
  const speech: Array<{ transcript: string; isFinal?: boolean }> = []
  const ends: string[] = []
  session.onSpeech((result) => speech.push(result))
  session.onSpeechEnd((result) => ends.push(result.transcript))
  return { adapter, session, errors, speech, ends }
}

describe('OnDeviceDictationAdapter', () => {
  it('only ever starts on-device recognition', () => {
    const instances = installFakeRecognition()
    const { adapter, session } = listen()

    expect(instances).toHaveLength(1)
    expect(instances[0]?.processLocally).toBe(true)
    expect(instances[0]?.lang).toBe('de-DE')
    expect(adapter.disableInputDuringDictation).toBe(true)
    expect(session.status).toEqual({ type: 'running' })
  })

  it('forwards interim and final results and ends with the final text', async () => {
    const instances = installFakeRecognition()
    const { session, speech, ends } = listen()

    instances[0]?.emit([{ transcript: ' Hallo ', isFinal: false }])
    instances[0]?.emit([{ transcript: 'Hallo Welt', isFinal: true }])
    await session.stop()

    expect(speech).toEqual([
      { transcript: 'Hallo', isFinal: false },
      { transcript: 'Hallo Welt', isFinal: true },
    ])
    expect(ends).toEqual(['Hallo Welt'])
    expect(session.status).toEqual({ type: 'ended', reason: 'stopped' })
  })

  it('reports recognizer failures but not a requested cancel', () => {
    const instances = installFakeRecognition()
    const first = listen()
    instances[0]?.onerror?.(
      Object.assign(new Event('error'), { error: 'not-allowed' })
    )
    expect(first.errors).toEqual(['not-allowed'])
    expect(first.session.status).toEqual({ type: 'ended', reason: 'error' })

    const second = listen()
    second.session.cancel()
    expect(second.errors).toEqual([])
    expect(second.session.status).toEqual({
      type: 'ended',
      reason: 'cancelled',
    })
  })
})
