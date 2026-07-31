import type { CodeTestCase } from '@klicker-uzh/types'
import {
  decodeJwt,
  exportPKCS8,
  generateKeyPair,
  jwtVerify,
  type KeyLike,
} from 'jose'
import { spawnSync } from 'node:child_process'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  buildCodeApiExecutionRequest,
  createCodeApiClient,
  mintCodeApiJwt,
  type CodeApiClientConfig,
} from '../src/codeApi.js'

const NOW_SECONDS = 1_750_000_000
const HAS_PYTHON = spawnSync('python3', ['--version']).status === 0

let privateKeyPem: string
let publicKey: KeyLike

beforeAll(async () => {
  const keyPair = await generateKeyPair('EdDSA', { extractable: true })
  privateKeyPem = await exportPKCS8(keyPair.privateKey)
  publicKey = keyPair.publicKey
})

function config(
  overrides: Partial<CodeApiClientConfig> = {}
): CodeApiClientConfig {
  return {
    baseUrl: 'https://codeapi.example.test',
    issuer: 'klicker',
    audience: 'codeapi',
    tenantId: 'klicker-test',
    privateKeyPem,
    keyId: 'klicker-test-1',
    algorithm: 'EdDSA',
    tokenTtlSeconds: 60,
    requestTimeoutMs: 5_000,
    ...overrides,
  }
}

function executeResponse(
  sessionId: string,
  outcomes: unknown,
  overrides: Record<string, unknown> = {}
) {
  return {
    session_id: sessionId,
    stdout: JSON.stringify({ version: 1, outcomes }),
    stderr: '',
    files: [],
    code: 0,
    signal: null,
    message: null,
    status: 'completed',
    wall_time: 0.02,
    ...overrides,
  }
}

function decodeRunnerPayload(code: string): Record<string, unknown> {
  const match = /PAYLOAD = json\.loads\(base64\.b64decode\("([^"]+)"\)/.exec(
    code
  )
  if (!match?.[1]) throw new Error('Runner payload was not embedded')
  return JSON.parse(Buffer.from(match[1], 'base64').toString('utf8')) as Record<
    string,
    unknown
  >
}

function codeTest(overrides: Partial<CodeTestCase> = {}): CodeTestCase {
  return {
    id: 'public-1',
    name: 'public test',
    args: [],
    expectedOutput: 1,
    visibility: 'public',
    weight: 1,
    ...overrides,
  }
}

function submission(
  tests: CodeTestCase[],
  overrides: Partial<{
    subject: string
    role: string
    studentCode: string
    entrypoint: string
    perTestTimeoutSeconds: number
  }> = {}
) {
  return {
    subject: 'participant-42',
    studentCode: 'def solve(value=None):\n    return value',
    entrypoint: 'solve',
    tests,
    perTestTimeoutSeconds: 5,
    ...overrides,
  }
}

function runGeneratedPythonRunner(
  input: Parameters<typeof buildCodeApiExecutionRequest>[0]
): Record<string, unknown> {
  const request = buildCodeApiExecutionRequest(input)
  const result = spawnSync('python3', ['-I', '-c', request.code], {
    encoding: 'utf8',
    maxBuffer: 2 * 1_024 * 1_024,
    timeout: 10_000,
  })
  if (result.status !== 0) {
    throw new Error(`Generated runner failed: ${result.stderr}`)
  }
  return JSON.parse(result.stdout) as Record<string, unknown>
}

describe('CodeAPI JWT', () => {
  it('mints a short-lived asymmetric token scoped to Klicker', async () => {
    const token = await mintCodeApiJwt(
      config(),
      {
        subject: 'participant-42',
        role: 'PARTICIPANT',
      },
      {
        nowSeconds: NOW_SECONDS,
        jti: 'request-42',
      }
    )

    const { protectedHeader, payload } = await jwtVerify(token, publicKey, {
      issuer: 'klicker',
      audience: 'codeapi',
      currentDate: new Date(NOW_SECONDS * 1000),
    })

    expect(protectedHeader).toEqual({
      alg: 'EdDSA',
      kid: 'klicker-test-1',
      typ: 'JWT',
    })
    expect(payload).toMatchObject({
      iss: 'klicker',
      aud: 'codeapi',
      sub: 'participant-42',
      jti: 'request-42',
      iat: NOW_SECONDS,
      nbf: NOW_SECONDS,
      exp: NOW_SECONDS + 60,
      tenant_id: 'klicker-test',
      role: 'PARTICIPANT',
      principal_source: 'klicker_jwt',
    })
    expect(payload.auth_context_hash).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(decodeJwt(token).exp! - decodeJwt(token).iat!).toBeLessThanOrEqual(
      300
    )
  })

  it('rejects token lifetimes above the CodeAPI hard cap', async () => {
    await expect(
      mintCodeApiJwt(config({ tokenTtlSeconds: 301 }), {
        subject: 'participant-42',
      })
    ).rejects.toMatchObject({
      name: 'CodeApiClientError',
      kind: 'config',
    })
  })
})

