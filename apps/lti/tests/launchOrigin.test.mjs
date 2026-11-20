import assert from 'node:assert/strict'
import { createHmac, generateKeyPairSync, randomUUID, sign } from 'node:crypto'
import { once } from 'node:events'
import { createServer, request as httpRequest } from 'node:http'
import { test } from 'node:test'
import { ExpressHttpHandler, IdTokenValidationMethod, Provider } from 'ltijs'
import {
  createLaunchOriginCompatibility,
  parseToolOrigin,
} from '../src/launchOrigin.ts'
import { createRequestLogging } from '../src/requestLogging.ts'

const keys = () => {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 })
  return {
    public: pair.publicKey.export({ type: 'spki', format: 'pem' }),
    private: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }),
  }
}
const toolKeys = keys()
const platformKeys = keys()
const claim = 'https://purl.imsglobal.org/spec/lti/claim/'
function jwt(payload, privateKey) {
  const input = [{ alg: 'RS256', typ: 'JWT' }, payload]
    .map((part) => Buffer.from(JSON.stringify(part)).toString('base64url'))
    .join('.')
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`
}

async function fixture(t) {
  const platform = {
    id: 'synthetic-platform',
    url: 'https://platform.example.test',
    clientId: 'synthetic-client',
    name: 'Synthetic platform',
    authenticationEndpoint: 'https://platform.example.test/authorize',
    accessTokenEndpoint: 'https://platform.example.test/token',
    active: true,
    keys: toolKeys,
    idTokenValidation: {
      method: IdTokenValidationMethod.RsaKey,
      key: platformKeys.public,
    },
  }
  const nonces = new Set()
  let accepted = 0
  const database = {
    async getPlatforms() {
      return [platform]
    },
    async saveNonce(nonce) {
      nonces.add(nonce)
      return nonce
    },
    async consumeNonce(nonce) {
      return nonces.delete(nonce)
    },
    async saveIdToken() {
      return randomUUID()
    },
  }
  const logger = { debug() {}, warn() {}, error() {} }
  const httpHandler = new ExpressHttpHandler(logger, { port: 0, cors: false })
  const server = createServer(httpHandler.app)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  })
  const origin = `http://127.0.0.1:${server.address().port}`
  const diagnostics = []
  t.mock.method(console, 'error', (line) => diagnostics.push(JSON.parse(line)))
  const logging = createRequestLogging(origin)
  httpHandler.app.use(logging.middleware)
  httpHandler.app.use(
    createLaunchOriginCompatibility(origin, logging.originCompatibility)
  )
  httpHandler.app.get('/handoff', (_req, res) =>
    res.status(401).json({ error: 'invalid_launch' })
  )
  const provider = new Provider({
    logger: logging.logger,
    databaseManager: database,
    httpHandler,
    routes: { loginRoute: '/login', launchRoute: '/', keysetRoute: '/keys' },
  })
  provider.onConnect(async (_context, _request, response) => {
    accepted += 1
    response.json({ accepted: true })
  })
  async function launch() {
    const response = await fetch(`${origin}/login`, {
      method: 'POST',
      body: new URLSearchParams({
        iss: platform.url,
        client_id: platform.clientId,
        login_hint: 'synthetic',
        target_link_uri: origin,
      }),
    })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
    const html = await response.text()
    const data = JSON.parse(
      html.match(
        /<script type="application\/json" id="ltijs-login-data">([\s\S]*?)<\/script>/
      )[1]
    )
    const now = Math.floor(Date.now() / 1000)
    const claims = {
      iss: platform.url,
      aud: platform.clientId,
      sub: 'synthetic-learner',
      iat: now,
      exp: now + 600,
      nonce: new URL(data.targetUrl).searchParams.get('nonce'),
      [`${claim}version`]: '1.3.0',
      [`${claim}deployment_id`]: 'synthetic-deployment',
      [`${claim}message_type`]: 'LtiResourceLinkRequest',
      [`${claim}roles`]: [
        'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner',
      ],
      [`${claim}target_link_uri`]: origin,
      [`${claim}resource_link`]: { id: 'synthetic-resource' },
    }
    return {
      id_token: jwt(claims, platformKeys.private),
      state: data.state,
      ltijs_recovered_state: data.recoveryToken,
    }
  }
  async function post(body, headers = {}) {
    const values = Object.fromEntries(
      Object.entries({
        'content-type': 'application/x-www-form-urlencoded',
        origin,
        'sec-fetch-site': 'none',
        ...headers,
      }).filter(([, value]) => value !== undefined)
    )
    return new Promise((resolve, reject) => {
      const req = httpRequest(
        origin,
        { method: 'POST', headers: values },
        (res) => {
          const chunks = []
          res.on('data', (chunk) => chunks.push(chunk))
          res.on('end', () =>
            resolve(
              new Response(Buffer.concat(chunks), {
                status: res.statusCode,
                headers: res.headers,
              })
            )
          )
        }
      )
      req.on('error', reject)
      req.end(new URLSearchParams(body).toString())
    })
  }
  return { origin, launch, post, diagnostics, accepted: () => accepted }
}

test('a signed recovery launch with exact tool Origin accepts Sec-Fetch-Site none', async (t) => {
  const f = await fixture(t)
  const response = await f.post(await f.launch())
  assert.equal(response.status, 200, await response.text())
  assert.equal(f.accepted(), 1)
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  assert.equal(f.diagnostics[0].event, 'lti_origin_compatibility')
  assert.equal(f.diagnostics[0].origin, 'same-origin')
  assert.equal(f.diagnostics[0].secFetchSite, 'none')
  assert.equal(f.diagnostics[0].originCompatibilityApplied, true)
})

