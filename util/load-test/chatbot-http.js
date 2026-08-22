// Chatbot anonymous HTTP load/performance test for KlickerUZH.
// Tests public model GET, native deep-link redirect, disclaimer 401, credits 401.
//
// Usage:
//   KLICKER_CHATBOT_IDS=<uuid>[,<uuid>...] k6 run util/load-test/chatbot-http.js
//   Optional env: KLICKER_BASE_URL (default: https://chat.klicker.uzh.ch)
//   Profile override: k6 run --vus=5 --duration=30s util/load-test/chatbot-http.js

import http from 'k6/http'
import exec from 'k6/execution'
import { check, sleep } from 'k6'

export const options = {
  discardResponseBodies: true,
  scenarios: {
    smoke: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 8,
      startTime: '0s',
      maxDuration: '15s',
    },
    steady: {
      executor: 'constant-vus',
      vus: 2,
      duration: '30s',
      startTime: '20s',
    },
    burst: {
      executor: 'constant-vus',
      vus: 3,
      duration: '10s',
      startTime: '55s',
    },
  },
  thresholds: {
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
    http_req_duration: ['p(99)<2000'],
  },
}

const baseUrl = __ENV.KLICKER_BASE_URL || 'https://chat.klicker.uzh.ch'
const chatbotIds = (__ENV.KLICKER_CHATBOT_IDS || '').split(',').filter(Boolean)
if (chatbotIds.length === 0) {
  throw new Error('Set KLICKER_CHATBOT_IDS as comma-separated UUIDs')
}

const endpoints = chatbotIds.flatMap((id) => [
  {
    name: id.slice(0, 8),
    path: `/api/chatbots/${id}`,
    expected: 200,
    tag: 'model',
  },
  { name: id.slice(0, 8), path: `/${id}`, expected: 307, tag: 'deep-link' },
  {
    name: id.slice(0, 8),
    path: `/api/chatbots/${id}/disclaimer`,
    expected: 401,
    tag: 'disclaimer',
  },
  {
    name: id.slice(0, 8),
    path: `/api/chatbots/${id}/credits`,
    expected: 401,
    tag: 'credits',
  },
])

// Tag per-endpoint latency thresholds dynamically
for (let i = 0; i < endpoints.length; i++) {
  const key = endpoints[i].tag
  options.thresholds[`http_req_duration{endpoint:${key}}`] = ['p(95)<1500']
}

export default function () {
  const ep = endpoints[exec.scenario.iterationInTest % endpoints.length]
  const res = http.get(`${baseUrl}${ep.path}`, {
    redirects: 0,
    tags: { endpoint: ep.tag, chatbot: ep.name },
  })
  check(res, {
    [`${ep.name} ${ep.path} -> ${ep.expected}`]: (r) =>
      r.status === ep.expected,
  })
  if (exec.scenario.name !== 'smoke') sleep(1)
}
