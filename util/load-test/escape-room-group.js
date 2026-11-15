// Group Activity escape room session smoke and load test against the local
// routed stack.
//
// Scenarios (run in parallel for DURATION):
//   students   KLICKER_STUDENTS virtual students (default 400) are spread over
//              the seeded course groups. Each logs in with a password, opens
//              the group activity and polls the escapeRoomSessionPhase query
//              every 3 s like the PWA lobby. Once the session runs (or has no
//              clock) it starts the group's attempt and answers the first
//              stage through the group decisions mutation at a low rate.
//   lecturer   one delegated-login lecturer polls escapeRoomProgress for the
//              group activity every 5 s, like the grading dashboard
//   projector  one anonymous viewer polls escapeRoomProjector every 5 s with
//              the activity's projector digest
//
// Prerequisites: seeded local accounts, a published Group Activity with an
// escape room configuration, and the ids below. For a seeded dev database,
// packages/prisma-data prints them (see the README of this folder). Put the
// session in RUNNING from the grading page while the script runs to see the
// lobby phase turn into play; with the session clock off the groups start at
// once. The groups must not have started an attempt before the run.
//
// Required variables:
//   KLICKER_API_URL, KLICKER_AUTH_URL    routed API and auth origins
//   KLICKER_GROUP_ACTIVITY_ID            the group activity (uuid)
//   KLICKER_MEMBERS                      comma separated username:groupId
//                                        pairs, one logged-in member per
//                                        group; students are spread over them
//   KLICKER_STAGE_INSTANCE_ID            element instance id of the first
//                                        answerable stage
//   KLICKER_PROJECTOR_DIGEST             digest of the activity projector
// Credentials: KLICKER_TEST_PASSWORD and KLICKER_LECTURER_PASSWORD. They
// default to the seeded development passwords only when every target host is a
// local *.localhost host; otherwise they must be set.
//
// Optional variables: KLICKER_STUDENTS (default 400), DURATION (default 2m),
// KLICKER_ANSWER_PAUSE (seconds between a student's answers, default 30),
// KLICKER_LECTURER_IDENTIFIER (default lecturer), KLICKER_PWA_ORIGIN and
// KLICKER_MANAGE_ORIGIN (default: the API URL with pwa. or manage. in place of
// api.), KLICKER_JOIN_SPREAD (seconds over which students log in, default 60;
// password logins are slow, so raise it with the student count).
//
// Run (replace <workspace> with the routed workspace name):
//   k6 run --insecure-skip-tls-verify \
//     -e KLICKER_API_URL=https://api.klicker.<workspace>.localhost \
//     -e KLICKER_AUTH_URL=https://auth.klicker.<workspace>.localhost \
//     -e KLICKER_GROUP_ACTIVITY_ID=<uuid> \
//     -e KLICKER_MEMBERS=<username>:<groupId>,... \
//     -e KLICKER_STAGE_INSTANCE_ID=<id> -e KLICKER_PROJECTOR_DIGEST=<digest> \
//     util/load-test/escape-room-group.js
//
// Students beyond the number of seeded accounts share accounts, so several
// virtual students act as one group member. Password logins are deliberately
// excluded from the 500 ms p95 threshold. Wrong answers, lockouts and gated
// stages are expected GraphQL errors, not failures.
//
// GraphQL operations are sent as persisted operations. The hashes below match
// the operations in packages/graphql/src/public/server.json; regenerate them
// from that file when an operation changes.

import { check, sleep } from 'k6'
import exec from 'k6/execution'
import http from 'k6/http'

const LOGIN_PARTICIPANT_HASH =
  '8e3ea39b64b0408ac5e307fc0778e8ad583268eec5569d98873ddec90598c384'
const START_GROUP_ACTIVITY_HASH =
  'bcb2a2dcaa54c5dfb990f99f48816ad6e39bd9ba9b8284a8822776dcbcf5733f'
const START_ATTEMPT_HASH =
  '665424056f466aa32ccbab942357390806c8beed347670e1e78ca9237865a306'
const SESSION_PHASE_HASH =
  '87b34bd87947ad764d86ae608d39da5a981b61880f12bb4f163cfdf6b81ca658'
