import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { ExpressHttpHandler, LtijsError } from 'ltijs'
import { createRequestLogging } from '../src/requestLogging.ts'

test('failed requests produce bounded diagnostics without DEBUG or HTTP changes', async (t) => {
  const previousDebug = process.env.DEBUG
  delete process.env.DEBUG
  t.after(() => {
    if (previousDebug === undefined) delete process.env.DEBUG
    else process.env.DEBUG = previousDebug
  })
  const records = []
  const consoleCalls = []
  t.mock.method(console, 'error', (...args) => {
    consoleCalls.push(args)
    records.push(JSON.parse(args[0]))
  })
  const logging = createRequestLogging('https://tool.example.test')
  const handler = new ExpressHttpHandler(logging.logger, {
    port: 0,
    cors: false,
  })
  handler.app.use(logging.middleware)
  let arrivals = 0
  const bothEntered = Promise.withResolvers()
  handler.registerRoute('/', ['POST'], async (request) => {
    if (arrivals < 2) {
      arrivals += 1
      if (arrivals === 2) bothEntered.resolve()
      await bothEntered.promise
    }
    throw new LtijsError(
      request.body.fixture_error === 'SESSION_NOT_FOUND'
        ? 'SESSION_NOT_FOUND'
        : 'INVALID_STATE'
    )
  })
  handler.registerRoute('/login', ['POST'], async (_request, response) => {
    response.json({ ok: true })
  })
  handler.registerRoute('/handoff', ['GET'], async (_request, response) => {
    response.status(401).json({ error: 'invalid_launch' })
  })
  handler.registerRoute('/unrecognized', ['POST'], async () => {
    throw new Error('SYNTHETIC_PRIVATE_ERROR')
  })
  const server = createServer(handler.app)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  })
  const base = `http://127.0.0.1:${server.address().port}`
  const privateValues = {
    id_token: 'SYNTHETIC_PRIVATE_ID_TOKEN',
    state: 'SYNTHETIC_PRIVATE_STATE',
    ignored: 'SYNTHETIC_PRIVATE_BODY',
  }
  const post = (path, fields, headers = {}) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        ...headers,
      },
      body: new URLSearchParams({ ...privateValues, ...fields }),
    })

  const results = await Promise.all([
    post(
      '/?jwt=SYNTHETIC_PRIVATE_QUERY',
      { ltijs_recovered_state: '' },
      {
        'sec-fetch-site': 'same-origin',
        'sec-fetch-dest': 'iframe',
        cookie: 'session=SYNTHETIC_PRIVATE_COOKIE',
        authorization: 'Bearer SYNTHETIC_PRIVATE_AUTHORIZATION',
        'user-agent': 'SYNTHETIC_PRIVATE_BROWSER',
        referer: 'https://example.test/SYNTHETIC_PRIVATE_REFERRER',
        origin: 'https://SYNTHETIC_PRIVATE_ORIGIN.example.test',
      }
    ),
    post(
      '/',
      {
        ltijs_recovered_state: 'SYNTHETIC_PRIVATE_RECOVERY',
        fixture_error: 'SESSION_NOT_FOUND',
      },
      {
        'sec-fetch-site': 'cross-site',
      }
    ),
  ])
  for (const [index, response] of results.entries()) {
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      error: 'LtijsError',
      message: index === 0 ? 'INVALID_STATE' : 'SESSION_NOT_FOUND',
    })
  }
  assert.equal(records.length, 2)
  assert.equal(
    records.find((r) => r.recoveredState === 'empty').secFetchSite,
    'same-origin'
  )
  assert.equal(
    records.find((r) => r.recoveredState === 'present').secFetchSite,
    'cross-site'
  )
  assert.equal(
    records.find((r) => r.recoveredState === 'empty').secFetchDest,
    'iframe'
  )
  for (const record of records) {
    assert.equal(record.event, 'lti_request_failed')
    assert.equal(record.secFetchMode, 'cors')
    assert.equal(
      record.errorCode,
      record.recoveredState === 'empty' ? 'INVALID_STATE' : 'SESSION_NOT_FOUND'
    )
    assert.equal(record.status, 400)
    assert.equal(record.route, '/')
    assert.equal(record.method, 'POST')
    assert.equal(record.idTokenPresent, true)
    assert.equal(record.statePresent, true)
    assert.deepEqual(
      Object.keys(record).sort(),
      [
        'errorCode',
        'event',
        'idTokenPresent',
        'method',
        'origin',
        'originCompatibilityApplied',
        'recoveredState',
        'route',
        'secFetchDest',
        'secFetchMode',
        'secFetchSite',
        'statePresent',
        'status',
        'ts',
      ].sort()
    )
  }

  const crossSite = await post(
    '/',
    { ltijs_recovered_state: 'SYNTHETIC_PRIVATE_RECOVERY' },
    { 'sec-fetch-site': 'cross-site' }
  )
  assert.equal(crossSite.status, 400)
  assert.equal((await crossSite.json()).message, 'INVALID_STATE')
  assert.equal(records.at(-1).recoveredState, 'present')
  assert.equal(records.at(-1).secFetchSite, 'cross-site')
  assert.equal(records.at(-1).errorCode, 'INVALID_STATE')

  await post('/', {})
  assert.equal(records.at(-1).recoveredState, 'missing')
  assert.equal(records.at(-1).secFetchSite, 'missing')
  await fetch(`${base}/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ltijs_recovered_state: ['SYNTHETIC_PRIVATE_ARRAY'],
    }),
  })
  assert.equal(records.at(-1).recoveredState, 'invalid_type')
  assert.equal(records.at(-1).idTokenPresent, false)
  assert.equal(records.at(-1).statePresent, false)

  const success = await post('/login', {})
  assert.equal(success.status, 200)
  assert.deepEqual(await success.json(), { ok: true })
  assert.equal(records.length, 5)
  const handoff = await fetch(`${base}/handoff?ltik=SYNTHETIC_PRIVATE_HANDOFF`)
  assert.equal(handoff.status, 401)
  assert.deepEqual(await handoff.json(), { error: 'invalid_launch' })
  assert.equal(records.at(-1).errorCode, 'HTTP_ERROR')
  assert.equal(records.at(-1).route, '/handoff')
  assert.equal(records.at(-1).method, 'GET')

  const unknown = await post(
    '/unrecognized?private=SYNTHETIC_PRIVATE_URL',
    {},
    {
      'sec-fetch-site': 'SYNTHETIC_PRIVATE_HEADER',
      'sec-fetch-dest': 'SYNTHETIC_PRIVATE_DEST',
    }
  )
  assert.equal(unknown.status, 500)
  assert.deepEqual(await unknown.json(), { error: 'INTERNAL_SERVER_ERROR' })
  assert.equal(records.at(-1).route, 'other')
  assert.equal(records.at(-1).secFetchSite, 'other')
  assert.equal(records.at(-1).secFetchDest, 'other')
  assert.equal(records.at(-1).errorCode, 'UNCLASSIFIED_ERROR')

  const malformed = await fetch(`${base}/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"private":"SYNTHETIC_PRIVATE_MALFORMED",',
  })
  assert.equal(malformed.status, 400)
  assert.equal((await malformed.json()).error, 'SyntaxError')
  assert.deepEqual(Object.keys(records.at(-1)).sort(), [
    'component',
    'errorCode',
    'event',
    'ts',
  ])
  assert.equal(records.at(-1).event, 'lti_provider_error')
  assert.equal(records.at(-1).errorCode, 'UNCLASSIFIED_ERROR')
  assert.equal(records.at(-1).component, 'http_handler')
  assert.equal(records.length, 8)
  for (const args of consoleCalls) {
    assert.equal(args.length, 1)
    assert.equal(typeof args[0], 'string')
  }
  assert.equal(
    JSON.stringify(consoleCalls).includes('SYNTHETIC_PRIVATE'),
    false
  )
})