describe('CodeAPI execution requests', () => {
  it('rejects a Python keyword entrypoint before building the runner', () => {
    try {
      buildCodeApiExecutionRequest({
        studentCode: 'def solve():\n    return 1',
        entrypoint: 'return',
        invocations: [{ id: 'public-1', args: [] }],
        perTestTimeoutSeconds: 5,
      })
      expect.fail('Expected the Python keyword entrypoint to be rejected')
    } catch (error) {
      expect(error).toMatchObject({
        name: 'CodeApiClientError',
        kind: 'request',
      })
    }
  })

  it('serializes invocation-only runner input without grading expectations', () => {
    const request = buildCodeApiExecutionRequest({
      studentCode: 'def solve(value):\n    return value',
      entrypoint: 'solve',
      invocations: [
        { id: 'public-1', args: [1] },
        { id: 'public-2', args: [{ nested: true }] },
      ],
      perTestTimeoutSeconds: 5,
    })

    expect(Object.keys(request)).toMatchInlineSnapshot(`
      [
        "lang",
        "code",
      ]
    `)
    expect(request.lang).toBe('python')
    expect(request.code).toContain('subprocess.Popen')
    expect(request.code).toContain('selectors.DefaultSelector')
    expect(request.code).toContain('os.killpg')
    expect(decodeRunnerPayload(request.code)).toEqual({
      studentCode: 'def solve(value):\n    return value',
      entrypoint: 'solve',
      invocations: [
        { id: 'public-1', args: [1] },
        { id: 'public-2', args: [{ nested: true }] },
      ],
    })
    expect(JSON.stringify(request)).not.toContain('expectedOutput')
    expect(JSON.stringify(request)).not.toContain('weight')
    expect(JSON.stringify(request)).not.toContain('passed')
  })

  it('uses separate public and hidden requests and rejects session reuse', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            executeResponse('shared-session', [
              {
                id: 'public-1',
                status: 'ok',
                actualOutput: 1,
                stdout: '',
                stderr: '',
              },
            ])
          ),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            executeResponse('shared-session', [
              {
                id: 'hidden-1',
                status: 'ok',
                actualOutput: 2,
                stdout: '',
                stderr: '',
              },
            ])
          ),
          { status: 200 }
        )
      )

    const client = createCodeApiClient(config(), {
      fetch: fetchMock,
      nowSeconds: () => NOW_SECONDS,
      randomUUID: () => 'request-id',
    })

    await expect(
      client.executeAndGrade(
        submission([
          codeTest({ args: [1], expectedOutput: 1 }),
          codeTest({
            id: 'hidden-1',
            name: 'hidden test',
            args: [2],
            expectedOutput: 2,
            visibility: 'hidden',
          }),
        ])
      )
    ).rejects.toMatchObject({
      name: 'CodeApiClientError',
      kind: 'session_reuse',
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const publicBody = JSON.parse(
      String(fetchMock.mock.calls[0]![1]!.body)
    ) as Record<string, unknown>
    const hiddenBody = JSON.parse(
      String(fetchMock.mock.calls[1]![1]!.body)
    ) as Record<string, unknown>

    expect(publicBody).toEqual({
      lang: 'python',
      code: expect.any(String),
    })
    expect(hiddenBody).toEqual({
      lang: 'python',
      code: expect.any(String),
    })
    expect(decodeRunnerPayload(publicBody.code as string)).toMatchObject({
      invocations: [{ id: 'public-1', args: [1] }],
    })
    expect(decodeRunnerPayload(hiddenBody.code as string)).toMatchObject({
      invocations: [{ id: 'hidden-1', args: [2] }],
    })
    expect(fetchMock.mock.calls[0]![0]).toBe(
      'https://codeapi.example.test/v1/exec'
    )
    expect(
      (fetchMock.mock.calls[0]![1]!.headers as Record<string, string>)
        .Authorization
    ).toMatch(/^Bearer /)
  })

  it('returns a sanitized grade for distinct public and hidden sessions', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            executeResponse('public-session', [
              {
                id: 'public-1',
                status: 'ok',
                actualOutput: { answer: 1 },
                stdout: 'public output',
                stderr: '',
              },
            ])
          ),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            executeResponse('hidden-session', [
              {
                id: 'hidden-1',
                status: 'timeout',
                stdout: '',
                stderr: '',
              },
            ])
          ),
          { status: 200 }
        )
      )

    const result = await createCodeApiClient(config(), {
      fetch: fetchMock,
      nowSeconds: () => NOW_SECONDS,
      randomUUID: () => 'request-id',
    }).executeAndGrade(
      submission([
        codeTest({
          args: [1],
          expectedOutput: { answer: 1 },
          weight: 2,
        }),
        codeTest({
          id: 'hidden-1',
          name: 'hidden test',
          args: [2],
          expectedOutput: 2,
          visibility: 'hidden',
        }),
      ])
    )

    expect(result).toEqual({
      pointsPercentage: 2 / 3,
      publicTestResults: [
        {
          id: 'public-1',
          name: 'public test',
          passed: true,
          actualOutput: { answer: 1 },
          stdout: 'public output',
          stderr: '',
        },
      ],
      hiddenTestResults: [{ id: 'hidden-1', passed: false }],
    })
    expect(JSON.stringify(result)).not.toContain('session')
    expect(JSON.stringify(result)).not.toContain('hidden output')
  })

  it('surfaces Retry-After without reflecting the hostile response body', async () => {
    const client = createCodeApiClient(config(), {
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        new Response('do not reflect me', {
          status: 429,
          headers: { 'Retry-After': '17' },
        })
      ),
    })

    await expect(
      client.executeAndGrade(submission([codeTest()]))
    ).rejects.toMatchObject({
      name: 'CodeApiClientError',
      kind: 'rate_limit',
      status: 429,
      retryAfterSeconds: 17,
      message: 'CodeAPI request failed with status 429',
    })
  })

  it.each([
    ['an overlong test id', [codeTest({ id: 'x'.repeat(129) })]],
    [
      'a non-finite total test weight',
      [
        codeTest({ id: 'first', weight: Number.MAX_VALUE }),
        codeTest({ id: 'second', weight: Number.MAX_VALUE }),
      ],
    ],
  ])('rejects %s before calling CodeAPI', async (_label, tests) => {
    const fetchMock = vi.fn<typeof fetch>()
    await expect(
      createCodeApiClient(config(), { fetch: fetchMock }).executeAndGrade(
        submission(tests)
      )
    ).rejects.toMatchObject({
      name: 'CodeApiClientError',
      kind: 'request',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the request timeout active while consuming the response body', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async (_input, init) =>
        new Response(
          new ReadableStream({
            start(controller) {
              init!.signal!.addEventListener('abort', () => {
                controller.error(new Error('response body aborted'))
              })
            },
          }),
          { status: 200 }
        )
    )
    const client = createCodeApiClient(config({ requestTimeoutMs: 1_000 }), {
      fetch: fetchMock,
    })

    await expect(
      client.executeAndGrade(submission([codeTest()]))
    ).rejects.toMatchObject({
      name: 'CodeApiClientError',
      kind: 'request_timeout',
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('shares one grading deadline across public and hidden batches', async () => {
    let firstSignal: AbortSignal | null = null
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (_input, init) => {
        if (!firstSignal) {
          firstSignal = init!.signal!
          return new Response(
            JSON.stringify(
              executeResponse('public-session', [
                {
                  id: 'public-1',
                  status: 'ok',
                  actualOutput: 1,
                  stdout: '',
                  stderr: '',
                },
              ])
            ),
            { status: 200 }
          )
        }
        expect(init!.signal).toBe(firstSignal)
        return new Response(
          new ReadableStream({
            start(controller) {
              init!.signal!.addEventListener('abort', () => {
                controller.error(new Error('hidden response body aborted'))
              })
            },
          }),
          { status: 200 }
        )
      })
    const client = createCodeApiClient(config({ requestTimeoutMs: 1_000 }), {
      fetch: fetchMock,
    })

    await expect(
      client.executeAndGrade(
        submission([
          codeTest(),
          codeTest({ id: 'hidden-1', visibility: 'hidden' }),
        ])
      )
    ).rejects.toMatchObject({
      name: 'CodeApiClientError',
      kind: 'request_timeout',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects more than 20 configured tests before making a request', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    const client = createCodeApiClient(config(), { fetch: fetchMock })

    await expect(
      client.executeAndGrade(
        submission(
          Array.from({ length: 21 }, (_, index) =>
            codeTest({ id: `test-${index}` })
          )
        )
      )
    ).rejects.toMatchObject({
      name: 'CodeApiClientError',
      kind: 'request',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('enforces the shared JSON limits before making a request', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    const client = createCodeApiClient(config(), { fetch: fetchMock })
    const tooDeep = Array.from({ length: 22 }).reduce<unknown[]>(
      (nested) => [nested],
      []
    )

    await expect(
      client.executeAndGrade(
        submission([codeTest({ args: [tooDeep] as never })])
      )
    ).rejects.toMatchObject({
      name: 'CodeApiClientError',
      kind: 'request',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    [
      'the stale run-wrapped response',
      {
        run: {
          stdout: JSON.stringify({ version: 1, outcomes: [] }),
          stderr: '',
          code: 0,
        },
        language: 'python',
        version: '3',
        session_id: 'session-1',
        files: [],
      },
      'response',
    ],
    [
      'unexpected runner artifacts',
      {
        ...executeResponse('session-1', [
          {
            id: 'public-1',
            status: 'ok',
            actualOutput: 1,
            stdout: '',
            stderr: '',
          },
        ]),
        files: [{ id: 'artifact-1', name: 'leak.txt' }],
      },
      'runner',
    ],
    [
      'mismatched outcome ids',
      executeResponse('session-1', [
        {
          id: 'other-test',
          status: 'ok',
          actualOutput: 1,
          stdout: '',
          stderr: '',
        },
      ]),
      'runner',
    ],
  ])('rejects %s', async (_label, responseBody, kind) => {
    const client = createCodeApiClient(config(), {
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify(responseBody), { status: 200 })
        ),
    })

    await expect(
      client.executeAndGrade(submission([codeTest()]))
    ).rejects.toMatchObject({
      name: 'CodeApiClientError',
      kind,
    })
  })
})

describe.skipIf(!HAS_PYTHON)('generated Python runner isolation', () => {
  it('executes pass, error, and timeout outcomes in fresh child processes', () => {
    const result = runGeneratedPythonRunner({
      studentCode: `
def solve(mode):
    if mode == "pass":
        print("visible")
        return 4
    if mode == "error":
        raise ValueError("boom")
    while True:
        pass
`.trim(),
      entrypoint: 'solve',
      invocations: [
        { id: 'pass', args: ['pass'] },
        { id: 'error', args: ['error'] },
        { id: 'timeout', args: ['timeout'] },
      ],
      perTestTimeoutSeconds: 1,
    })

    expect(result).toEqual({
      version: 1,
      outcomes: [
        {
          id: 'pass',
          status: 'ok',
          actualOutput: 4,
          stdout: 'visible\n',
          stderr: '',
        },
        {
          id: 'error',
          status: 'error',
          stdout: '',
          stderr: '',
          exception: 'ValueError: boom',
        },
        {
          id: 'timeout',
          status: 'timeout',
          stdout: '',
          stderr: '',
        },
      ],
    })
  })

  it('caps direct file-descriptor output and kills descendant process groups', () => {
    const result = runGeneratedPythonRunner({
      studentCode: `
import os
import subprocess
import sys

def solve(mode):
    if mode == "fd-output":
        os.write(1, b"x" * (1024 * 1024))
        return 1
    subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
    return 1
`.trim(),
      entrypoint: 'solve',
      invocations: [
        { id: 'fd-output', args: ['fd-output'] },
        { id: 'descendant', args: ['descendant'] },
      ],
      perTestTimeoutSeconds: 1,
    })

    expect(result).toEqual({
      version: 1,
      outcomes: [
        {
          id: 'fd-output',
          status: 'error',
          stdout: '',
          stderr: '',
          exception: 'output_limit_exceeded',
        },
        {
          id: 'descendant',
          status: 'timeout',
          stdout: '',
          stderr: '',
        },
      ],
    })
  })
})

describe('CodeAPI runner output', () => {
  it('accepts pass, failure, and timeout fixtures and caps public text', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify(
          executeResponse('public-session', [
            {
              id: 'pass',
              status: 'ok',
              actualOutput: { answer: 42 },
              stdout: 'x'.repeat(9_000),
              stderr: '',
            },
            {
              id: 'failure',
              status: 'error',
              stdout: '',
              stderr: 'bad input',
              exception: 'ValueError: bad input',
            },
            {
              id: 'timeout',
              status: 'timeout',
              stdout: '',
              stderr: '',
            },
          ])
        ),
        { status: 200 }
      )
    )
    const result = await createCodeApiClient(config(), {
      fetch: fetchMock,
    }).executeAndGrade(
      submission([
        codeTest({
          id: 'pass',
          expectedOutput: { answer: 42 },
        }),
        codeTest({ id: 'failure' }),
        codeTest({ id: 'timeout' }),
      ])
    )

    expect(result.publicTestResults[0]).toMatchObject({
      id: 'pass',
      passed: true,
      actualOutput: { answer: 42 },
    })
    expect(result.publicTestResults[0]!.stdout?.length).toBeLessThanOrEqual(
      4_096
    )
    expect(result.publicTestResults[1]).toEqual({
      id: 'failure',
      name: 'public test',
      passed: false,
      stdout: '',
      stderr: 'bad input',
    })
    expect(result.publicTestResults[2]).toEqual({
      id: 'timeout',
      name: 'public test',
      passed: false,
      stdout: '',
      stderr: '',
    })
  })

  it.each([
    ['not JSON', 'not-json'],
    ['wrong version', JSON.stringify({ version: 2, outcomes: [] })],
    [
      'duplicate ids',
      JSON.stringify({
        version: 1,
        outcomes: [
          { id: 'same', status: 'timeout', stdout: '', stderr: '' },
          { id: 'same', status: 'timeout', stdout: '', stderr: '' },
        ],
      }),
    ],
    [
      'missing id',
      JSON.stringify({
        version: 1,
        outcomes: [{ status: 'timeout', stdout: '', stderr: '' }],
      }),
    ],
    [
      'invalid status',
      JSON.stringify({
        version: 1,
        outcomes: [{ id: 'one', status: 'passed', stdout: '', stderr: '' }],
      }),
    ],
  ])('rejects malformed runner output: %s', async (_label, stdout) => {
    const response = executeResponse('public-session', [])
    response.stdout = stdout
    const client = createCodeApiClient(config(), {
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify(response), { status: 200 })
        ),
    })

    await expect(
      client.executeAndGrade(submission([codeTest()]))
    ).rejects.toMatchObject({
      name: 'CodeApiClientError',
      kind: 'runner',
    })
  })
})

describe('exact JSON grading', () => {
  it('compares JSON values exactly and excludes hidden execution details', async () => {
    const tests: CodeTestCase[] = [
      {
        id: 'public-pass',
        name: 'object order is not significant',
        args: [],
        expectedOutput: { answer: 42, nested: [true, null] },
        visibility: 'public',
        weight: 2,
      },
      {
        id: 'hidden-fail',
        name: 'hidden expectation',
        args: [],
        expectedOutput: 4,
        visibility: 'hidden',
        weight: 1,
      },
      {
        id: 'public-timeout',
        name: 'times out',
        args: [],
        expectedOutput: null,
        visibility: 'public',
        weight: 1,
      },
    ]

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            executeResponse('public-session', [
              {
                id: 'public-pass',
                status: 'ok',
                actualOutput: { nested: [true, null], answer: 42 },
                stdout: 'visible',
                stderr: '',
              },
              {
                id: 'public-timeout',
                status: 'timeout',
                stdout: '',
                stderr: '',
              },
            ])
          ),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            executeResponse('hidden-session', [
              {
                id: 'hidden-fail',
                status: 'ok',
                actualOutput: 5,
                stdout: 'secret output',
                stderr: 'secret error',
              },
            ])
          ),
          { status: 200 }
        )
      )

    expect(
      await createCodeApiClient(config(), { fetch: fetchMock }).executeAndGrade(
        submission(tests)
      )
    ).toEqual({
      pointsPercentage: 0.5,
      publicTestResults: [
        {
          id: 'public-pass',
          name: 'object order is not significant',
          passed: true,
          actualOutput: { nested: [true, null], answer: 42 },
          stdout: 'visible',
          stderr: '',
        },
        {
          id: 'public-timeout',
          name: 'times out',
          passed: false,
          stdout: '',
          stderr: '',
        },
      ],
      hiddenTestResults: [{ id: 'hidden-fail', passed: false }],
    })
  })
})
