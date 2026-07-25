import { describe, expect, test } from 'vitest'
import { resolveDisclosureOpen } from '../src/components/message-parts-state'

describe('message part disclosure state', () => {
  test('auto-opens only while active until the participant chooses a state', () => {
    expect(resolveDisclosureOpen(null, true, true)).toBe(true)
    expect(resolveDisclosureOpen(null, true, false)).toBe(false)
    expect(resolveDisclosureOpen(false, true, true)).toBe(false)
    expect(resolveDisclosureOpen(true, true, false)).toBe(true)
  })

  test('keeps non-auto-opening groups closed until manually opened', () => {
    expect(resolveDisclosureOpen(null, false, true)).toBe(false)
    expect(resolveDisclosureOpen(true, false, false)).toBe(true)
  })
})
