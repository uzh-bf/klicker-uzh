// Exam-shaped chat load: N students, one chat turn per student every
// INTERVAL_SECONDS, no overlap per student, synchronized start, plus a page
// reload with history fetch at a few slots. Each virtual student gets a
// participant session cookie signed with the local development APP_SECRET
// (see sessionAuth below). Meant for the local mock model route (see README); remote
// targets are refused unless explicitly acknowledged.
//
// Usage (see README for the full runbook):
//   KLICKER_BASE_URL=https://chat.klicker.<workspace>.localhost \
//     KLICKER_APP_SECRET=<dev APP_SECRET> k6 run util/load-test/chat-exam.js

import { check, sleep } from 'k6'
import { hmac } from 'k6/crypto'
import encoding from 'k6/encoding'
import exec from 'k6/execution'
import http from 'k6/http'
import { Counter, Trend } from 'k6/metrics'
import { isProductionHostname, parseOrigin } from './chatbot-login.js'

// Fixed synthetic identifiers shared with
// packages/prisma-data/src/data/seedChatExamLoad.ts.
const CHATBOT_ID = 'e0e0e0e0-0000-4000-8000-00000000c002'
const FIRST_PARTICIPANT_INDEX = 100

function intEnv(name, fallback, min, max) {
  const value = Number(__ENV[name] || fallback)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} through ${max}`)
  }
  return value
}

function resolveTarget(env) {
  const target = parseOrigin(
    env.KLICKER_BASE_URL || 'https://chat.klicker.localhost',
    'KLICKER_BASE_URL'
  )
  const host = target.hostname
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host.endsWith('.localhost')
  if (!isLocal) {
    if (isProductionHostname(host) && env.KLICKER_ALLOW_PRODUCTION !== 'true') {
      throw new Error(
        'Refusing a production host without KLICKER_ALLOW_PRODUCTION=true'
      )
    }
    if (env.KLICKER_ALLOW_REMOTE_TARGET !== 'true') {
      throw new Error(
        'Refusing a non-local host. Remote runs need KLICKER_ALLOW_REMOTE_TARGET=true and explicit authorization.'
      )
    }
    if (env.KLICKER_ALLOW_SIDE_EFFECTS !== 'true') {
      throw new Error(
        'Set KLICKER_ALLOW_SIDE_EFFECTS=true to acknowledge chat-turn writes and provider cost on a remote host'
      )
    }
    if (target.protocol !== 'https') {
      throw new Error(
        'Refusing a non-local http:// target: the session cookie must not travel in plaintext'
      )
    }
  }
  return { origin: target.origin, isLocal }
}

const target = resolveTarget(__ENV)
const appSecret = __ENV.KLICKER_APP_SECRET || ''
if (!appSecret) {
  throw new Error('KLICKER_APP_SECRET (the development APP_SECRET) is required')
}

// Participant session transports. 'assessment' is the assessment chat's
// cookie (HS256, iss = APP_ORIGIN_AUTH, scope EDUID); 'regular' is today's
// chat participant_token (iss = APP_ORIGIN_API). The issuer defaults to the
// chat origin with its `chat.` host label swapped for `auth.` or `api.`, which
// matches the routed development origins; override it with
// KLICKER_AUTH_ISSUER, which is required for non-local targets because the
// deployed API and auth hosts do not follow the label swap. The cookie name can be overridden with
// KLICKER_AUTH_COOKIE.
const authVariants = {
  assessment: {
    cookie: 'next-auth.participant-session-token',
    issuerLabel: 'auth',
    scope: 'EDUID',
  },
  regular: {
    cookie: 'participant_token',
    issuerLabel: 'api',
    scope: undefined,
  },
}
const authMode = __ENV.KLICKER_AUTH_MODE || 'regular'
const variant = authVariants[authMode]
if (!variant) {
  throw new Error('KLICKER_AUTH_MODE must be assessment or regular')
}
if (!target.isLocal && !__ENV.KLICKER_AUTH_ISSUER) {
  throw new Error('Set KLICKER_AUTH_ISSUER for a non-local target')
}
const sessionAuth = {
  cookie: __ENV.KLICKER_AUTH_COOKIE || variant.cookie,
  issuer:
    __ENV.KLICKER_AUTH_ISSUER ||
    target.origin.replace('://chat.', `://${variant.issuerLabel}.`),
  scope: variant.scope,
}
if (sessionAuth.issuer === target.origin) {
  throw new Error(
    'Set KLICKER_AUTH_ISSUER: the chat host does not start with chat.'
  )
}

