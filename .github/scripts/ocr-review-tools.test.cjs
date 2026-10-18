const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const test = require('node:test')
const { startReviewTools } = require('./ocr-review-tools.cjs')

function fixture(t) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-tools-'))
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  git('init', '-b', 'main')
  git('config', 'user.name', 'Synthetic fixture')
  git('config', 'user.email', 'fixture@example.invalid')
  git('config', 'core.hooksPath', '/dev/null')
  fs.mkdirSync(path.join(repo, 'docs'))
  fs.writeFileSync(path.join(repo, 'docs/contract.md'), 'trusted-contract\n')
  fs.mkdirSync(path.join(repo, 'docs/adr'))
  fs.writeFileSync(
    path.join(repo, 'docs/adr/0001-contract.md'),
    'synthetic decision\n'
  )
  fs.writeFileSync(
    path.join(repo, 'docs/long.md'),
    Array.from({ length: 120 }, (_, i) => `${i} ${'x'.repeat(100)}`).join('\n')
  )
  fs.writeFileSync(path.join(repo, 'source.js'), 'export const value = 1\n')
  git('add', '.')
  git('commit', '-m', 'chore: synthetic base')
  const policy = git('rev-parse', 'HEAD')
  fs.writeFileSync(path.join(repo, 'docs/contract.md'), 'untrusted-candidate\n')
  fs.symlinkSync('/private', path.join(repo, 'escape.js'))
  git('add', '.')
  git('commit', '-m', 'enhance: synthetic candidate')
  const head = git('rev-parse', 'HEAD')
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }))
  return { repo, policy, head }
}

async function client(t, options) {
  const broker = await startReviewTools(options)
  t.after(() => broker.close())
  let id = 0
  const rpc = async (method, params, extra = {}) => {
    const response = await fetch(broker.url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${broker.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
      ...extra,
    })
    return response.status === 202 ? undefined : response.json()
  }
  await rpc('initialize', { protocolVersion: '2025-03-26' })
  await rpc('tools/list')
  return {
    broker,
    rpc,
    tool: (name, input, extra) =>
      rpc('tools/call', { name, arguments: input }, extra),
  }
}

function advice(overrides = {}) {
  return new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            reasoning_content: 'PRIVATE_SENTINEL',
            tool_calls: [
              {
                type: 'function',
                function: {
                  name: 'review_advice',
                  arguments: JSON.stringify({
                    assessment: 'uncertain',
                    answer: 'synthetic answer',
                    evidence: [
                      {
                        path: 'source.js',
                        line: 1,
                        detail: 'synthetic evidence',
                      },
                    ],
                  }),
                },
              },
            ],
          },
        },
      ],
      ...overrides,
    })
  )
}
const question = {
  question: 'Check the source invariant.',
  context: [{ path: 'source.js', start_line: 1, end_line: 1 }],
}

function documentation(overrides = {}) {
  return {
    codeSnippets: [
      {
        libraryId: '/vercel/next.js/v16.2.9',
        codeTitle: 'Synthetic API',
        codeId: 'https://example.invalid/docs',
        codeList: [{ language: 'TypeScript', code: 'SYNTHETIC_DOCUMENTATION' }],
      },
    ],
    infoSnippets: [],
    version: {
      requested: '16',
      status: 'verified',
      libraries: [
        {
          libraryId: '/vercel/next.js/v16.2.9',
          requested: '16',
          served: 'v16.2.9',
          status: 'verified',
        },
      ],
    },
    ...overrides,
  }
}

const docsQuestion = {
  libraryId: '/vercel/next.js',
  query: 'cookies async API',
  version: '16',
  language: 'TypeScript',
}

