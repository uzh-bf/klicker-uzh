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
})
