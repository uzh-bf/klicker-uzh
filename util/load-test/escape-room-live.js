// Live Quiz escape room smoke and load test against the local routed stack.
//
// Scenarios (run in parallel for DURATION):
//   students   N seeded participants (testuser1..testuserN) log in, start an
//              attempt on the block and answer its stages through the
//              Response API
//   lecturer   one delegated-login lecturer polls escapeRoomProgress every 2 s
//   projector  one anonymous viewer polls escapeRoomProjector every 5 s with
//              the block's projector digest
//
// Prerequisites: seeded local accounts, a Live Quiz with an active escape room
// block, and the ids of that block's question instances in stage order
// (KLICKER_INSTANCE_IDS, comma separated). The projector digest is shown in
// the cockpit link (`?digest=...`). Passwords come from the environment.
//
// Run against the local routed stack (replace <workspace> with the routed
// workspace name; the participants must not have started the block yet):
//   k6 run \
//     -e KLICKER_API_URL=https://api.klicker.<workspace>.localhost \
//     -e KLICKER_AUTH_URL=https://auth.klicker.<workspace>.localhost \
//     -e KLICKER_RESPONSE_API_URL=https://response-api.klicker.<workspace>.localhost \
//     -e KLICKER_LIVE_QUIZ_ID=<quiz uuid> -e KLICKER_BLOCK_ID=<block id> \
//     -e KLICKER_INSTANCE_IDS=<id>,<id>,... \
//     -e KLICKER_PROJECTOR_DIGEST=<digest> \
//     -e KLICKER_TEST_PASSWORD=<seeded participant password> \
//     -e KLICKER_LECTURER_PASSWORD=<seeded lecturer delegated password> \
//     util/load-test/escape-room-live.js
// The local certificates are not publicly trusted; add --insecure-skip-tls-verify
// when the routed stack uses a local CA that k6 does not know.
//
// Optional variables: KLICKER_PARTICIPANTS (default 50), DURATION (default
// 2m), KLICKER_ANSWER_PAUSE (seconds between a participant's answers, default
// 4), KLICKER_CHOICE_COUNT (answer options per question, default 4),
// KLICKER_LECTURER_IDENTIFIER (default lecturer).
//
// Scaling to 400 students: the seeded accounts bound the number of virtual
// participants, so raise the request rate instead. With 50 participants,
// divide KLICKER_ANSWER_PAUSE by 8 to produce the answer rate of 400 students
// at the default pause. The lecturer and projector polls do not depend on the
// student count, so they stay at their fixed intervals. Participants whose
// attempt is locked out or finished keep answering, which exercises the
// lockout and closed-attempt paths of the Response API.
//
// GraphQL operations are sent as persisted operations. The hashes below match
// the operations in packages/graphql/src/public/server.json; regenerate them
// from that file when an operation changes.

import { check, sleep } from 'k6'
import exec from 'k6/execution'
import http from 'k6/http'

const LOGIN_PARTICIPANT_HASH =
  '8e3ea39b64b0408ac5e307fc0778e8ad583268eec5569d98873ddec90598c384'
const START_ATTEMPT_HASH =
  '5a6fac90646f5b93e1cd0aef6104812e8c743539688d7ba27577c0d216ad2a1b'
const PROGRESS_HASH =
  'd4fe588764ca7e27b26ce2a83c16210aa4c242fe53cc127605552625033fca36'
const PROJECTOR_HASH =
  '7b4f57845a64e84e455890b3f4df40c676ad9f508e9c2293ad27e048d3c291a9'

function required(name) {
  const value = (__ENV[name] || '').trim()
  if (!value) throw new Error(`${name} must be set`)
  return value
}

function origin(name) {
  return required(name).replace(/\/+$/, '')
}

const apiUrl = origin('KLICKER_API_URL')
const authUrl = origin('KLICKER_AUTH_URL')
const responseApiUrl = origin('KLICKER_RESPONSE_API_URL')
const liveQuizId = required('KLICKER_LIVE_QUIZ_ID')
const blockId = parseInt(required('KLICKER_BLOCK_ID'), 10)
const instanceIds = required('KLICKER_INSTANCE_IDS')
  .split(',')
  .map((id) => parseInt(id.trim(), 10))
