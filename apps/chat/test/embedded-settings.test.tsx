import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// The chat suite runs in the node environment without jsdom, so the compact
// header is rendered to static markup with translation keys as labels.
// Server rendering reads a zustand store's initial state, so the store is
// replaced by a plain state object the tests control.
const mocks = vi.hoisted(() => ({
  showMinimalSettings: true,
  settings: {
    modeOptions: {} as Record<string, string>,
    selectedMode: 'tutor',
    setSelectedMode: () => {},
    answerStyle: 'balanced',
    setAnswerStyle: () => {},
    answerTone: 'neutral',
    setAnswerTone: () => {},
    answerPreferencesEnabled: true,
  },
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ chatbotId: 'synthetic-chatbot' }),
  useSearchParams: () => new URLSearchParams('embed=true'),
}))

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}))

vi.mock('../src/components/chat-ui-context', () => ({
  useChatUi: () => ({ showMinimalSettings: mocks.showMinimalSettings }),
}))

vi.mock('../src/stores/settingsStore', () => ({
  useSettingsStore: () => mocks.settings,
}))

import { EmbeddedSettings } from '../src/components/embedded-settings'

function render() {
  return renderToStaticMarkup(React.createElement(EmbeddedSettings))
}

describe('EmbeddedSettings', () => {
  beforeEach(() => {
    mocks.showMinimalSettings = true
    mocks.settings.modeOptions = { tutor: 'Tutor' }
    mocks.settings.answerStyle = 'bullets'
    mocks.settings.answerTone = 'direct'
    mocks.settings.answerPreferencesEnabled = true
  })

  test('renders the answer-style select even when only one mode exists', () => {
    const markup = render()

    expect(markup).toContain('aria-label="chat.settingsPanel.answerStyleLabel"')
    expect(markup).not.toContain('aria-label="chat.modes.switcherLabel"')
    for (const style of ['balanced', 'bullets']) {
      expect(markup).toContain(`value="${style}"`)
    }
    expect(markup).toMatch(/<option value="bullets" selected="">/)
  })

  test('renders the mode select next to them when several modes exist', () => {
    mocks.settings.modeOptions = { tutor: 'Tutor', explainer: 'Explainer' }

    const markup = render()

    expect(markup).toContain('aria-label="chat.modes.switcherLabel"')
    expect(markup).toContain('aria-label="chat.settingsPanel.answerStyleLabel"')
  })

  test('hides the answer selects when the chatbot turns them off', () => {
    mocks.settings.answerPreferencesEnabled = false
    expect(render()).toBe('')

    mocks.settings.modeOptions = { tutor: 'Tutor', explainer: 'Explainer' }
    const markup = render()
    expect(markup).toContain('aria-label="chat.modes.switcherLabel"')
    expect(markup).not.toContain(
      'aria-label="chat.settingsPanel.answerStyleLabel"'
    )
    expect(markup).not.toContain(
      'aria-label="chat.settingsPanel.answerToneLabel"'
    )
  })

  test('renders nothing outside the minimal embedded header', () => {
    mocks.showMinimalSettings = false

    expect(render()).toBe('')
  })
})