test('docs lookup validates outbound fields, returns bounded evidence and caches complete request identity', async (t) => {
  let calls = 0
  const { broker, tool, rpc } = await client(t, {
    ...fixture(t),
    context7ApiKey: 'synthetic-docs',
    publicLibraries: ['/vercel/next.js'],
    context7FetchImpl: async (value, init) => {
      calls++
      const url = new URL(value)
      assert.equal(
        url.origin + url.pathname,
        'https://context7.com/api/v3/search'
      )
      assert.equal(
        new Headers(init.headers).get('authorization'),
        'Bearer synthetic-docs'
      )
      assert.equal(init.redirect, 'error')
      return new Response(
        JSON.stringify(
          documentation({ rules: { global: ['PRIVATE_SENTINEL'] } })
        )
      )
    },
  })
  const list = await rpc('tools/list')
  assert.ok(
    list.result.tools.some((item) => item.name === 'lookup_library_docs')
  )
  for (const bad of [
    { ...docsQuestion, libraryId: '/private/repository' },
    { ...docsQuestion, query: 'https://private.invalid/path' },
    { ...docsQuestion, query: 'api_key: sk-synthetic-secret' },
    { ...docsQuestion, query: 'const secret = value;' },
    { ...docsQuestion, version: '16\nPRIVATE_SENTINEL' },
    { ...docsQuestion, language: 'PRIVATE_SENTINEL' },
    { ...docsQuestion, context: 'PRIVATE_SENTINEL' },
  ])
    assert.equal((await tool('lookup_library_docs', bad)).result.isError, true)
  assert.equal(calls, 0)
  const first = await tool('lookup_library_docs', docsQuestion)
  assert.notEqual(first.result.isError, true)
  const value = JSON.parse(first.result.content[0].text)
  assert.equal(value.version_status, 'verified')
  assert.equal(value.requested_version, '16')
  assert.equal(value.served_version, 'v16.2.9')
  assert.equal(JSON.stringify(value).includes('PRIVATE_SENTINEL'), false)
  assert.ok(Buffer.byteLength(first.result.content[0].text) <= 8192)
  await tool('lookup_library_docs', docsQuestion)
  assert.equal(calls, 1)
  await tool('lookup_library_docs', { ...docsQuestion, version: '15' })
  await tool('lookup_library_docs', { ...docsQuestion, language: 'JavaScript' })
  assert.equal(calls, 3)
  assert.equal(broker.diagnostics().docs.cache_hits, 1)
  assert.equal(broker.diagnostics().attempted, 0)
  assert.equal(JSON.stringify(broker.diagnostics()).includes('cookies'), false)
})

test('docs responses preserve version uncertainty, filter unrelated sources and bound the entire envelope', async (t) => {
  let payload
  const { tool } = await client(t, {
    ...fixture(t),
    context7ApiKey: 'synthetic',
    publicLibraries: ['/vercel/next.js'],
    context7FetchImpl: async () => new Response(JSON.stringify(payload)),
  })
  const cases = [
    [documentation({ version: undefined }), 'unverified'],
    [documentation({ version: { requested: '16' } }), 'unverified'],
    [
      documentation({
        version: {
          requested: '16',
          status: 'verified',
          libraries: [
            {
              libraryId: '/vercel/next.js',
              requested: '16',
              served: '16',
              status: 'verified',
            },
          ],
        },
      }),
      'unverified',
    ],
    [
      documentation({
        codeSnippets: [
          {
            libraryId: '/vercel/next.js/v15.0.0',
            codeId: 'https://example.invalid/docs',
            codeList: [{ code: 'synthetic' }],
          },
        ],
      }),
      'unverified',
    ],
  ]
  for (const [index, [value, status]] of cases.entries()) {
    payload = value
    const r = await tool('lookup_library_docs', {
      ...docsQuestion,
      query: `public API ${index}`,
    })
    assert.notEqual(r.result.isError, true)
    assert.equal(JSON.parse(r.result.content[0].text).version_status, status)
  }
  const second = await client(t, {
    ...fixture(t),
    context7ApiKey: 'synthetic',
    publicLibraries: ['/vercel/next.js'],
    context7FetchImpl: async () => new Response(JSON.stringify(payload)),
  })
  payload = documentation({
    codeSnippets: [
      {
        libraryId: '/unrelated/library',
        codeId: 'https://example.invalid/other',
        codeList: [{ code: 'PRIVATE_SENTINEL' }],
      },
      {
        libraryId: '/vercel/next.js/v16.2.9',
        codeId: 'http://example.invalid/insecure',
        codeList: [{ code: 'PRIVATE_SENTINEL' }],
      },
      {
        libraryId: '/vercel/next.js/v16.2.9',
        codeId: 'https://example.invalid/large',
        codeList: [{ code: '🔬'.repeat(20000) }],
      },
    ],
  })
  let r = await second.tool('lookup_library_docs', docsQuestion)
  assert.ok(Buffer.byteLength(r.result.content[0].text) <= 8192)
  const bounded = JSON.parse(r.result.content[0].text)
  assert.equal(bounded.truncated, true)
  assert.equal(bounded.evidence.length, 1)
  assert.doesNotMatch(r.result.content[0].text, /PRIVATE_SENTINEL/)
  payload = documentation({ codeSnippets: [] })
  r = await second.tool('lookup_library_docs', {
    ...docsQuestion,
    query: 'other public API',
  })
  assert.equal(JSON.parse(r.result.content[0].text).status, 'no_docs')
  payload = { unexpected: 'PRIVATE_SENTINEL' }
  assert.equal(
    (
      await second.tool('lookup_library_docs', {
        ...docsQuestion,
        query: 'third public API',
      })
    ).result.isError,
    true
  )
})