const students = intEnv('STUDENTS', 100, 1, 125)
const durationMinutes = intEnv('DURATION_MINUTES', 30, 1, 60)
const intervalSeconds = intEnv('INTERVAL_SECONDS', 45, 5, 600)
const maxPerStudent = intEnv('MAX_PER_STUDENT', 40, 1, 40)
const warmupSeconds = intEnv('WARMUP_SECONDS', 30, 5, 300)
const lateThresholdSeconds = intEnv('LATE_THRESHOLD_SECONDS', 2, 1, 60)
const reloadEverySlots = intEnv('RELOAD_EVERY_SLOTS', 10, 1, 40)
const selectedModel = __ENV.KLICKER_SELECTED_MODEL || 'gpt-6-luna'
const slotCount = Math.min(
  maxPerStudent,
  Math.floor((durationMinutes * 60) / intervalSeconds)
)

export const options = {
  insecureSkipTLSVerify: target.isLocal,
  scenarios: {
    exam: {
      executor: 'per-vu-iterations',
      vus: students,
      iterations: 1,
      maxDuration: `${warmupSeconds + slotCount * intervalSeconds + 300}s`,
    },
  },
  thresholds: {
    chat_requests_failed: ['count==0'],
    chat_requests_missed: ['count==0'],
  },
}

const scheduled = new Counter('chat_requests_scheduled')
const admitted = new Counter('chat_requests_admitted')
const late = new Counter('chat_requests_late')
const missed = new Counter('chat_requests_missed')
const failed = new Counter('chat_requests_failed')
// Time to first response byte. The harness cannot see the first text delta
// because k6 buffers response bodies; see the README limits.
const firstByte = new Trend('chat_first_byte_ms', true)
const fullResponse = new Trend('chat_full_response_ms', true)

function participantId(index) {
  return `e0e0e0e0-0000-4000-8000-${(0xe00000 + index)
    .toString(16)
    .padStart(12, '0')}`
}

