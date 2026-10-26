import { spawn } from 'node:child_process'
import { createPrivateKey, randomUUID } from 'node:crypto'
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import https from 'node:https'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createOpenAI } from '@ai-sdk/openai'
import { stepCountIs, streamText } from 'ai'
import { SignJWT } from 'jose'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import {
  CODEAPI_BROWSER_CHATBOT_ID,
  certificate,
  fixtureMode,
  fixtureRegistry,
  startFixture,
} from '../scripts/codeapi-browser-fixture.mjs'
import { parseChatModelRegistry } from '../src/lib/server/chatModelRegistry'
import { withCodeApiTool } from '../src/lib/server/codeapiTool'

let tls: ReturnType<typeof certificate>
const cleanups: Array<() => Promise<unknown>> = []
beforeAll(() => {
  tls = certificate()
})
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
  vi.unstubAllEnvs()
})

async function setup(mode = 'enabled', options = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'codeapi-fixture-test-'))
  cleanups.push(() => rm(directory, { recursive: true, force: true }))
  const statusPath = path.join(directory, 'status.json')
  const fixture = await startFixture({ mode, statusPath, tls, ...options })
  cleanups.push(fixture.close)
  return {
    ...fixture,
    directory,
    status: async () => JSON.parse(await readFile(statusPath, 'utf8')),
  }
}

function request(
  origin: string,
  pathname: string,
  body: unknown,
  token = 'local-fixture'
) {
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const req = https.request(
      `${origin}${pathname}`,
      {
        method: 'POST',
        ca: tls.cert,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'x-codeapi-expected-profile': 'default',
        },
      },
      (res) => {
        let text = ''
        res.on('data', (chunk) => {
          text += chunk
        })
        res.on('end', () => resolve({ status: res.statusCode!, text }))
      }
    )
    req.on('error', reject)
    req.end(JSON.stringify(body))
  })
}
const selected = (scenario = 'success') => ({ scenario, nonce: randomUUID() })
function modelBody(value: ReturnType<typeof selected>, tools = true) {
  return {
    model: 'auto',
    stream: true,
    messages: [
      { role: 'user', content: `CODEAPI_E2E:${value.scenario}:${value.nonce}` },
    ],
    ...(tools
      ? { tools: [{ type: 'function', function: { name: 'run_python' } }] }
      : {}),
  }
}
function executionBody(value: ReturnType<typeof selected>) {
  return {
    lang: 'python',
    files: [],
    timeout: 5000,
    code: `# CODEAPI_E2E:${value.scenario}:${value.nonce}`,
  }
}
async function token(fixture: Awaited<ReturnType<typeof setup>>) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({
    tenant_id: 'synthetic',
    principal_source: 'external:klicker',
    auth_context_hash: 'b'.repeat(64),
  })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'synthetic', typ: 'JWT' })
    .setIssuer(fixture.childEnv.CHAT_CODEAPI_JWT_ISSUER)
    .setAudience(fixture.childEnv.CHAT_CODEAPI_JWT_AUDIENCE)
    .setSubject('a'.repeat(64))
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + 120)
    .setJti(randomUUID())
    .sign(createPrivateKey(fixture.childEnv.CHAT_CODEAPI_JWT_PRIVATE_KEY))
}