const projectorDigest = required('KLICKER_PROJECTOR_DIGEST')
const participantPassword = required('KLICKER_TEST_PASSWORD')
const lecturerPassword = required('KLICKER_LECTURER_PASSWORD')
const lecturerIdentifier = __ENV.KLICKER_LECTURER_IDENTIFIER || 'lecturer'
const participants = parseInt(__ENV.KLICKER_PARTICIPANTS || '50', 10)
const duration = __ENV.DURATION || '2m'
const answerPause = parseFloat(__ENV.KLICKER_ANSWER_PAUSE || '4')
const choiceCount = parseInt(__ENV.KLICKER_CHOICE_COUNT || '4', 10)

if (
  !Number.isInteger(blockId) ||
  instanceIds.some((id) => !Number.isInteger(id))
) {
  throw new Error('KLICKER_BLOCK_ID and KLICKER_INSTANCE_IDS must be integers')
}

export const options = {
  scenarios: {
    students: {
      executor: 'per-vu-iterations',
      exec: 'student',
      vus: participants,
      iterations: 1,
      maxDuration: duration,
    },
    lecturer: {
      executor: 'constant-vus',
      exec: 'lecturer',
      vus: 1,
      duration,
    },
    projector: {
      executor: 'constant-vus',
      exec: 'projector',
      vus: 1,
      duration,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
}

const graphqlHeaders = {
  'Content-Type': 'application/json',
  'x-graphql-yoga-csrf': 'true',
}

function persisted(name, hash, variables, params = {}) {
  return http.post(
    `${apiUrl}/api/graphql`,
    JSON.stringify({
      operationName: name,
      variables,
      extensions: { persistedQuery: { version: 1, sha256Hash: hash } },
    }),
    {
      ...params,
      headers: { ...graphqlHeaders, ...(params.headers || {}) },
      tags: { name },
    }
  )
}

function hasData(response) {
  if (response.status !== 200) return false
  const body = response.json()
  return !body.errors && Boolean(body.data)
}

export function student() {
  const username = `testuser${exec.vu.idInInstance}`

  const login = persisted('LoginParticipant', LOGIN_PARTICIPANT_HASH, {
    usernameOrEmail: username,
    password: participantPassword,
  })
  const token = (login.cookies.participant_token || [])[0]?.value
  if (!check(login, { 'participant login': () => Boolean(token) })) return
  const cookie = { Cookie: `participant_token=${token}` }

  const start = persisted(
    'StartEscapeRoomAttempt',
    START_ATTEMPT_HASH,
    { elementBlockId: blockId },
    { headers: cookie }
  )
  check(start, { 'attempt started': hasData })

  const choices = Array.from({ length: choiceCount }, (_, ix) => ({
    ix,
    selected: ix === 0,
  }))
  // Lockouts and finished attempts are expected answers, not failures.
  const expected = http.expectedStatuses({ min: 200, max: 499 })

  for (const instanceId of instanceIds) {
    const answer = http.post(
      `${responseApiUrl}/AddResponse`,
      JSON.stringify({
        correlationKey: null,
        instanceId,
        liveQuizId,
        response: { choices },
      }),
      {
        headers: { 'Content-Type': 'application/json', ...cookie },
        responseCallback: expected,
        tags: { name: 'AddResponse' },
      }
    )
    check(answer, { 'answer accepted by server': (r) => r.status < 500 })
    sleep(answerPause)
  }
}

let lecturerLoggedIn = false

function loginLecturer() {
  const csrf = http.get(`${authUrl}/api/auth/csrf`, {
    tags: { name: 'lecturer-csrf' },
  })
  const login = http.post(
    `${authUrl}/api/auth/callback/credentials`,
    {
      csrfToken: csrf.json('csrfToken'),
      identifier: lecturerIdentifier,
      password: lecturerPassword,
      json: 'true',
    },
    { tags: { name: 'lecturer-login' } }
  )
  // The session cookie lands in the virtual user's cookie jar.
  return check(login, { 'lecturer login': (r) => r.status === 200 })
}

export function lecturer() {
  if (!lecturerLoggedIn) {
    lecturerLoggedIn = loginLecturer()
    if (!lecturerLoggedIn) {
      sleep(2)
      return
    }
  }
  const progress = persisted('GetEscapeRoomProgress', PROGRESS_HASH, {
    liveQuizId,
    elementBlockId: blockId,
  })
  check(progress, { 'progress loaded': hasData })
  sleep(2)
}

export function projector() {
  const view = persisted('GetEscapeRoomProjector', PROJECTOR_HASH, {
    liveQuizId,
    elementBlockId: blockId,
    digest: projectorDigest,
  })
  check(view, { 'projector loaded': hasData })
  sleep(5)
}