test('docs quotas are shared across concurrent requests and do not consume advisor slots', async (t) => {
  let calls = 0
  const { tool, broker } = await client(t, {
    ...fixture(t),
    context7ApiKey: 'synthetic',
    publicLibraries: ['/vercel/next.js'],
    advisorUrl: 'http://127.0.0.1:1234/v1/chat/completions',
    advisorToken: 'synthetic',
    fetchImpl: async () => advice(),
    context7FetchImpl: async () => {
      calls++
      await new Promise((resolve) => setTimeout(resolve, 15))
      return new Response('PRIVATE_SENTINEL', { status: 429 })
    },
  })
  const results = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      tool('lookup_library_docs', { ...docsQuestion, query: `public API ${i}` })
    )
  )
  assert.equal(calls, 4)
  assert.ok(results.every((x) => x.result.isError))
  assert.equal(broker.diagnostics().docs.attempted, 4)
  assert.equal(broker.diagnostics().docs.unknown_usage, 4)
  assert.equal(broker.diagnostics().docs.rejected, 2)
  assert.equal(broker.diagnostics().docs.last_failure, 'http_error')
  assert.equal(broker.diagnostics().docs.last_failure_http_status, 429)
  assert.equal(JSON.stringify(results).includes('PRIVATE_SENTINEL'), false)
  assert.notEqual(
    (await tool('ask_review_advisor', question)).result.isError,
    true
  )
  assert.notEqual(
    (await tool('ask_review_advisor', question)).result.isError,
    true
  )
  assert.equal(broker.diagnostics().completed, 2)
  const absent = await client(t, {
    ...fixture(t),
    publicLibraries: ['/vercel/next.js'],
  })
  assert.equal(
    (await absent.tool('lookup_library_docs', docsQuestion)).result.isError,
    true
  )
  assert.equal(absent.broker.diagnostics().docs.upstream_attempts, 0)
  const empty = await client(t, fixture(t))
  assert.equal(
    (await empty.tool('lookup_library_docs', docsQuestion)).result.content[0]
      .text,
    'docs_unavailable'
  )
})

