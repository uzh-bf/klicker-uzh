import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { useDefaultLayout } from '@uzh-bf/design-system'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { liveQuizLayoutStorage } from './liveQuizLayoutStorage'

const layoutId = 'live-quiz-synthetic-panels'
const panelIds = ['live-quiz-synthetic-question', 'live-quiz-synthetic-sidebar']

function LayoutProbe({
  preserving,
  onLayout,
}: {
  preserving: boolean
  onLayout?: (layout: unknown) => void
}) {
  const { defaultLayout } = useDefaultLayout({
    id: layoutId,
    panelIds,
    ...(preserving ? { storage: liveQuizLayoutStorage } : {}),
  })
  onLayout?.(defaultLayout)
  return null
}

describe('live quiz layout storage during rendering', () => {
  it('avoids the real default hook failure when browser storage is absent', () => {
    assert.equal(typeof window, 'undefined')
    assert.throws(
      () => renderToString(createElement(LayoutProbe, { preserving: false })),
      ReferenceError
    )
    let layout: unknown = 'not rendered'
    assert.doesNotThrow(() =>
      renderToString(
        createElement(LayoutProbe, {
          preserving: true,
          onLayout: (value) => {
            layout = value
          },
        })
      )
    )
    assert.equal(layout, undefined)
    assert.doesNotThrow(() => liveQuizLayoutStorage.setItem('synthetic', '{}'))
  })

  it('reads saved percentages without writing defaults during a render', () => {
    const saved = { [panelIds[0]]: 65, [panelIds[1]]: 35 }
    const writes: [string, string][] = []
    const reads: string[] = []
    const storage = {
      getItem(key: string) {
        reads.push(key)
        return JSON.stringify(saved)
      },
      setItem(key: string, value: string) {
        writes.push([key, value])
      },
    }
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: storage },
    })
    try {
      let layout: unknown
      renderToString(
        createElement(LayoutProbe, {
          preserving: true,
          onLayout: (value) => {
            layout = value
          },
        })
      )
      assert.deepEqual(layout, saved)
      assert.ok(reads.length > 0)
      assert.equal(
        reads[0],
        `react-resizable-panels:${[layoutId, ...panelIds].join(':')}`
      )
      assert.deepEqual(writes, [])
      liveQuizLayoutStorage.setItem(reads[0], JSON.stringify(saved))
      assert.deepEqual(writes, [[reads[0], JSON.stringify(saved)]])
    } finally {
      Reflect.deleteProperty(globalThis, 'window')
    }
  })

  it('keeps optional persistence from failing when browser storage is restricted', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        get localStorage() {
          throw new Error('Synthetic storage restriction')
        },
      },
    })
    try {
      assert.equal(liveQuizLayoutStorage.getItem('synthetic'), null)
      assert.doesNotThrow(() =>
        liveQuizLayoutStorage.setItem('synthetic', '{}')
      )
      assert.doesNotThrow(() =>
        renderToString(createElement(LayoutProbe, { preserving: true }))
      )
    } finally {
      Reflect.deleteProperty(globalThis, 'window')
    }
  })
})
