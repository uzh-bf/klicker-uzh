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
    return response.json()
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
