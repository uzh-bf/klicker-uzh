import { CODE_JSON_MAX_NODES, isCodeJsonValue } from '@klicker-uzh/types'
import { describe, expect, it } from 'vitest'

describe('CODE JSON value bounds', () => {
  it('rejects an over-wide array before reading its items', () => {
    let itemReads = 0
    const value = new Proxy(Array(CODE_JSON_MAX_NODES).fill(null), {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^\d+$/.test(property)) {
          itemReads += 1
        }
        return Reflect.get(target, property, receiver)
      },
    })

    expect(isCodeJsonValue(value)).toBe(false)
    expect(itemReads).toBe(0)
  })

  it('stops reading an over-wide object at the node limit', () => {
    let itemReads = 0
    const value = Object.fromEntries(
      Array.from({ length: CODE_JSON_MAX_NODES + 100 }, (_, index) => [
        `key-${index}`,
        null,
      ])
    )
    const trackedValue = new Proxy(value, {
      get(target, property, receiver) {
        if (typeof property === 'string' && property.startsWith('key-')) {
          itemReads += 1
        }
        return Reflect.get(target, property, receiver)
      },
    })

    expect(isCodeJsonValue(trackedValue)).toBe(false)
    expect(itemReads).toBeLessThanOrEqual(CODE_JSON_MAX_NODES)
  })
})