test('the real provider accepts a valid same-origin baseline', async (t) => {
  const f = await fixture(t)
  const response = await f.post(await f.launch(), {
    'sec-fetch-site': 'same-origin',
  })
  assert.equal(response.status, 200, await response.text())
  assert.equal(f.accepted(), 1)
})

for (const [name, headers] of [
  ['attacker origin', () => ({ origin: 'https://attacker.example.test' })],
  ['opaque origin', () => ({ origin: 'null' })],
  ['missing origin', () => ({ origin: undefined })],
  ['malformed origin', () => ({ origin: 'invalid' })],
  ['origin with path', (origin) => ({ origin: `${origin}/path` })],
  ['origin with trailing slash', (origin) => ({ origin: `${origin}/` })],
  ['duplicate origin', (origin) => ({ origin: [origin, origin] })],
  [
    'origin list',
    (origin) => ({ origin: `${origin} https://attacker.example.test` }),
  ],
  [
    'explicit cross-site',
    (origin) => ({ origin, 'sec-fetch-site': 'cross-site' }),
  ],
  [
    'explicit same-site',
    (origin) => ({ origin, 'sec-fetch-site': 'same-site' }),
  ],
]) {
  test(`valid tokens cannot bypass ${name} rejection or consume the nonce`, async (t) => {
    const f = await fixture(t)
    const body = await f.launch()
    const rejected = await f.post(body, headers(f.origin))
    assert.equal(rejected.status, 400)
    assert.equal(rejected.headers.get('referrer-policy'), 'no-referrer')
    assert.equal((await rejected.json()).message, 'INVALID_STATE')
    assert.equal(f.accepted(), 0)
    assert.equal(f.diagnostics.at(-1).originCompatibilityApplied, false)
    const accepted = await f.post(body)
    assert.equal(accepted.status, 200, await accepted.text())
    assert.equal(f.accepted(), 1)
  })
}

function payload(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url'))
}
function recovery(stateId, expiresAt) {
  const value = `${stateId}:${expiresAt}`
  return `${value}.${createHmac('sha256', toolKeys.private).update(value).digest('base64url')}`
}
for (const [name, corrupt] of [
  [
    'forged recovery',
    async (body) => ({ ...body, ltijs_recovered_state: 'forged' }),
  ],
  ['empty recovery', async (body) => ({ ...body, ltijs_recovered_state: '' })],
  [
    'swapped recovery',
    async (body, f) => ({
      ...body,
      ltijs_recovered_state: (await f.launch()).ltijs_recovered_state,
    }),
  ],
  [
    'state used as recovery',
    async (body) => ({ ...body, ltijs_recovered_state: body.state }),
  ],
  [
    'expired recovery',
    async (body) => ({
      ...body,
      ltijs_recovered_state: recovery(
        payload(body.state).stateId,
        Date.now() - 1000
      ),
    }),
  ],
  [
    'expired state',
    async (body) => ({
      ...body,
      state: jwt({ ...payload(body.state), exp: 1 }, toolKeys.private),
    }),
  ],
  [
    'forged state',
    async (body) => ({
      ...body,
      state: jwt(payload(body.state), platformKeys.private),
    }),
  ],
  [
    'forged ID token',
    async (body) => ({
      ...body,
      id_token: jwt(payload(body.id_token), toolKeys.private),
    }),
  ],
]) {
  test(`eligible origin cannot bypass ${name} validation`, async (t) => {
    const f = await fixture(t)
    const response = await f.post(await corrupt(await f.launch(), f))
    assert.ok(
      response.status >= 400,
      `Unexpected acceptance: ${response.status}`
    )
    assert.equal(f.accepted(), 0)
  })
}

test('a valid compatibility launch consumes its nonce only once', async (t) => {
  const f = await fixture(t)
  const body = await f.launch()
  assert.equal((await f.post(body)).status, 200)
  const replay = await f.post(body)
  assert.equal(replay.status, 400)
  assert.equal((await replay.json()).message, 'INVALID_NONCE_RECEIVED')
  assert.equal(f.accepted(), 1)
})

test('missing recovery renders recovery without accepting a launch', async (t) => {
  const f = await fixture(t)
  const { ltijs_recovered_state, ...body } = await f.launch()
  const response = await f.post(body)
  assert.equal(response.status, 200)
  assert.equal(f.accepted(), 0)
  assert.equal(response.headers.get('referrer-policy'), 'origin')
  assert.equal(f.diagnostics.length, 0)
})

test('configured tool origin excludes credentials, paths and opaque schemes', () => {
  assert.equal(
    parseToolOrigin('https://tool.example.test/'),
    'https://tool.example.test'
  )
  for (const value of [
    'null',
    'file:///tmp',
    'ftp://tool.example.test',
    'https://user:pass@tool.example.test',
    'https://tool.example.test/path',
    'https://tool.example.test/?q=1',
    'https://tool.example.test/#fragment',
  ]) {
    assert.throws(() => parseToolOrigin(value))
  }
})

test('recovery referrer policy stays scoped to a well-formed initial launch', async (t) => {
  const f = await fixture(t)
  for (const route of ['/keys', '/handoff', '/unrelated']) {
    const response = await fetch(`${f.origin}${route}`)
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  }
  for (const body of [
    {},
    { state: 'synthetic' },
    { id_token: '', state: 'synthetic' },
    { id_token: 'synthetic', state: '' },
    { ...(await f.launch()), ltijs_recovered_state: '' },
  ]) {
    const response = await f.post(body)
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
    assert.equal(f.accepted(), 0)
  }
  const response = await fetch(f.origin, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...(await f.launch()),
      ltijs_recovered_state: ['synthetic'],
    }),
  })
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  assert.equal(f.accepted(), 0)
})
