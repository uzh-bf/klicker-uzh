import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

const require = createRequire(import.meta.url)
const appDirectory = fileURLToPath(new URL('..', import.meta.url))

// Each deployment policy gets a fresh production server. The transport to the
// local server is HTTP; NEXTAUTH_URL models the origin behind the TLS proxy.
function startAuthServer(protocol: 'http' | 'https') {
  const server = spawn(
    process.execPath,
    [
      require.resolve('next/dist/bin/next'),
      'start',
      '-H',
      '127.0.0.1',
      '-p',
      '0',
    ],
    {
      cwd: appDirectory,
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
        APP_SECRET: 'synthetic-auth-built-test-secret',
        APP_ORIGIN_AUTH: `${protocol}://auth.example.test`,
        NEXTAUTH_URL: `${protocol}://auth.example.test`,
        AUTH_SECURE_COOKIES: '',
        AUTH_STUDENT_ALLOWED_HOSTS: 'assessment.example.test',
        AUTH_LECTURER_ALLOWED_HOSTS: 'manage.example.test',
        AUTH_PWA_HOSTS: 'pwa.example.test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )
  const closed = new Promise<void>((resolve) => server.once('close', resolve))
  const origin = new Promise<string>((resolve, reject) => {
    let output = ''
    const timeout = setTimeout(() => {
      server.kill('SIGKILL')
      reject(new Error(`Auth server startup timed out: ${output}`))
    }, 30_000)
    const capture = (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-8_000)
      const url = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]
      if (url && output.includes('Ready in')) {
        clearTimeout(timeout)
        resolve(url)
      }
    }
    server.stdout.on('data', capture)
    server.stderr.on('data', capture)
    server.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    server.once('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`Auth server exited (${code}): ${output}`))
    })
  })
  return {
    origin,
    async close() {
      if (server.exitCode !== null || server.signalCode !== null) return closed
      server.kill('SIGTERM')
      const timeout = setTimeout(() => server.kill('SIGKILL'), 5_000)
      await closed
      clearTimeout(timeout)
    },
  }
}

describe.each(['http', 'https'] as const)('%s deployment', (protocol) => {
  let server: ReturnType<typeof startAuthServer>
  let authOrigin: string
  const assessmentOrigin = `${protocol}://assessment.example.test`
  const manageOrigin = `${protocol}://manage.example.test`

  beforeAll(async () => {
    server = startAuthServer(protocol)
    authOrigin = await server.origin
  }, 40_000)

  afterAll(async () => {
    await server?.close()
  })

  async function page(path: string) {
    const response = await fetch(new URL(path, authOrigin), {
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    })
    return { status: response.status, html: await response.text() }
  }

  test('accepts the configured manage transport and return path', async () => {
    const target = `${manageOrigin}/resources/answerCollections?tab=shared`
    const response = await page(`/?redirectTo=${encodeURIComponent(target)}`)
    expect(response.status).toBe(200)
  })

  test('preserves an assessment deep link in server page props', async () => {
    const target = `${assessmentOrigin}/course/synthetic?assessment=synthetic`
    const response = await page(
      `/student?redirectTo=${encodeURIComponent(target)}`
    )
    expect(response.status).toBe(200)
    const data = response.html.match(
      /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
    )
    expect(data?.[1]).toBeDefined()
    expect(JSON.parse(data![1]!).props.pageProps.redirectTo).toBe(target)
  })

  test.each([
    '',
    '/de',
  ])('keeps participant recovery scoped before hydration (%s)', async (locale) => {
    const response = await page(
      `${locale}/restart?audience=participant&error=access_denied`
    )
    expect(response.status).toBe(200)
    expect(response.html).toContain('data-cy="restart-student-login-button"')
    expect(response.html).not.toContain(
      'data-cy="restart-lecturer-login-button"'
    )
  })

  test('keeps explicit audience choices for unknown recovery', async () => {
    const response = await page('/restart')
    expect(response.status).toBe(200)
    expect(response.html).toContain('data-cy="restart-student-login-button"')
    expect(response.html).toContain('data-cy="restart-lecturer-login-button"')
  })

  test.each([
    ['/', 'manage.example.test'],
    ['/student', 'assessment.example.test'],
  ])('applies the deployment transport policy to %s', async (route, host) => {
    const target = `http://${host}/course/synthetic`
    const response = await page(
      `${route}?redirectTo=${encodeURIComponent(target)}`
    )
    expect(response.status).toBe(protocol === 'https' ? 400 : 200)
  })
})
