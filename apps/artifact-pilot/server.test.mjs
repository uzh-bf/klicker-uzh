import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import test, { after, before } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { Pool } from 'pg'
import { baseExercise, digest, parseSource, sourceFor } from './exercise.mjs'
import { initialize } from './repository.mjs'
import { requireDisposableDatabase } from './test-database.mjs'

const databaseUrl = process.env.ARTIFACT_TEST_DATABASE_URL
const baseUrl = 'http://127.0.0.1:8080'
const lecturer = 'artifact-lecturer'
const lecturerKlicker = 'artifact-klicker-subject'
const lecturerToken = 'lecturer-token-'.padEnd(40, 'l')
const klickerToken = 'klicker-token-'.padEnd(40, 'k')
const pool = new Pool({ connectionString: databaseUrl })
let server

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      ...headers,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { response, body: await response.json() }
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return
    } catch {}
    if (server.exitCode !== null)
      throw new Error('Publisher test server exited before becoming ready')
    await delay(100)
  }
  throw new Error('Publisher test server did not become ready')
}

async function startPublisher(authorEnv = {}, args = ['server.mjs']) {
  server = spawn(process.execPath, args, {
    cwd: new URL('.', import.meta.url),
    env: {
      ...process.env,
      PILOT_AUTHORING_ENABLED: 'false',
      PILOT_AUTHORING_LITELLM_KEY: '',
      DATABASE_URL: databaseUrl,
      ARTIFACT_PUBLIC_ORIGIN: 'https://artifact.example',
      ARTIFACT_MANAGE_ORIGIN: 'https://manage.example',
      ARTIFACT_PWA_ORIGIN: 'https://pwa.example',
      ARTIFACT_LC_TOKEN: lecturerToken,
      ARTIFACT_KLICKER_TOKEN: klickerToken,
      ARTIFACT_LC_SUBJECT: lecturer,
      ARTIFACT_KLICKER_SUBJECT: lecturerKlicker,
      ARTIFACT_EXPIRES_AT: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      ARTIFACT_COURSE_ID: 'course',
      ...authorEnv,
      ARTIFACT_PARTICIPANT_IDS: 'participant-a,participant-b',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  await waitForServer()
}

async function stopPublisher() {
  if (server?.exitCode === null && server.signalCode === null) {
    const exited = once(server, 'exit')
    server.kill('SIGTERM')
    await exited
  }
}

before(async () => {
  await requireDisposableDatabase(pool)
  await pool.query(
    'DROP TABLE IF EXISTS artifact_author_request, artifact_assignment, artifact_revision, artifact CASCADE'
  )
  await initialize(pool)
  await startPublisher()
})

after(async () => {
  await stopPublisher()
  await pool.end()
})

test('publisher routes keep admission strict and stored history readable', async (t) => {
  const sourceId = `source-${randomUUID()}`
  const source = sourceFor(baseExercise)
  const rendererEnd = source.lastIndexOf('</script>')
  assert.ok(
    rendererEnd > 0,
    'expected a renderer script in the canonical source'
  )
  const historical =
    source.slice(0, rendererEnd) +
    '\n// renderer program from a later template version\n' +
    source.slice(rendererEnd)
  assert.notEqual(historical, source)

  await t.test('bearer and subject gates reject publisher writes', async () => {
    const noBearer = await request('/v1/revisions', {
      method: 'POST',
      body: { subject: lecturer, sourceId, html: source },
    })
    assert.equal(noBearer.response.status, 403)
    const foreignSubject = await request('/v1/revisions', {
      method: 'POST',
      headers: bearer(lecturerToken),
      body: { subject: 'other-lecturer', sourceId, html: source },
    })
    assert.equal(foreignSubject.response.status, 403)
  })

  await t.test(
    'publish admission rejects a changed renderer template',
    async () => {
      const rejected = await request('/v1/revisions', {
        method: 'POST',
        headers: bearer(lecturerToken),
        body: { subject: lecturer, sourceId, html: historical },
      })
      assert.equal(rejected.response.status, 422)
    }
  )

  const first = await request('/v1/revisions', {
    method: 'POST',
    headers: bearer(lecturerToken),
    body: { subject: lecturer, sourceId, html: source },
  })
  assert.equal(first.response.status, 200)
  assert.equal(first.body.exercise.title, baseExercise.title)

  const retry = await request('/v1/revisions', {
    method: 'POST',
    headers: bearer(lecturerToken),
    body: { subject: lecturer, sourceId, html: source },
  })
  assert.equal(retry.response.status, 200)
  assert.equal(retry.body.revisionId, first.body.revisionId)

  const second = await request('/v1/revisions', {
    method: 'POST',
    headers: bearer(lecturerToken),
    body: {
      subject: lecturer,
      sourceId,
      html: sourceFor({ ...baseExercise, title: 'Revision two' }),
    },
  })
  assert.equal(second.response.status, 200)
  assert.equal(second.body.artifactId, first.body.artifactId)
  assert.notEqual(second.body.revisionId, first.body.revisionId)

  await t.test(
    'a stored revision remains readable after renderer drift',
    async () => {
      const artifactId = randomUUID()
      const revisionId = randomUUID()
      await pool.query(
        'INSERT INTO artifact (id, owner, source_id) VALUES ($1, $2, $3)',
        [artifactId, lecturer, `historical-${sourceId}`]
      )
      await pool.query(
        `INSERT INTO artifact_revision
         (id, artifact_id, version, digest, html)
       VALUES ($1, $2, 1, $3, $4)`,
        [revisionId, artifactId, digest(historical), historical]
      )
      const read = await request(
        `/v1/artifacts/${artifactId}/revisions/${revisionId}`,
        {
          headers: {
            ...bearer(klickerToken),
            'x-artifact-subject': lecturerKlicker,
          },
        }
      )
      assert.equal(read.response.status, 200)
      assert.equal(read.body.exercise.title, baseExercise.title)

      const historicalInstance = `historical-instance-${sourceId}`
      const historicalAssignment = await request('/v1/assignments', {
        method: 'POST',
        headers: {
          ...bearer(klickerToken),
          'x-artifact-subject': lecturerKlicker,
        },
        body: {
          courseId: 'course',
          instanceId: historicalInstance,
          artifactId,
          revisionId,
        },
      })
      assert.equal(historicalAssignment.response.status, 200)
      const pinnedRead = await request(
        `/v1/artifacts/${artifactId}/revisions/${revisionId}`,
        {
          headers: {
            ...bearer(klickerToken),
            'x-artifact-operation': 'run',
            'x-artifact-subject': 'participant-a',
            'x-artifact-course': 'course',
            'x-artifact-instance': historicalInstance,
            'x-artifact-audience': 'artifact-pilot',
            'x-artifact-expires': String(Math.floor(Date.now() / 1000) + 10),
          },
        }
      )
      assert.equal(pinnedRead.response.status, 200)
      assert.equal(pinnedRead.body.exercise.title, baseExercise.title)
    }
  )

  const pin = {
    courseId: 'course',
    instanceId: `instance-${sourceId}`,
    artifactId: first.body.artifactId,
    revisionId: first.body.revisionId,
  }
  const assignmentHeaders = {
    ...bearer(klickerToken),
    'x-artifact-subject': lecturerKlicker,
  }

  await t.test(
    'assignment routes enforce caller, subject and pin contracts',
    async () => {
      const foreignSubject = await request('/v1/assignments', {
        method: 'POST',
        headers: { ...bearer(klickerToken), 'x-artifact-subject': 'other' },
        body: pin,
      })
      assert.equal(foreignSubject.response.status, 403)
      const invalidPin = await request('/v1/assignments', {
        method: 'POST',
        headers: assignmentHeaders,
        body: { ...pin, artifactId: 'invalid' },
      })
      assert.equal(invalidPin.response.status, 422)
      const assigned = await request('/v1/assignments', {
        method: 'POST',
        headers: assignmentHeaders,
        body: pin,
      })
      assert.equal(assigned.response.status, 200)
      const replay = await request('/v1/assignments', {
        method: 'POST',
        headers: assignmentHeaders,
        body: pin,
      })
      assert.equal(replay.response.status, 200)
      const conflictingPin = await request('/v1/assignments', {
        method: 'POST',
        headers: assignmentHeaders,
        body: { ...pin, revisionId: second.body.revisionId },
      })
      assert.equal(conflictingPin.response.status, 409)
    }
  )

  await t.test(
    'staff reads require the Klicker caller and lecturer subject',
    async () => {
      const unauthenticated = await request(
        `/v1/artifacts/${pin.artifactId}/revisions/${pin.revisionId}`
      )
      assert.equal(unauthenticated.response.status, 403)
      const read = await request(
        `/v1/artifacts/${pin.artifactId}/revisions/${pin.revisionId}`,
        {
          headers: {
            ...bearer(klickerToken),
            'x-artifact-subject': lecturerKlicker,
          },
        }
      )
      assert.equal(read.response.status, 200)
      assert.equal(read.body.exercise.title, baseExercise.title)
    }
  )

  await t.test(
    'participant reads enforce the run claim window and subject',
    async () => {
      const runHeaders = {
        ...bearer(klickerToken),
        'x-artifact-operation': 'run',
        'x-artifact-subject': 'participant-a',
        'x-artifact-course': 'course',
        'x-artifact-instance': pin.instanceId,
        'x-artifact-audience': 'artifact-pilot',
        'x-artifact-expires': String(Math.floor(Date.now() / 1000) + 10),
      }
      const valid = await request(
        `/v1/artifacts/${pin.artifactId}/revisions/${pin.revisionId}`,
        { headers: runHeaders }
      )
      assert.equal(valid.response.status, 200)
      const wrongCourse = await request(
        `/v1/artifacts/${pin.artifactId}/revisions/${pin.revisionId}`,
        { headers: { ...runHeaders, 'x-artifact-course': 'other-course' } }
      )
      assert.equal(wrongCourse.response.status, 403)
      const outsider = await request(
        `/v1/artifacts/${pin.artifactId}/revisions/${pin.revisionId}`,
        { headers: { ...runHeaders, 'x-artifact-subject': 'outsider' } }
      )
      assert.equal(outsider.response.status, 403)
    }
  )

  const missing = await request(
    `/v1/artifacts/${randomUUID()}/revisions/${randomUUID()}`,
    {
      headers: {
        ...bearer(klickerToken),
        'x-artifact-subject': lecturerKlicker,
      },
    }
  )
  assert.equal(missing.response.status, 404)
})

test('authoring admits one priced call and replays only its canonical result', async (t) => {
  const body = {
    subject: lecturer,
    requestId: randomUUID(),
    prompt: 'Add a coupon',
  }
  const author = (payload = body, token = lecturerToken) =>
    request('/v1/author', {
      method: 'POST',
      headers: bearer(token),
      body: payload,
    })

  assert.equal((await author()).response.status, 503)
  await stopPublisher()
  const received = Promise.withResolvers()
  const dispatch = Promise.withResolvers()
  let calls = 0
  const model = 'aibuddy/azure/gpt-6-luna'
  const key = 'synthetic-author-key-'.padEnd(40, 'k')
  const revised = {
    ...baseExercise,
    cashflows: [...baseExercise.cashflows, { when: 'year-end', amount: 50 }],
  }
  const upstream = createServer(async (req, res) => {
    calls++
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    received.resolve({
      path: req.url,
      key: req.headers.authorization,
      body: JSON.parse(Buffer.concat(chunks)),
    })
    await dispatch.promise
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(
      JSON.stringify({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: JSON.stringify(
                calls === 1 ? revised : { html: '<main></main>' }
              ),
            },
          },
        ],
        usage: { prompt_tokens: 120, completion_tokens: 48 },
      })
    )
  })
  upstream.listen(0, '127.0.0.1')
  await once(upstream, 'listening')
  t.after(() => {
    dispatch.resolve()
    upstream.closeAllConnections()
    upstream.close()
  })
  const base = 'http://litellm.stg-litellm.svc.cluster.local:4000/v1'
  const env = {
    PILOT_AUTHORING_ENABLED: 'true',
    PILOT_AUTHORING_LITELLM_BASE_URL: base,
    PILOT_AUTHORING_MODEL: model,
    PILOT_AUTHORING_LITELLM_KEY: key,
  }
  // Substitute only the transport destination in this test process. The stub
  // receives the publisher's real HTTP headers and body; other targets fail.
  const args = [
    '--input-type=module',
    '-e',
    `
    const send = globalThis.fetch
    globalThis.fetch = (url, init) => {
      if (url !== ${JSON.stringify(base + '/chat/completions')}) throw new Error('Unexpected test target')
      return send('http://127.0.0.1:${upstream.address().port}/v1/chat/completions', init)
    }
    await import('./server.mjs')
  `,
  ]
  await startPublisher({ ...env, PILOT_AUTHORING_MODEL: 'other' }, args)
  assert.equal((await author()).response.status, 503)
  await stopPublisher()
  await startPublisher(
    { ...env, ARTIFACT_EXPIRES_AT: new Date(0).toISOString() },
    args
  )
  assert.equal((await author()).response.status, 403)
  await stopPublisher()
  await startPublisher(env, args)
  assert.equal((await author(body, klickerToken)).response.status, 403)
  assert.equal(
    (await author({ ...body, subject: 'other' })).response.status,
    403
  )
  assert.equal(
    (await author({ ...body, prompt: 'é'.repeat(1025) })).response.status,
    422
  )
  assert.equal(
    (await author({ ...body, requestId: 'invalid' })).response.status,
    422
  )
  assert.equal((await author({ ...body, price: 0 })).response.status, 422)
  assert.equal(calls, 0)
  assert.equal(
    (await pool.query('SELECT count(*)::int AS n FROM artifact_author_request'))
      .rows[0].n,
    0
  )

  // Leave room for exactly one reservation in the disposable ledger.
  await pool.query(
    'INSERT INTO artifact_author_request (id, request_digest, reserved_cents, html) VALUES ($1,$2,182,$3)',
    [randomUUID(), digest('prior'), 'prior result']
  )
  const winner = author()
  const outbound = await Promise.race([
    received.promise,
    winner.then(({ response }) => {
      throw new Error(
        'Expected an upstream request, received ' + response.status
      )
    }),
  ])
  assert.equal(outbound.path, '/v1/chat/completions')
  assert.equal(outbound.key, 'Bearer ' + key)
  assert.equal(outbound.body.model, model)
  assert.equal(outbound.body.messages.at(-1).content, body.prompt)
  assert.equal(outbound.body.num_retries, 0)
  assert.equal(outbound.body.disable_fallbacks, true)
  assert.equal(outbound.body.max_completion_tokens, 768)
  const concurrent = await Promise.all([
    author(),
    author({ ...body, requestId: randomUUID() }),
  ])
  assert.deepEqual(
    concurrent.map(({ response }) => response.status),
    [409, 409]
  )
  dispatch.resolve()
  const completed = await winner
  assert.equal(completed.response.status, 200)
  assert.deepEqual(parseSource(completed.body.html), revised)
  const saved = await request('/v1/revisions', {
    method: 'POST',
    headers: bearer(lecturerToken),
    body: {
      subject: lecturer,
      sourceId: randomUUID(),
      html: completed.body.html,
    },
  })
  assert.equal(saved.response.status, 200)
  assert.equal(saved.body.digest, digest(completed.body.html))
  assert.deepEqual((await author()).body, completed.body)
  assert.equal(
    (await author({ ...body, prompt: 'Different' })).response.status,
    409
  )
  assert.equal(
    (await author({ ...body, requestId: randomUUID() })).response.status,
    429
  )
  assert.equal(calls, 1)

  await pool.query(
    'DELETE FROM artifact_author_request WHERE request_digest = $1',
    [digest('prior')]
  )
  const invalid = { ...body, requestId: randomUUID() }
  assert.equal((await author(invalid)).response.status, 502)
  assert.equal((await author(invalid)).response.status, 409)
  assert.equal(
    (await author({ ...body, requestId: randomUUID() })).response.status,
    409
  )
  assert.equal(calls, 2)
  const ledger = await pool.query(
    'SELECT sum(reserved_cents)::int AS cents, count(*) FILTER (WHERE html IS NULL)::int AS outstanding FROM artifact_author_request'
  )
  assert.deepEqual(ledger.rows[0], { cents: 36, outstanding: 1 })
})
