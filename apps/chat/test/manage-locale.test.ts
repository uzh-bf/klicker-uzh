import { NextRequest } from 'next/server'
import { describe, expect, test } from 'vitest'

import { proxy } from '../src/proxy'

function createRequest(pathname: string) {
  return new NextRequest(new URL(pathname, 'https://chat.test'))
}

describe('embedded Manage locale', () => {
  test('promotes a valid German query locale to the next request', async () => {
    const request = createRequest('/manage?embed=true&locale=de')

    await proxy(request)

    expect(request.cookies.get('NEXT_LOCALE')).toEqual({
      name: 'NEXT_LOCALE',
      value: 'de',
    })
  })

  test('sets the valid locale cookie on the response', async () => {
    const request = createRequest('/manage?embed=true&locale=en')

    const response = await proxy(request)

    expect(request.cookies.get('NEXT_LOCALE')).toEqual({
      name: 'NEXT_LOCALE',
      value: 'en',
    })
    expect(request.headers.get('cookie')).toContain('NEXT_LOCALE=en')
    expect(response.cookies.get('NEXT_LOCALE')).toEqual({
      name: 'NEXT_LOCALE',
      value: 'en',
      path: '/manage',
    })
  })

  test('does not overwrite the existing locale for an invalid query value', async () => {
    const request = createRequest('/manage?embed=true&locale=fr')
    request.cookies.set({ name: 'NEXT_LOCALE', value: 'de' })

    await proxy(request)

    expect(request.cookies.get('NEXT_LOCALE')).toEqual({
      name: 'NEXT_LOCALE',
      value: 'de',
    })
  })

  test('does not invent a locale when the query parameter is missing', async () => {
    const request = createRequest('/manage?embed=true')

    await proxy(request)

    expect(request.cookies.get('NEXT_LOCALE')).toBeUndefined()
  })
})
