import type { CodeTestCase } from '@klicker-uzh/types'
import {
  decodeJwt,
  exportPKCS8,
  generateKeyPair,
  jwtVerify,
  type KeyLike,
} from 'jose'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  buildCodeApiExecutionRequest,
  CodeApiClientError,
  createCodeApiClient,
  gradeCodeInvocationOutcomes,
  mintCodeApiJwt,
  parseCodeApiRunnerOutput,
  type CodeApiClientConfig,
} from '../src/codeApi.js'

const NOW_SECONDS = 1_750_000_000

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
    expect(request.code).toContain('subprocess.run')
    expect(request.code).toContain('timeout=PER_TEST_TIMEOUT_SECONDS')
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
      client.executeBatches({
        subject: 'participant-42',
        studentCode: 'def solve(value):\n    return value',
        entrypoint: 'solve',
        publicInvocations: [{ id: 'public-1', args: [1] }],
        hiddenInvocations: [{ id: 'hidden-1', args: [2] }],
        perTestTimeoutSeconds: 5,
      })
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

  it('returns typed public and hidden batches for distinct sessions', async () => {
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
    }).executeBatches({
      subject: 'participant-42',
      studentCode: 'def solve(value):\n    return value',
      entrypoint: 'solve',
      publicInvocations: [{ id: 'public-1', args: [1] }],
      hiddenInvocations: [{ id: 'hidden-1', args: [2] }],
      perTestTimeoutSeconds: 5,
    })

    expect(result).toEqual({
      public: {
        visibility: 'public',
        sessionId: 'public-session',
        outcomes: [
          {
            id: 'public-1',
            status: 'ok',
            actualOutput: { answer: 1 },
            stdout: 'public output',
            stderr: '',
          },
        ],
      },
      hidden: {
        visibility: 'hidden',
        sessionId: 'hidden-session',
        outcomes: [
          {
            id: 'hidden-1',
            status: 'timeout',
            stdout: '',
            stderr: '',
          },
        ],
      },
    })
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
      client.executeBatches({
        subject: 'participant-42',
        studentCode: 'def solve():\n    return 1',
        entrypoint: 'solve',
        publicInvocations: [{ id: 'public-1', args: [] }],
        perTestTimeoutSeconds: 5,
      })
    ).rejects.toMatchObject({
      name: 'CodeApiClientError',
      kind: 'rate_limit',
      status: 429,
      retryAfterSeconds: 17,
      message: 'CodeAPI request failed with status 429',
    })
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
      client.executeBatches({
        subject: 'participant-42',
        studentCode: 'def solve():\n    return 1',
        entrypoint: 'solve',
        publicInvocations: [{ id: 'public-1', args: [] }],
        perTestTimeoutSeconds: 5,
      })
    ).rejects.toMatchObject({
      name: 'CodeApiClientError',
      kind: 'request_timeout',
    })
    expect(fetchMock).toHaveBeenCalledOnce()
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
      client.executeBatches({
        subject: 'participant-42',
        studentCode: 'def solve():\n    return 1',
        entrypoint: 'solve',
        publicInvocations: [{ id: 'public-1', args: [] }],
        perTestTimeoutSeconds: 5,
      })
    ).rejects.toMatchObject({
      name: 'CodeApiClientError',
      kind,
    })
  })
})

describe('CodeAPI runner output', () => {
  it('accepts pass, failure, and timeout fixtures and caps text', () => {
    const output = parseCodeApiRunnerOutput(
      JSON.stringify({
        version: 1,
        outcomes: [
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
        ],
      })
    )

    expect(output[0]).toMatchObject({
      id: 'pass',
      status: 'ok',
      actualOutput: { answer: 42 },
    })
    expect(output[0]!.stdout.length).toBeLessThanOrEqual(8_192)
    expect(output[1]).toEqual({
      id: 'failure',
      status: 'error',
      stdout: '',
      stderr: 'bad input',
      exception: 'ValueError: bad input',
    })
    expect(output[2]).toEqual({
      id: 'timeout',
      status: 'timeout',
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
      'invalid status',
      JSON.stringify({
        version: 1,
        outcomes: [{ id: 'one', status: 'passed', stdout: '', stderr: '' }],
      }),
    ],
  ])('rejects malformed runner output: %s', (_label, stdout) => {
    expect(() => parseCodeApiRunnerOutput(stdout)).toThrow(CodeApiClientError)
  })
})

describe('exact JSON grading', () => {
  it('compares JSON values exactly and excludes hidden execution details', () => {
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

    expect(
      gradeCodeInvocationOutcomes(tests, [
        {
          id: 'public-pass',
          status: 'ok',
          actualOutput: { nested: [true, null], answer: 42 },
          stdout: 'visible',
          stderr: '',
        },
        {
          id: 'hidden-fail',
          status: 'ok',
          actualOutput: 5,
          stdout: 'secret output',
          stderr: 'secret error',
        },
        {
          id: 'public-timeout',
          status: 'timeout',
          stdout: '',
          stderr: '',
        },
      ])
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