test('docs failures, oversized bodies and caller cancellation remain bounded and content-free', async (t) => {
  for (const [response, kind, status] of [
    [
      () => {
        throw Error('PRIVATE_SENTINEL')
      },
      'transport_error',
      null,
    ],
    [
      () => new Response('PRIVATE_SENTINEL', { status: 401 }),
      'http_error',
      401,
    ],
    [() => new Response('invalid PRIVATE_SENTINEL'), 'invalid_response', 200],
    [() => new Response('x'.repeat(262145)), 'response_too_large', 200],
  ]) {
    const { tool, broker } = await client(t, {
      ...fixture(t),
      context7ApiKey: 'synthetic',
      publicLibraries: ['/vercel/next.js'],
      context7FetchImpl: async () => response(),
    })
    const r = await tool('lookup_library_docs', docsQuestion)
    assert.equal(r.result.isError, true)
    assert.doesNotMatch(JSON.stringify(r), /PRIVATE_SENTINEL/)
    assert.equal(broker.diagnostics().docs.failed, 1)
    assert.equal(broker.diagnostics().docs.cancelled, 0)
    assert.equal(broker.diagnostics().docs.last_failure, kind)
    assert.equal(broker.diagnostics().docs.last_failure_http_status, status)
    assert.doesNotMatch(
      JSON.stringify(broker.diagnostics()),
      /PRIVATE_SENTINEL/
    )
  }
  let started
  const ready = new Promise((resolve) => {
    started = resolve
  })
  const { tool, broker, rpc } = await client(t, {
    ...fixture(t),
    context7ApiKey: 'synthetic',
    publicLibraries: ['/vercel/next.js'],
    context7FetchImpl: async (_url, init) =>
      new Promise((_resolve, reject) => {
        started()
        init.signal.addEventListener(
          'abort',
          () => reject(Error('PRIVATE_SENTINEL')),
          { once: true }
        )
      }),
  })
  const pending = tool('lookup_library_docs', docsQuestion)
  await ready
  await rpc('notifications/cancelled', { requestId: 3 })
  const r = await pending
  assert.equal(r.result.content[0].text, 'cancelled')
  assert.equal(broker.diagnostics().docs.cancelled, 1)
  assert.equal(broker.diagnostics().docs.last_failure, 'cancelled')
  assert.equal(broker.diagnostics().docs.unknown_usage, 1)
})

test('docs deadline expires as an upstream failure instead of a client cancellation', {
  timeout: 20000,
}, async (t) => {
  const { tool, broker } = await client(t, {
    ...fixture(t),
    context7ApiKey: 'synthetic',
    publicLibraries: ['/vercel/next.js'],
    context7FetchImpl: async (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener(
          'abort',
          () => reject(Error('PRIVATE_SENTINEL')),
          { once: true }
        )
      }),
  })
  const r = await tool('lookup_library_docs', docsQuestion)
  assert.equal(r.result.content[0].text, 'docs_unavailable')
  assert.equal(broker.diagnostics().docs.cancelled, 0)
  assert.equal(broker.diagnostics().docs.failed, 1)
  assert.equal(broker.diagnostics().docs.last_failure, 'timeout')
  assert.equal(broker.diagnostics().docs.unknown_usage, 1)
})