const SUBMIT_DECISIONS_HASH =
  '6cb29556353c724b7db036d976a182d26c8b381f7cc1f23c1af6f5fdaca29a35'
const PROGRESS_HASH =
  'd4fe588764ca7e27b26ce2a83c16210aa4c242fe53cc127605552625033fca36'
const PROJECTOR_HASH =
  'c67100200d630a11bcd42b24f1253964862a9fb2adbee4ea92ad77dbc44a513e'

function required(name) {
  const value = (__ENV[name] || '').trim()
  if (!value) throw new Error(`${name} must be set`)
  return value
}

function origin(name) {
  return required(name).replace(/\/+$/, '')
}

function hostnameOf(url) {
  return url.replace(/^https?:\/\//, '').split(/[/:]/)[0]
}

const apiUrl = origin('KLICKER_API_URL')
const authUrl = origin('KLICKER_AUTH_URL')

// This script logs in, starts attempts and submits answers; production needs
// an explicit opt-in like the other load-test scripts.
function isProductionUrl(url) {
  const hostname = hostnameOf(url)
  return hostname === 'klicker.uzh.ch' || hostname.endsWith('.klicker.uzh.ch')
}
if (
  [apiUrl, authUrl].some(isProductionUrl) &&
  __ENV.KLICKER_ALLOW_PRODUCTION !== 'true'
) {
  throw new Error(
    'Set KLICKER_ALLOW_PRODUCTION=true to run this script against production'
  )
}

// The seeded development passwords are a fallback for local targets only.
const isLocalTarget = [apiUrl, authUrl].every((url) => {
  const hostname = hostnameOf(url)
  return hostname === 'localhost' || hostname.endsWith('.localhost')
})
function password(name, seededDefault) {
  const value = (__ENV[name] || '').trim()
  if (value) return value
  if (isLocalTarget) return seededDefault
  throw new Error(`${name} must be set for a non-local target`)
}

const groupActivityId = required('KLICKER_GROUP_ACTIVITY_ID')
const members = required('KLICKER_MEMBERS')
  .split(',')
  .map((entry) => {
    const [username, groupId] = entry.trim().split(':')
    return { username, groupId }
  })
const stageInstanceId = parseInt(required('KLICKER_STAGE_INSTANCE_ID'), 10)
const projectorDigest = required('KLICKER_PROJECTOR_DIGEST')
const participantPassword = password('KLICKER_TEST_PASSWORD', 'abcdabcd')
const lecturerPassword = password('KLICKER_LECTURER_PASSWORD', 'abcd')
const lecturerIdentifier = __ENV.KLICKER_LECTURER_IDENTIFIER || 'lecturer'
// The API picks the session cookie by the calling app's Origin, so each
// scenario sends the origin of the app it stands in for.
const pwaOrigin = (
  __ENV.KLICKER_PWA_ORIGIN || apiUrl.replace('//api.', '//pwa.')
).replace(/\/+$/, '')
const manageOrigin = (
  __ENV.KLICKER_MANAGE_ORIGIN || apiUrl.replace('//api.', '//manage.')
).replace(/\/+$/, '')
const students = parseInt(__ENV.KLICKER_STUDENTS || '400', 10)
const duration = __ENV.DURATION || '2m'
const answerPause = parseFloat(__ENV.KLICKER_ANSWER_PAUSE || '30')
const joinSpread = parseFloat(__ENV.KLICKER_JOIN_SPREAD || '60')

if (
  !Number.isInteger(stageInstanceId) ||
  members.some((member) => !member.username || !member.groupId)
) {
  throw new Error(
    'KLICKER_STAGE_INSTANCE_ID must be an integer and KLICKER_MEMBERS must list username:groupId pairs'
  )
}

export const options = {
  scenarios: {
    students: {
      executor: 'constant-vus',
      exec: 'student',
      vus: students,
      duration,
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
    'http_req_duration{name:GetEscapeRoomSessionPhase}': ['p(95)<500'],
    'http_req_duration{name:GetEscapeRoomProgress}': ['p(95)<500'],
    'http_req_duration{name:GetEscapeRoomProjector}': ['p(95)<500'],
    'http_req_duration{name:SubmitGroupActivityDecisions}': ['p(95)<500'],
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

// Wrong answers, lockouts and closed sessions come back as GraphQL errors with
// a 200 status; only transport and server failures count against the run.
function isServerOk(response) {
  return response.status < 500
}

// Per-VU state; k6 keeps module variables separate for each VU.
let session = null

function loginStudent(member) {
  // students join over a window instead of all in the same instant
  sleep(Math.random() * joinSpread)
  const login = persisted(
    'LoginParticipant',
    LOGIN_PARTICIPANT_HASH,
    { usernameOrEmail: member.username, password: participantPassword },
    { headers: { Origin: pwaOrigin } }
  )
  const token = (login.cookies.participant_token || [])[0]?.value
  if (!check(login, { 'participant login': () => Boolean(token) })) return null

  const cookie = { Cookie: `participant_token=${token}` }
  const open = persisted(
    'StartGroupActivity',
    START_GROUP_ACTIVITY_HASH,
    { activityId: groupActivityId, groupId: member.groupId },
    { headers: { ...cookie, Origin: pwaOrigin } }
  )
  check(open, { 'group activity opened': hasData })
  const instanceId = hasData(open)
    ? open.json('data.startGroupActivity.id')
    : null
  return {
    member,
    headers: { ...cookie, Origin: pwaOrigin },
    instanceId,
    attemptStarted: false,
    lastAnswerAt: 0,
  }
}

export function student() {
  if (!session) {
    session = loginStudent(members[(exec.vu.idInInstance - 1) % members.length])
    if (!session) {
      sleep(3)
      return
    }
  }

  const phase = persisted(
    'GetEscapeRoomSessionPhase',
    SESSION_PHASE_HASH,
    { groupActivityId, groupId: session.member.groupId },
    { headers: session.headers }
  )
  check(phase, { 'session phase loaded': hasData })
  // null means the activity has no session clock, so groups play at once
  const current = hasData(phase)
    ? phase.json('data.escapeRoomSessionPhase')
    : null
  const playing = current === null || current === 'RUNNING'

  if (playing && !session.attemptStarted) {
    const start = persisted(
      'StartEscapeRoomAttempt',
      START_ATTEMPT_HASH,
      { groupActivityId, groupId: session.member.groupId },
      { headers: session.headers }
    )
    check(start, { 'attempt request served': isServerOk })
    session.attemptStarted = true
  }

  const now = Date.now() / 1000
  if (
    playing &&
    session.attemptStarted &&
    session.instanceId &&
    now - session.lastAnswerAt >= answerPause
  ) {
    session.lastAnswerAt = now
    const answer = persisted(
      'SubmitGroupActivityDecisions',
      SUBMIT_DECISIONS_HASH,
      {
        activityId: session.instanceId,
        responses: [
          {
            instanceId: stageInstanceId,
            type: 'SC',
            choicesResponse: [{ ix: 0, selected: true }],
          },
        ],
      },
      { headers: session.headers }
    )
    check(answer, { 'answer request served': isServerOk })
  }

  sleep(3)
}

let lecturerLoggedIn = false
let lecturerToken

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
  // Send the session cookie explicitly: it is scoped to the parent domain and
  // the cookie jar does not attach it to every API request.
  lecturerToken = (http.cookieJar().cookiesForURL(authUrl)[
    'next-auth.session-token'
  ] || [])[0]
  return check(login, {
    'lecturer login': (r) => r.status === 200 && Boolean(lecturerToken),
  })
}

export function lecturer() {
  if (!lecturerLoggedIn) {
    lecturerLoggedIn = loginLecturer()
    if (!lecturerLoggedIn) {
      sleep(2)
      return
    }
  }
  const progress = persisted(
    'GetEscapeRoomProgress',
    PROGRESS_HASH,
    { groupActivityId },
    {
      headers: {
        Origin: manageOrigin,
        Cookie: `next-auth.session-token=${lecturerToken}`,
      },
    }
  )
  check(progress, { 'progress loaded': hasData })
  sleep(5)
}

export function projector() {
  const view = persisted('GetEscapeRoomProjector', PROJECTOR_HASH, {
    groupActivityId,
    digest: projectorDigest,
  })
  check(view, { 'projector loaded': hasData })
  sleep(5)
}
