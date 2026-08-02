import { check, sleep } from 'k6'
import http from 'k6/http'

export const options = {
  stages: [
    { duration: '5s', target: 1 },
    { duration: '10s', target: 10 },
    { duration: '20s', target: 25 },
    { duration: '30s', target: 100 },
    { duration: '1m', target: 250 },
    { duration: '30s', target: 50 },
    { duration: '10s', target: 0 },
  ],
  noConnectionReuse: true,
}
const id = __ENV.LIVE_QUIZ_ID || 'af59e777-f7e6-41c3-877e-8d4251a55cd9'
const sessionToken = __ENV.KLICKER_SESSION_TOKEN
const participantToken = __ENV.KLICKER_PARTICIPANT_TOKEN

if (
  !sessionToken ||
  sessionToken.trim().length === 0 ||
  !participantToken ||
  participantToken.trim().length === 0
) {
  throw new Error(
    'KLICKER_SESSION_TOKEN and KLICKER_PARTICIPANT_TOKEN must be set for authenticated load testing'
  )
}

export function setup() {
  // check connectivity to student preview
  // anonymous
  let res = http.get(`https://pwa.klicker.stg.df-app.ch/session/${id}`)
  check(res, { 'status 200': (r) => r.status === 200 })
  sleep(1)

  // authenticated — tokens are injected at runtime, never committed:
  //   k6 run -e KLICKER_SESSION_TOKEN=... -e KLICKER_PARTICIPANT_TOKEN=... k6.js
  // This repo is public and staging JWTs grant real access; capture fresh
  // tokens from an authenticated staging session each run.
  const cookies = {
    cookies: {
      'next-auth.session-token': sessionToken,
      participant_token: participantToken,
    },
  }
  res = http.get(`https://pwa.klicker.stg.df-app.ch/session/${id}`, cookies)
  check(res, { 'status 200': (r) => r.status === 200 })
  sleep(1)
}

export default function () {
  // load test
  const res = http.get(`https://pwa.klicker.stg.df-app.ch/session/${id}`)
  check(res, { 'status 200': (r) => r.status === 200 })

  sleep(1)
  const choices = [
    { ix: 0, selected: false },
    { ix: 1, selected: false },
    { ix: 2, selected: false },
    { ix: 3, selected: false },
  ]
  const randomIndex = Math.floor(Math.random() * choices.length)
  choices[randomIndex].selected = true

  const vote = JSON.stringify({
    correlationKey: null,
    instanceId: 609,
    liveQuizId: id,
    response: {
      choices: choices,
    },
  })

  const resVote = http.post(
    'https://response-api.klicker.stg.df-app.ch/AddResponse',
    vote
  )
  check(resVote, { 'status 200': (r) => r.status === 200 })

  sleep(1)
}
