import { describe, expect, test } from 'vitest'
import {
  createInitialDictationState,
  dictationReducer,
} from '../src/lib/speech/dictation-state'
import { projectDictationDraft } from '../src/lib/speech/dictation-draft'

describe('dictation state reducer', () => {
  test('moves a downloadable capability through installation to ready', () => {
    const downloadable = dictationReducer(createInitialDictationState(), {
      type: 'capability',
      status: 'needs-install',
    })
    const installing = dictationReducer(downloadable, { type: 'install-start' })
    const ready = dictationReducer(installing, {
      type: 'install-result',
      available: true,
    })

    expect(downloadable.status).toBe('needs-install')
    expect(installing.status).toBe('installing')
    expect(ready).toEqual(createInitialDictationState('ready'))
  })

  test('keeps an unavailable capability fail-closed', () => {
    const state = dictationReducer(createInitialDictationState(), {
      type: 'capability',
      status: 'unavailable',
    })

    expect(dictationReducer(state, { type: 'start' })).toBe(state)
    expect(state.status).toBe('unavailable')
  })

  test('keeps a browser-managed language-pack download indeterminate', () => {
    const state = dictationReducer(createInitialDictationState(), {
      type: 'capability',
      status: 'installing',
    })

    expect(state).toMatchObject({
      error: null,
      status: 'installing',
    })
    expect(dictationReducer(state, { type: 'start' })).toBe(state)
  })

  test('keeps interim and final text separate while listening', () => {
    let state = dictationReducer(createInitialDictationState('ready'), {
      type: 'start',
    })
    state = dictationReducer(state, { type: 'interim', text: 'draft phrase' })
    state = dictationReducer(state, { type: 'final', text: 'first phrase' })
    state = dictationReducer(state, { type: 'final', text: 'second phrase' })

    expect(state).toMatchObject({
      finalTranscript: 'first phrase second phrase',
      interimTranscript: '',
      status: 'listening',
    })
  })

  test('returns to ready after an end without a final transcript', () => {
    const listening = dictationReducer(createInitialDictationState('ready'), {
      type: 'start',
    })
    const interim = dictationReducer(listening, {
      type: 'interim',
      text: 'unfinished phrase',
    })
    const ended = dictationReducer(interim, { type: 'end' })

    expect(ended).toMatchObject({
      finalTranscript: '',
      interimTranscript: '',
      status: 'ready',
    })
  })

  test('maps recognition errors to a terminal error state', () => {
    const listening = dictationReducer(createInitialDictationState('ready'), {
      type: 'start',
    })
    const error = dictationReducer(listening, {
      type: 'error',
      error: 'language-not-supported',
    })

    expect(error).toMatchObject({
      error: 'language-not-supported',
      status: 'error',
    })
  })

  test('projects dictation after the captured draft without replacing it', () => {
    expect(
      projectDictationDraft('Existing draft', 'final phrase', 'interim phrase')
    ).toBe('Existing draft final phrase interim phrase')
    expect(projectDictationDraft('Existing draft', '', '')).toBe(
      'Existing draft'
    )
    expect(
      projectDictationDraft('  Existing draft  ', 'final phrase', '')
    ).toBe('  Existing draft  final phrase')
  })
})
