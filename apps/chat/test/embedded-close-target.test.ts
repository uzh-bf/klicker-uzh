import { describe, expect, test } from 'vitest'

import { resolveHostTargetOrigin } from '../src/components/embedded-settings'

// The close request leaves the frame, so its target origin is a security
// boundary: a wildcard would let the request reach any page that ever embedded
// the chat. The resolver either names one concrete origin or refuses to send.
describe('resolveHostTargetOrigin', () => {
  test('prefers the parent origin proven by an accepted context update', () => {
    expect(
      resolveHostTargetOrigin(
        'https://elearning.example.org',
        'https://other.example.org/x'
      )
    ).toBe('https://elearning.example.org')
  })

  test('falls back to the embedding page origin from the referrer', () => {
    expect(
      resolveHostTargetOrigin(null, 'https://elearning.example.org/de/course/1')
    ).toBe('https://elearning.example.org')
  })

  test('never resolves to a wildcard or a path-bearing target', () => {
    expect(resolveHostTargetOrigin(null, '')).toBeNull()
    expect(resolveHostTargetOrigin(null, 'not a url')).toBeNull()
    // An opaque origin has no usable target; sending to "null" would throw.
    expect(resolveHostTargetOrigin(null, 'about:blank')).toBeNull()
    expect(resolveHostTargetOrigin(null, 'data:text/html,<p>x</p>')).toBeNull()
  })
})