describe('bounded CodeAPI browser fixture', () => {
  test('keeps both required model policies local and rejects invalid activation', async () => {
    expect(
      parseChatModelRegistry(fixtureRegistry()).map((model) => [
        model.id,
        model.usesResponsesApi,
      ])
    ).toEqual([
      ['auto', false],
      ['gpt-6-luna', false],
    ])
    const { directory } = await setup()
    await mkdir(path.join(directory, '.devcontainer/.runtime'), {
      recursive: true,
    })
    expect(await fixtureMode({ NODE_ENV: 'test' }, directory)).toBeNull()
    await writeFile(
      path.join(directory, '.devcontainer/.runtime/codeapi-browser-fixture'),
      'enabled'
    )
    await expect(
      fixtureMode(
        { NODE_ENV: 'production', KLICKER_CODEAPI_FIXTURE_MODE: 'enabled' },
        directory
      )
    ).rejects.toThrow('fixture_marker_invalid')
    expect(
      await fixtureMode(
        { NODE_ENV: 'test', KLICKER_CODEAPI_FIXTURE_MODE: 'enabled' },
        directory
      )
    ).toBe('enabled')
    await writeFile(
      path.join(directory, '.devcontainer/.runtime/beta-enrollment-fixture'),
      ''
    )
    await expect(
      fixtureMode(
        { NODE_ENV: 'test', KLICKER_CODEAPI_FIXTURE_MODE: 'enabled' },
        directory
      )
    ).rejects.toThrow('fixture_marker_conflict')
  })

  test('grounds an actual SDK tool turn in the signed adapter result', async () => {
    const fixture = await setup()
    for (const [name, value] of Object.entries(fixture.childEnv))
      vi.stubEnv(name, value as string)
    // TLS verification remains active through a test-owned CA and HTTP adapter.
    const fetchLocal: typeof fetch = async (input, init) => {
      const url = new URL(String(input))
      expect(url.origin).toBe(fixture.origin)
      const result = await request(
        fixture.origin,
        url.pathname,
        JSON.parse(init!.body as string),
        new Headers(init?.headers).get('authorization')!.slice(7)
      )
      return new Response(result.text, {
        status: result.status,
        headers: {
          'content-type':
            url.pathname === '/v1/exec'
              ? 'application/json'
              : 'text/event-stream',
        },
      })
    }
    vi.stubGlobal('fetch', fetchLocal)
    const provider = createOpenAI({
      apiKey: 'local-fixture',
      baseURL: `${fixture.origin}/v1`,
      fetch: fetchLocal,
    })
    const value = selected()
    const tools = withCodeApiTool(
      {
        chatbotId: CODEAPI_BROWSER_CHATBOT_ID,
        participantId: 'synthetic-participant',
        chatMode: 'tutor',
        abortSignal: new AbortController().signal,
      },
      {}
    )
    const result = streamText({
      model: provider.chat('auto'),
      tools,
      stopWhen: stepCountIs(3),
      prompt: `CODEAPI_E2E:success:${value.nonce}`,
    })
    expect(await result.text).toBe(
      `CODEAPI_RESULT:${value.nonce}:execution:succeeded`
    )
    expect((await fixture.status()).scenarios[value.nonce]).toMatchObject({
      dispatches: 1,
      completed: 1,
      toolResults: 1,
      modelCalls: 2,
    })
    const receipt = JSON.stringify(await fixture.status())
    expect(receipt).not.toContain('PRIVATE KEY')
    expect(receipt).not.toContain('synthetic-participant')
  })

  test.each([
    'python-error',
    'http-error',
    'timeout',
  ])('preserves the %s failure contract', async (scenario) => {
    const fixture = await setup()
    const value = selected(scenario)
    await request(fixture.origin, '/v1/chat/completions', modelBody(value))
    const result = await request(
      fixture.origin,
      '/v1/exec',
      executionBody(value),
      await token(fixture)
    )
    expect(result.status).toBe(scenario === 'http-error' ? 503 : 200)
    if (scenario !== 'http-error')
      expect(JSON.parse(result.text).code).toBe(
        scenario === 'timeout' ? 137 : 1
      )
    expect((await fixture.status()).scenarios[value.nonce].completed).toBe(1)
  })

  test('denies absent tools without dispatch and refuses unsigned or replayed execution', async () => {
    const fixture = await setup()
    const denied = selected()
    expect(
      (
        await request(
          fixture.origin,
          '/v1/chat/completions',
          modelBody(denied, false)
        )
      ).text
    ).toContain(`CODEAPI_UNAVAILABLE:${denied.nonce}`)
    expect((await fixture.status()).scenarios[denied.nonce].dispatches).toBe(0)
    const value = selected()
    await request(fixture.origin, '/v1/chat/completions', modelBody(value))
    const body = executionBody(value)
    expect(
      (await request(fixture.origin, '/v1/exec', body, 'unsigned')).status
    ).toBe(400)
    const valid = await token(fixture)
    expect(
      (await request(fixture.origin, '/v1/exec', body, valid)).status
    ).toBe(200)
    expect(
      (await request(fixture.origin, '/v1/exec', body, valid)).status
    ).toBe(400)
    expect((await fixture.status()).scenarios[value.nonce].dispatches).toBe(1)
  })

  test('bounds input and refuses unsupported routes and incorrect wire fields', async () => {
    const fixture = await setup()
    expect((await request(fixture.origin, '/v1/responses', {})).status).toBe(
      404
    )
    expect(
      (
        await request(fixture.origin, '/v1/chat/completions', {
          content: 'x'.repeat(129 * 1024),
        })
      ).status
    ).toBe(400)
    const value = selected()
    await request(fixture.origin, '/v1/chat/completions', modelBody(value))
    expect(
      (
        await request(
          fixture.origin,
          '/v1/exec',
          { ...executionBody(value), timeout: 6000 },
          await token(fixture)
        )
      ).status
    ).toBe(400)
    expect((await fixture.status()).scenarios[value.nonce].dispatches).toBe(0)
  })

  test('records actual transport disconnect and closes sockets on cleanup', async () => {
    const fixture = await setup()
    const value = selected('stop')
    await request(fixture.origin, '/v1/chat/completions', modelBody(value))
    const valid = await token(fixture)
    const req = https.request(`${fixture.origin}/v1/exec`, {
      method: 'POST',
      ca: tls.cert,
      headers: {
        authorization: `Bearer ${valid}`,
        'content-type': 'application/json',
        'x-codeapi-expected-profile': 'default',
      },
    })
    req.on('error', () => {})
    req.end(JSON.stringify(executionBody(value)))
    await vi.waitFor(() =>
      expect(fixture.state.scenarios[value.nonce].dispatches).toBe(1)
    )
    req.destroy()
    await vi.waitFor(() =>
      expect(fixture.state.scenarios[value.nonce].disconnected).toBe(1)
    )
    await fixture.close()
    expect((await fixture.status()).ready).toBe(false)
    await expect(
      request(fixture.origin, '/v1/chat/completions', modelBody(selected()))
    ).rejects.toThrow()
  })

  test('owns child credentials and removes its listener and public CA on termination', async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), 'codeapi-wrapper-test-')
    )
    cleanups.push(() => rm(directory, { recursive: true, force: true }))
    const scripts = path.join(directory, 'apps/chat/scripts')
    const next = path.join(directory, 'apps/chat/node_modules/next/dist/bin')
    await mkdir(scripts, { recursive: true })
    await mkdir(next, { recursive: true })
    await mkdir(path.join(directory, '.devcontainer/.runtime'), {
      recursive: true,
    })
    await copyFile(
      new URL('../scripts/codeapi-browser-fixture.mjs', import.meta.url),
      path.join(scripts, 'codeapi-browser-fixture.mjs')
    )
    await writeFile(
      path.join(directory, '.devcontainer/.runtime/codeapi-browser-fixture'),
      'enabled'
    )
    const ca = path.join(directory, 'local-public-ca.pem')
    await writeFile(ca, tls.cert)
    const childReceipt = path.join(directory, 'child.json')
    await writeFile(
      path.join(next, 'next'),
      `const fs = require('node:fs'); fs.writeFileSync(process.env.FIXTURE_CHILD_RECEIPT, JSON.stringify({ pid: process.pid, ca: process.env.NODE_EXTRA_CA_CERTS, origin: new URL(process.env.OPENAI_BASE_URL).origin, guarded: process.env.KLICKER_EVAL_GUARD_ORIGIN === new URL(process.env.OPENAI_BASE_URL).origin, signed: !!process.env.CHAT_CODEAPI_JWT_PRIVATE_KEY, telemetry: !!process.env.LANGFUSE_SECRET_KEY })); setInterval(() => {}, 1000);`
    )
    const child = spawn(
      process.execPath,
      [path.join(scripts, 'codeapi-browser-fixture.mjs')],
      {
        env: {
          PATH: process.env.PATH,
          NODE_ENV: 'test',
          KLICKER_CODEAPI_FIXTURE_MODE: 'enabled',
          NODE_EXTRA_CA_CERTS: ca,
          FIXTURE_CHILD_RECEIPT: childReceipt,
          LANGFUSE_SECRET_KEY: randomUUID(),
        },
        stdio: 'ignore',
      }
    )
    const exit = new Promise((resolve) => child.once('exit', resolve))
    cleanups.push(async () => {
      child.kill('SIGTERM')
      await exit
    })
    let receipt: {
      pid: number
      ca: string
      origin: string
      guarded: boolean
      signed: boolean
      telemetry: boolean
    }
    await vi.waitFor(
      async () => {
        receipt = JSON.parse(await readFile(childReceipt, 'utf8'))
        expect(receipt.guarded).toBe(true)
      },
      { timeout: 10_000 }
    )
    expect(receipt!.signed).toBe(true)
    expect(receipt!.telemetry).toBe(false)
    expect(child.spawnargs.join(' ')).not.toContain('PRIVATE KEY')
    const status = path.join(
      directory,
      '.devcontainer/.runtime/codeapi-browser-fixture-status.json'
    )
    await vi.waitFor(async () =>
      expect(JSON.parse(await readFile(status, 'utf8')).ready).toBe(true)
    )
    const trust = await readFile(receipt!.ca)
    child.kill('SIGTERM')
    await exit
    expect(() => process.kill(receipt!.pid, 0)).toThrow()
    await expect(readFile(receipt!.ca)).rejects.toMatchObject({
      code: 'ENOENT',
    })
    expect(JSON.parse(await readFile(status, 'utf8')).ready).toBe(false)
    await expect(
      new Promise((resolve, reject) => {
        const req = https.get(receipt!.origin, { ca: trust }, resolve)
        req.on('error', reject)
      })
    ).rejects.toMatchObject({ code: 'ECONNREFUSED' })
  })

  test('ends a blocked response and expires its own listener within fixed bounds', async () => {
    const fixture = await setup('enabled', { blockedMs: 30, lifetimeMs: 500 })
    const value = selected('stop')
    await request(fixture.origin, '/v1/chat/completions', modelBody(value))
    expect(
      (
        await request(
          fixture.origin,
          '/v1/exec',
          executionBody(value),
          await token(fixture)
        )
      ).status
    ).toBe(504)
    await vi.waitFor(() => expect(fixture.state.ready).toBe(false), {
      timeout: 2000,
    })
    expect(fixture.state.scenarios[value.nonce]).toMatchObject({
      completed: 1,
      disconnected: 0,
    })
  })
})
