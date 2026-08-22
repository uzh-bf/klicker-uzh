// Chat turn load tester with hard cost cap. Sends real POST requests to
// /api/chatbots/[chatbotId]/chat, which triggers MCP retrieval + provider
// streaming + message persistence. Each iteration consumes credits and
// creates thread/message records.
//
// Safety: MAX_TURNS defaults to 2 and cannot exceed 10 without --override.
// The script refuses to run without an explicit KLICKER_PARTICIPANT_TOKEN.
//
// Usage:
//   KLICKER_PARTICIPANT_TOKEN=<jwt> KLICKER_CHATBOT_ID=<uuid> \
//     KLICKER_SELECTED_MODEL=<model-id> MAX_TURNS=2 \
//     k6 run util/load-test/chatbot-turn.js

import http from 'k6/http'
import { check } from 'k6'
import { randomUUID } from 'k6/crypto'

const token = __ENV.KLICKER_PARTICIPANT_TOKEN
if (!token || token.trim().length === 0) {
  throw new Error('KLICKER_PARTICIPANT_TOKEN is required for real chat turns')
}

const baseUrl = __ENV.KLICKER_BASE_URL || 'https://chat.klicker.uzh.ch'
const chatbotId = __ENV.KLICKER_CHATBOT_ID
if (!chatbotId) {
  throw new Error('KLICKER_CHATBOT_ID is required')
}

const selectedModel = __ENV.KLICKER_SELECTED_MODEL
if (!selectedModel) {
  throw new Error(
    'KLICKER_SELECTED_MODEL is required (e.g. gpt-4o-mini or the model ID from credits)'
  )
}

const maxTurns = Math.min(parseInt(__ENV.MAX_TURNS || '2', 10), 10)
const question = __ENV.QUESTION || 'What topics are covered?'

export const options = {
  discardResponseBodies: true,
  scenarios: {
    turns: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: maxTurns,
      maxDuration: '5m',
    },
  },
  thresholds: {
    checks: ['rate>=0.9'],
    'http_req_duration{name:chat-turn}': ['p(95)<30000'],
  },
}

export default function () {
  const assistantMessageId = randomUUID()
  const payload = JSON.stringify({
    messages: [{ id: randomUUID(), role: 'user', content: question }],
    threadId: null,
    selectedModel,
    selectedMode: 'tutor',
    reasoningEffort: 'none',
    parentId: null,
    assistantMessageId,
    images: [],
  })

  const res = http.post(`${baseUrl}/api/chatbots/${chatbotId}/chat`, payload, {
    cookies: { participant_token: token },
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'chat-turn' },
    timeout: '60s',
  })

  check(res, {
    'chat turn returned success': (r) => r.status >= 200 && r.status < 300,
  })
}
