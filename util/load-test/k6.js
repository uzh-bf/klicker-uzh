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

export function setup() {
  // check connectivity to student preview
  // anonymous
  let res = http.get(`https://pwa.klicker.stg.df-app.ch/session/${id}`)
  check(res, { 'status 200': (r) => r.status === 200 })
  sleep(1)

  // authenticated
  const cookies = {
    cookies: {
      'next-auth.session-token':
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImxlY3R1cmVyQGRmLnV6aC5jaCIsInN1YiI6Ijc2MDQ3MzQ1LTM4MDEtNDYyOC1hZTdiLWFkYmViY2ZlODgyMSIsInNob3J0bmFtZSI6ImxlY3R1cmVyIiwic2NvcGUiOiJGVUxMX0FDQ0VTUyIsImNhdGFseXN0SW5zdGl0dXRpb25hbCI6dHJ1ZSwiY2F0YWx5c3RJbmRpdmlkdWFsIjp0cnVlLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3NjMwNDg2OTEsImlzcyI6Imh0dHBzOi8vYXV0aC5rbGlja2VyLnN0Zy5kZi1hcHAuY2gifQ.wVgW8eDFQ9Ygvc2Qd3eNmQkdeGg5ukwwiPAXhtO9Qfo',
      participant_token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2ZjQ1MDY1Yy02NjdmLTQyNTktODE4Yy1jNmY2YjQ3N2ViNDgiLCJyb2xlIjoiUEFSVElDSVBBTlQiLCJpYXQiOjE3NjMxMDgyMjksImV4cCI6MTc2NDMxNzgyOSwiaXNzIjoiaHR0cHM6Ly9hcGkua2xpY2tlci5zdGcuZGYtYXBwLmNoIn0.gV7lD0PJGbiD45EX8yEF0V9CT3kFSgZIWoyljgBKQmA',
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
