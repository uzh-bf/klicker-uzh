import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import test, { after, before } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { Pool } from 'pg'
import { baseExercise, digest, sourceFor } from './exercise.mjs'
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

before(async () => {
  await requireDisposableDatabase(pool)
  await pool.query(
    'DROP TABLE IF EXISTS artifact_assignment, artifact_revision, artifact CASCADE'
  )
  await initialize(pool)
  server = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: {
      ...process.env,
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
      ARTIFACT_PARTICIPANT_IDS: 'participant-a,participant-b',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  await waitForServer()
})

after(async () => {
  if (server?.exitCode === null) {
    server.kill('SIGTERM')
    await Promise.race([once(server, 'exit'), delay(3000)])
  }
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
