import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

// A disposable HTTP server exercises the CLI without a database or real token.
test('publication CLI', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'publish-chatbot-'))
  const script = join(dir, 'util/publish-chatbot.mjs')
  await mkdir(join(dir, 'util'))
  await mkdir(join(dir, 'packages/graphql/src/public'), { recursive: true })
  await copyFile(new URL('./publish-chatbot.mjs', import.meta.url), script)
  await writeFile(
    join(dir, 'packages/graphql/src/public/server.json'),
    JSON.stringify({
      'synthetic-hash':
        'mutation ApproveChatbotPublication($id: String!) { approveChatbotPublication(id: $id) { id status } }',
    })
  )
  const requests = []
  let status = 200
  let payload = {
    data: {
      approveChatbotPublication: { id: 'test-bot', status: 'PUBLISHED' },
    },
  }
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    requests.push({ headers: req.headers, body: JSON.parse(body) })
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(payload))
  })
  await new Promise((resolve) => server.listen(0, 'localhost', resolve))
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  })
  function run(args, extraEnv = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [script, ...args], {
        env: {
          KLICKER_API_URL: `http://localhost:${server.address().port}/graphql`,
          KLICKER_ADMIN_TOKEN: 'synthetic-admin-token',
          ...extraEnv,
        },
      })
      let output = ''
      child.stdout.on('data', (chunk) => {
        output += chunk
      })
      child.stderr.on('data', (chunk) => {
        output += chunk
      })
      child.on('error', reject)
      child.on('close', (code) => resolve({ code, output }))
    })
  }
  const args = ['--chatbot-id', 'test-bot']
  assert.equal((await run(args)).code, 0)
  assert.equal(requests.length, 0, 'dry run must not contact the backend')
  for (const invalid of [[], [...args, '--unknown']]) {
    assert.equal((await run(invalid)).code, 1)
  }
  assert.equal(
    (await run([...args, '--apply'], { KLICKER_ADMIN_TOKEN: '' })).code,
    1
  )
  assert.equal(requests.length, 0)
  const applied = await run([...args, '--apply'])
  assert.equal(applied.code, 0)
  assert.match(applied.output, /Published chatbot test-bot/)
  assert.equal(requests.length, 1)
  assert.equal(
    requests[0].headers.authorization,
    'Bearer synthetic-admin-token'
  )
  assert.deepEqual(requests[0].body, {
    operationName: 'ApproveChatbotPublication',
    variables: { id: 'test-bot' },
    extensions: {
      persistedQuery: { version: 1, sha256Hash: 'synthetic-hash' },
    },
  })
  for (const failure of [
    { errors: [{ message: 'synthetic-admin-token' }] },
    { data: { approveChatbotPublication: null } },
    {
      data: { approveChatbotPublication: { id: 'other', status: 'PUBLISHED' } },
    },
    {
      data: { approveChatbotPublication: { id: 'test-bot', status: 'DRAFT' } },
    },
  ]) {
    payload = failure
    const result = await run([...args, '--apply'])
    assert.equal(result.code, 1)
    assert.ok(!result.output.includes('synthetic-admin-token'))
  }
  status = 403
  assert.equal((await run([...args, '--apply'])).code, 1)
  assert.equal(requests.length, 6, 'each apply makes exactly one request')
})
