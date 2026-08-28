import { describe, expect, it } from 'vitest'

describe('package subpath exports', () => {
  it('loads the auth helpers through the public package path', async () => {
    const auth = await import('@klicker-uzh/util/auth')

    expect(auth.extractBearerToken('Bearer package-export')).toBe(
      'package-export'
    )
  })

  it('loads the client auth helpers through the public package path', async () => {
    const clientAuth = await import('@klicker-uzh/util/client-auth')

    expect(clientAuth.getStoredAuthToken('missing')).toBeNull()
  })

  it('loads citation helpers through the public package path', async () => {
    const citations = await import('@klicker-uzh/util/citations')

    expect(citations.extractCitationIndexes('Grounded [1].')).toEqual([1])
  })

  it('loads response-example digest helpers through the public package path', async () => {
    const digest = await import('@klicker-uzh/util/response-example-digest')

    expect(digest.computeResponseExampleSetDigest).toBeTypeOf('function')
  })

  it('loads response-example eligibility helpers through the public package path', async () => {
    const eligibility = await import(
      '@klicker-uzh/util/response-example-eligibility'
    )

    expect(eligibility.evaluateResponseExampleCurrentEligibility).toBeTypeOf(
      'function'
    )
  })
})
