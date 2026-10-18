import {
  CODE_RUNTIME_BASE_PATH,
  CODE_RUNTIME_MANIFEST,
} from '@klicker-uzh/code-runner/serving'
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { proxy } from '@/src/proxy'

const RUNTIME_URL =
  'https://chat.test/code-runtimes/0123456789abcdef/pyodide/pyodide.asm.wasm'

describe('browser code runtime serving', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('answers 404 while the deployment kill switch is off', async () => {
    vi.stubEnv('CHAT_CODE_EXECUTION_ENABLED', '')
    const response = await proxy(new NextRequest(RUNTIME_URL))

    expect(response.status).toBe(404)
    expect(response.headers.get('x-middleware-next')).toBeNull()
  })

  test('serves runtime files without participant auth and keeps their own policy', async () => {
    vi.stubEnv('CHAT_CODE_EXECUTION_ENABLED', 'true')
    vi.stubEnv('ALLOWED_FRAME_ANCESTORS', 'https://lms.example')
    const response = await proxy(new NextRequest(RUNTIME_URL))

    expect(response.headers.get('x-middleware-next')).toBe('1')
    const csp = response.headers.get('content-security-policy') ?? ''
    expect(csp).toContain("default-src 'none'")
    expect(csp).not.toContain('https://lms.example')
    expect(response.headers.get('cache-control')).toContain('immutable')
  })

  test('keeps participant pages behind the login gate when the switch is on', async () => {
    vi.stubEnv('CHAT_CODE_EXECUTION_ENABLED', 'true')
    const response = await proxy(
      new NextRequest('https://chat.test/some-chatbot-id')
    )

    expect(response.headers.get('location')).toContain('/noLogin')
  })

  test('gives each runner document an opaque, network-less policy', async () => {
    vi.stubEnv('CHAT_CODE_EXECUTION_ENABLED', 'true')
    const policy = async (document: string) =>
      (
        await proxy(
          new NextRequest(
            `https://chat.test${CODE_RUNTIME_BASE_PATH}${document}`
          )
        )
      ).headers.get('content-security-policy') ?? ''

    const python = await policy('runner-python.html')
    const r = await policy('runner-r.html')
    for (const csp of [python, r]) {
      expect(csp).toContain('sandbox allow-scripts')
      expect(csp).toContain("default-src 'none'")
      expect(csp).toContain('connect-src blob:')
      expect(csp).toContain(
        `'sha256-${CODE_RUNTIME_MANIFEST.runnerScriptSha256}'`
      )
    }
    expect(python).not.toContain("'unsafe-eval'")
    expect(r).toContain("'unsafe-eval'")
  })

  test.each([
    'NOTICE.md',
    'LICENSE-webR.md',
  ])('revalidates notices outside the runtime content hash: %s', async (name) => {
    vi.stubEnv('CHAT_CODE_EXECUTION_ENABLED', 'true')
    const response = await proxy(
      new NextRequest(
        `https://chat.test/code-runtimes/0123456789abcdef/${name}`
      )
    )
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=0, must-revalidate'
    )
  })
})