test('MCP context reads trusted Git content and rejects traversal, symlinks and unauthorized requests', async (t) => {
  const { broker, rpc, tool } = await client(t, fixture(t))
  const result = await tool('read_review_context', { path: 'docs/contract.md' })
  const context = JSON.parse(result.result.content[0].text)
  assert.match(context.text, /trusted-contract/)
  assert.doesNotMatch(context.text, /untrusted-candidate/)
  const listing = JSON.parse(
    (await tool('read_review_context', { path: 'docs' })).result.content[0].text
  )
  assert.ok(listing.paths.includes('docs/adr'))
  const decisions = JSON.parse(
    (await tool('read_review_context', { path: 'docs/adr' })).result.content[0]
      .text
  )
  assert.ok(decisions.paths.includes('docs/adr/0001-contract.md'))
  const chunk = JSON.parse(
    (await tool('read_review_context', { path: 'docs/long.md' })).result
      .content[0].text
  )
  assert.ok(Buffer.byteLength(chunk.text) <= 8192)
  assert.ok(chunk.truncated && chunk.next_line === chunk.end_line + 1)
  const next = JSON.parse(
    (
      await tool('read_review_context', {
        path: 'docs/long.md',
        start_line: chunk.next_line,
      })
    ).result.content[0].text
  )
  assert.equal(next.start_line, chunk.next_line)
  assert.equal(broker.diagnostics().status, 'unavailable')
  for (const input of [
    { path: '../.git/config' },
    { path: 'source.js' },
    { path: 'docs/contract.md', start_line: 0 },
    { path: '.env' },
  ]) {
    assert.equal(
      (await tool('read_review_context', input)).result.isError,
      true
    )
  }
  assert.equal((await rpc('unknown')).error.code, -32601)
  const denied = await fetch(broker.url, { method: 'POST', body: '{}' })
  assert.equal(denied.status, 403)
  const browser = await fetch(broker.url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${broker.token}`,
      origin: 'https://untrusted.invalid',
    },
    body: '{}',
  })
  assert.equal(browser.status, 403)
})

test('all concurrent review workers share two attempted consultations and receive no private reasoning', async (t) => {
  const requests = []
  const { broker, tool } = await client(t, {
    ...fixture(t),
    advisorUrl: 'http://127.0.0.1:12345/v1/chat/completions',
    advisorToken: 'synthetic-local-capability',
    fetchImpl: async (url, init) => {
      requests.push(JSON.parse(init.body))
      assert.ok(Buffer.byteLength(init.body) <= 16384)
      assert.equal(new URL(url).hostname, '127.0.0.1')
      await new Promise((resolve) => setTimeout(resolve, 20))
      return advice()
    },
  })
  const results = await Promise.all([
    tool('ask_review_advisor', question),
    tool('ask_review_advisor', question),
    tool('ask_review_advisor', question),
  ])
  assert.equal(requests.length, 2)
  assert.equal(results.filter((result) => result.result.isError).length, 1)
  for (const body of requests) {
    assert.equal(body.reasoning_effort, 'max')
    assert.equal(body.model, 'zai-glm-5-3')
    assert.equal(body.max_tokens, 16384)
    assert.equal(body.tools.length, 1)
    assert.equal(body.tool_choice.function.name, 'review_advice')
  }
  assert.equal(JSON.stringify(results).includes('PRIVATE_SENTINEL'), false)
  assert.deepEqual(
    [
      broker.diagnostics().attempted,
      broker.diagnostics().completed,
      broker.diagnostics().rejected,
    ],
    [2, 2, 1]
  )
  assert.equal(broker.diagnostics().status, 'consulted')
})

test('invalid source and truncated advice consume attempts without retries or accepted output', async (t) => {
  let calls = 0
  const { broker, tool } = await client(t, {
    ...fixture(t),
    advisorUrl: 'http://127.0.0.1:12345/v1/chat/completions',
    advisorToken: 'local',
    fetchImpl: async () => {
      calls += 1
      return advice({ choices: [{ finish_reason: 'length', message: {} }] })
    },
  })
  const source = await tool('ask_review_advisor', {
    ...question,
    context: [{ path: 'escape.js' }],
  })
  assert.equal(source.result.isError, true)
  assert.equal(calls, 0)
  const truncated = await tool('ask_review_advisor', question)
  assert.equal(truncated.result.isError, true)
  assert.equal(calls, 1)
  assert.equal(broker.diagnostics().completed, 0)
  assert.equal(broker.diagnostics().failed, 2)
})

test('disconnect and close cancel the advisor request with bounded cleanup', async (t) => {
  let started
  const entered = new Promise((resolve) => {
    started = resolve
  })
  const { broker, tool } = await client(t, {
    ...fixture(t),
    advisorUrl: 'http://127.0.0.1:12345/v1/chat/completions',
    advisorToken: 'local',
    fetchImpl: async (_url, init) => {
      started()
      return new Promise((_resolve, reject) =>
        init.signal.addEventListener(
          'abort',
          () => reject(new Error('PRIVATE_SENTINEL')),
          { once: true }
        )
      )
    },
  })
  const abort = new AbortController()
  const call = tool('ask_review_advisor', question, { signal: abort.signal })
  const rejected = assert.rejects(call)
  await entered
  abort.abort()
  await rejected
  await broker.close()
  assert.equal(broker.diagnostics().completed, 0)
  assert.equal(broker.diagnostics().cancelled, 1)
})