function signSessionToken(participant, lifetimeSeconds) {
  const now = Math.floor(Date.now() / 1000)
  const encode = (value) => encoding.b64encode(JSON.stringify(value), 'rawurl')
  const claims = {
    iss: sessionAuth.issuer,
    sub: participant,
    role: 'PARTICIPANT',
    iat: now,
    exp: now + lifetimeSeconds,
  }
  if (sessionAuth.scope) claims.scope = sessionAuth.scope
  const signingInput = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}`
  const signature = hmac('sha256', appSecret, signingInput, 'binary')
  return `${signingInput}.${encoding.b64encode(signature, 'rawurl')}`
}

// The one place that turns a student into a ready session cookie.
function openSession(participant) {
  const lifetime = warmupSeconds + slotCount * intervalSeconds + 900
  http
    .cookieJar()
    .set(
      target.origin,
      sessionAuth.cookie,
      signSessionToken(participant, lifetime),
      {
        path: '/',
      }
    )
}

export function setup() {
  return { startAt: Date.now() + warmupSeconds * 1000 }
}

function sendTurn(state) {
  const assistantMessageId = crypto.randomUUID()
  const res = http.post(
    `${target.origin}/api/chatbots/${CHATBOT_ID}/chat`,
    JSON.stringify({
      messages: [
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: 'Please explain the main idea of this lecture.',
        },
      ],
      threadId: state.threadId,
      selectedModel,
      selectedMode: 'tutor',
      reasoningEffort: 'none',
      parentId: state.parentId,
      assistantMessageId,
      images: [],
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'chat-turn' },
      timeout: '120s',
      redirects: 0,
    }
  )

  // The endpoint answers with an AI SDK SSE stream. A finish event must
  // arrive and no error event may appear. Content is never stored.
  let sawFinish = false
  let sawError = false
  const eventTypes = {}
  for (const line of (res.body || '').split('\n')) {
    if (!line.startsWith('data: ')) continue
    const payload = line.substring(6).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      const event = JSON.parse(payload)
      eventTypes[event.type] = (eventTypes[event.type] || 0) + 1
      if (event.type === 'finish') sawFinish = true
      if (event.type === 'error') sawError = true
    } catch {
      // ignore non-JSON keepalive lines
    }
  }

  const ok = res.status >= 200 && res.status < 300 && sawFinish && !sawError
  check(res, { 'chat turn completed': () => ok })
  if (ok) {
    state.parentId = assistantMessageId
    firstByte.add(res.timings.waiting)
    fullResponse.add(res.timings.duration)
  } else {
    failed.add(1, {
      status: String(res.status),
      stream_error: String(sawError),
    })
    // Event types only; message content and error text are never logged.
    console.warn(
      `chat turn failed: status=${res.status} events=${JSON.stringify(eventTypes)}`
    )
  }
}

function countReloadFailure(res, phase) {
  if (res.status < 200 || res.status >= 300) {
    failed.add(1, { phase, status: String(res.status) })
  }
}

function reloadPage(state) {
  // redirects: 0 so a bounce to the login page counts as a failure.
  countReloadFailure(
    http.get(`${target.origin}/${CHATBOT_ID}`, {
      tags: { name: 'page-reload' },
      redirects: 0,
    }),
    'page-reload'
  )
  countReloadFailure(
    http.get(`${target.origin}/api/chatbots/${CHATBOT_ID}/threads`, {
      tags: { name: 'history-threads' },
    }),
    'history-threads'
  )
  countReloadFailure(
    http.get(`${target.origin}/api/chatbots/${CHATBOT_ID}/credits`, {
      tags: { name: 'credits' },
    }),
    'credits'
  )
  if (state.threadId) {
    countReloadFailure(
      http.get(
        `${target.origin}/api/chatbots/${CHATBOT_ID}/threads/${state.threadId}/messages`,
        { tags: { name: 'history-messages' } }
      ),
      'history-messages'
    )
  }
}

export default function (setupData) {
  const index = FIRST_PARTICIPANT_INDEX + exec.vu.idInTest - 1
  openSession(participantId(index))

  const created = http.post(
    `${target.origin}/api/chatbots/${CHATBOT_ID}/threads`,
    JSON.stringify({ title: null }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'thread-create' },
    }
  )
  const threadId =
    created.status >= 200 && created.status < 300 ? created.json('id') : null
  if (typeof threadId !== 'string') {
    // Without a reusable thread the run would measure a different shape.
    failed.add(1, { phase: 'thread-create', status: String(created.status) })
    return
  }
  const state = { threadId, parentId: null }

  const intervalMs = intervalSeconds * 1000
  for (let slot = 0; slot < slotCount; slot++) {
    const slotStart = setupData.startAt + slot * intervalMs
    const wait = slotStart - Date.now()
    if (wait > 0) sleep(wait / 1000)

    scheduled.add(1)
    // The previous turn ran past this whole slot: it is lost, not queued.
    if (Date.now() >= slotStart + intervalMs) {
      missed.add(1)
      continue
    }
    admitted.add(1)
    late.add(Date.now() - slotStart > lateThresholdSeconds * 1000 ? 1 : 0)
    sendTurn(state)
    if ((slot + 1) % reloadEverySlots === 0) reloadPage(state)
  }
}
