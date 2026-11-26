import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { Pool } from 'pg'
import { digest, frame, parseSource } from './exercise.mjs'
import {
  bindAssignment,
  initialize,
  publish,
  readAssignment,
  readRevision,
} from './repository.mjs'

function config(name) {
  const value = process.env[name]
  if (!value?.trim()) throw new Error('Missing ' + name)
  return value
}
function origin(name) {
  const url = new URL(config(name))
  if (url.protocol !== 'https:' || url.origin !== config(name))
    throw new Error('Invalid ' + name)
  return url.origin
}
const publicOrigin = origin('ARTIFACT_PUBLIC_ORIGIN')
const manage = origin('ARTIFACT_MANAGE_ORIGIN')
const pwa = origin('ARTIFACT_PWA_ORIGIN')
const parents = [manage, pwa]
if (parents.includes(publicOrigin))
  throw new Error('Viewer requires its own origin')
const lcKey = config('ARTIFACT_LC_TOKEN')
const klickerKey = config('ARTIFACT_KLICKER_TOKEN')
if (lcKey === klickerKey || Math.min(lcKey.length, klickerKey.length) < 32)
  throw new Error('Invalid caller credentials')
const lecturer = config('ARTIFACT_LC_SUBJECT')
const lecturerKlicker = config('ARTIFACT_KLICKER_SUBJECT')
const expiry = Date.parse(config('ARTIFACT_EXPIRES_AT'))
if (!Number.isFinite(expiry)) throw new Error('Missing pilot expiry')
const course = process.env.ARTIFACT_COURSE_ID
const participants = new Set(
  (process.env.ARTIFACT_PARTICIPANT_IDS || '').split(',').filter(Boolean)
)
if (participants.size > 2) throw new Error('Pilot has at most two participants')
const shell = frame(parents)
const pool = new Pool({ connectionString: config('DATABASE_URL'), max: 3 })
await initialize(pool)

const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}'
const canonical = new RegExp('^/a/(' + uuid + ')$')
const read = new RegExp(
  '^/v1/artifacts/(' + uuid + ')(?:/revisions/(' + uuid + '))?$'
)
function authorized(header, token) {
  const supplied = Buffer.from(header || '')
  const expected = Buffer.from('Bearer ' + token)
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  )
}
function fail(status, message) {
  throw Object.assign(new Error(message), { status })
}
async function readBody(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json')
    fail(415, 'JSON required')
  const parts = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 150000) fail(413, 'Request too large')
    parts.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString('utf8'))
  } catch {
    fail(400, 'Invalid JSON')
  }
}

function result(row) {
  const { html, ...revision } = row
  const exercise = parseSource(html, { strict: false })
  return {
    ...revision,
    url: publicOrigin + '/a/' + row.artifactId,
    title: exercise.title,
    exercise,
    renderedDigest: digest(shell.html + '\n' + JSON.stringify(exercise)),
  }
}

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(value))
}

function health(req, res) {
  json(res, 200, { ready: true })
}

function viewerFrame(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': shell.policy,
  })
  res.end(shell.html)
}

function redirectArtifact(req, res, { artifactId }) {
  res.writeHead(303, { Location: manage + '/artifacts/' + artifactId })
  res.end()
}

async function publishRevision(req, res) {
  if (!authorized(req.headers.authorization, lcKey)) fail(403, 'Forbidden')
  const body = await readBody(req)
  if (!body || body.subject !== lecturer) fail(403, 'Forbidden')
  if (
    typeof body.sourceId !== 'string' ||
    !body.sourceId.trim() ||
    body.sourceId.length > 512
  )
    fail(422, 'Invalid source identifier')
  try {
    parseSource(body.html)
  } catch {
    fail(422, 'Use the approved calculator template and bounded cash flows')
  }
  json(
    res,
    200,
    result(await publish(pool, lecturer, body.sourceId, body.html))
  )
}

async function assignRevision(req, res) {
  if (
    !authorized(req.headers.authorization, klickerKey) ||
    req.headers['x-artifact-subject'] !== lecturerKlicker
  )
    fail(403, 'Forbidden')
  const body = await readBody(req)
  if (!course || body?.courseId !== course) fail(403, 'Course unavailable')
  if (
    typeof body.instanceId !== 'string' ||
    !body.instanceId ||
    body.instanceId.length > 128 ||
    !new RegExp('^' + uuid + '$').test(body.artifactId) ||
    !new RegExp('^' + uuid + '$').test(body.revisionId)
  )
    fail(422, 'Invalid pin')
  if (!(await bindAssignment(pool, lecturer, body)))
    fail(409, 'Instance binding unavailable')
  json(res, 200, {
    artifactId: body.artifactId,
    revisionId: body.revisionId,
  })
}

async function readArtifact(req, res, { artifactId, revisionId }) {
  if (!authorized(req.headers.authorization, klickerKey)) fail(403, 'Forbidden')
  const subject = req.headers['x-artifact-subject']
  const operation = req.headers['x-artifact-operation']
  let row
  if (operation === 'run') {
    const expires = Number(req.headers['x-artifact-expires'])
    const now = Date.now() / 1000
    if (
      !course ||
      req.headers['x-artifact-course'] !== course ||
      !participants.has(subject) ||
      req.headers['x-artifact-audience'] !== 'artifact-pilot' ||
      !revisionId ||
      !Number.isInteger(expires) ||
      expires <= now ||
      expires > now + 31
    )
      fail(403, 'Forbidden')
    row = await readAssignment(
      pool,
      course,
      req.headers['x-artifact-instance'],
      artifactId,
      revisionId
    )
  } else {
    if (subject !== lecturerKlicker || operation) fail(403, 'Forbidden')
    row = await readRevision(pool, lecturer, artifactId, revisionId)
  }
  if (!row) fail(404, 'Revision unavailable')
  json(res, 200, result(row))
}

const routes = new Map([
  ['GET /health', health],
  ['GET /frame', viewerFrame],
  ['POST /v1/revisions', publishRevision],
  ['POST /v1/assignments', assignRevision],
])

function matchRoute(req) {
  if (typeof req.url !== 'string') return null
  const handler = routes.get(req.method + ' ' + req.url)
  if (handler) return { handler }
  if (req.method !== 'GET') return null
  const link = canonical.exec(req.url)
  if (link) return { handler: redirectArtifact, artifactId: link[1] }
  const target = read.exec(req.url)
  if (target)
    return {
      handler: readArtifact,
      artifactId: target[1],
      revisionId: target[2],
    }
  return null
}

const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  try {
    const route = matchRoute(req)
    if (route?.handler === health) return health(req, res)
    if (Date.now() >= expiry) fail(403, 'Pilot closed')
    if (!route) fail(404, 'Unavailable')
    await route.handler(req, res, route)
  } catch (error) {
    json(res, error.status || 500, {
      error: error.status ? error.message : 'Request failed',
    })
  }
})
server.requestTimeout = 10000
server.listen(8080, '0.0.0.0')
process.on('SIGTERM', () => server.close(() => pool.end()))
