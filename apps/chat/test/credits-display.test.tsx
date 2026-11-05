import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Rendered to static markup in the node environment (see
// embedded-settings.test.tsx); the zustand store is replaced by a plain state
// object so each test controls the balance the components read.
const mocks = vi.hoisted(() => ({
  settings: {
    credits: { current: 3, total: 3, nextResetAt: null as string | null },
    creditsLoaded: true,
    modeOptions: {} as Record<string, string>,
  },
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => 'date' }),
}))

vi.mock('../src/components/chat-ui-context', () => ({
  useChatUi: () => ({ showMinimalSettings: true }),
}))

vi.mock('../src/stores/settingsStore', () => ({
  useSettingsStore: (selector: (state: typeof mocks.settings) => unknown) =>
    selector(mocks.settings),
}))

import {
  CreditsFooter,
  MobileCreditsBar,
} from '../src/components/credits-footer'
import { EmbeddedCreditsBar } from '../src/components/embedded-settings'

function display(markup: string, dataCy: string) {
  const match = markup.match(
    new RegExp(`data-cy="${dataCy}"[^>]*>([^<]*(?:<!-- -->[^<]*)*)<`)
  )
  return match?.[1].replaceAll('<!-- -->', '').trim()
}

const views = [
  {
    name: 'sidebar footer',
    Component: CreditsFooter,
    cy: 'chat-credits-display',
  },
  {
    name: 'mobile bar',
    Component: MobileCreditsBar,
    cy: 'chat-mobile-credits-display',
  },
  {
    name: 'embedded bar',
    Component: EmbeddedCreditsBar,
    cy: 'chat-embedded-credits-display',
  },
]

describe('credits balance display', () => {
  beforeEach(() => {
    mocks.settings.credits = { current: 3, total: 3, nextResetAt: null }
    mocks.settings.creditsLoaded = true
  })

  for (const { name, Component, cy } of views) {
    test(`${name} shows the fractional balance after a message`, () => {
      const render = () => renderToStaticMarkup(React.createElement(Component))

      expect(display(render(), cy)).toBe('3 / 3')

      // a refreshed balance after a 0.02-credit message
      mocks.settings.credits = { current: 2.98, total: 3, nextResetAt: null }
      expect(display(render(), cy)).toBe('2.98 / 3')

      // a BASE-model message costs about 0.0005 and must still move it
      mocks.settings.credits = { current: 2.97945, total: 3, nextResetAt: null }
      expect(display(render(), cy)).toBe('2.9794 / 3')
    })
  }

  test('the progress bar follows the fractional balance', () => {
    mocks.settings.credits = { current: 1.5, total: 3, nextResetAt: null }
    const markup = renderToStaticMarkup(React.createElement(CreditsFooter))
    // The indicator width animates in after mount, so server markup carries
    // the value through the progressbar's ARIA attributes.
    expect(markup).toContain('aria-valuenow="50"')
    expect(markup).not.toContain('min-w-[40px]')

    mocks.settings.credits = { current: 2.98, total: 3, nextResetAt: null }
    const afterMessage = renderToStaticMarkup(
      React.createElement(CreditsFooter)
    )
    expect(afterMessage).toMatch(/aria-valuenow="99\.33/)
  })

  test('keeps the refill and exhausted copy', () => {
    mocks.settings.credits = {
      current: 0,
      total: 3,
      nextResetAt: '2026-11-10T00:00:00.000Z',
    }
    const markup = renderToStaticMarkup(React.createElement(CreditsFooter))
    expect(markup).toContain('chat.credits.resetAt')
    expect(markup).toContain('data-cy="chat-credits-empty-message"')
    expect(display(markup, 'chat-credits-display')).toBe('0 / 3')
  })
})
