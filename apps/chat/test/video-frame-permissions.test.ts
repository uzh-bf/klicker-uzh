import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { videoFrameCandidates } from '../src/lib/sources/videoFrames'

const mocks = vi.hoisted(() => ({
  message: vi.fn(),
  chatbot: vi.fn(),
  read: vi.fn(),
}))
vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    chatMessage: { findFirst: mocks.message },
    chatbot: { findUnique: mocks.chatbot },
  },
}))
vi.mock('@/src/lib/server/apiGuards', () => ({
  withChatbotAuth: async () => ({ participantId: 'student' }),
}))
vi.mock('@/src/lib/server/videoFrameStore', () => ({
  readVideoFrame: mocks.read,
}))
// Exercise the real shared configuration resolver and scope validation. Only
// database, login and storage are replaced; no identity resolver or scope stub.
vi.mock(
  '@/src/lib/server/effectiveChatModes',
  async () => import('../../../packages/util/src/chatbotMCPConfiguration')
)

import { GET } from '../src/app/api/chatbots/[chatbotId]/threads/[threadId]/messages/[messageId]/frames/[assetId]/route'

const fixture = JSON.parse(
  await readFile(
    path.resolve('scripts/fixtures/video-frames/query-result.json'),
    'utf8'
  )
)
const frame = videoFrameCandidates(fixture)[0]!
const req = new NextRequest('http://localhost/api/test')
const params = Promise.resolve({
  chatbotId: 'bot',
  threadId: 'thread',
  messageId: 'message',
  assetId: frame.asset_id,
})
const tutor = {
  chatMode: 'tutor',
  isEnabled: true,
  allowedTools: ['doc_query'],
  mcpServer: { id: 'kb-server', name: 'KB' },
  parameters: { kb_id: frame.kb_id, required: true, toolAlias: 'doc_query' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.message.mockResolvedValue({
    chatMode: 'quizzer',
    content: [
      {
        type: 'tool-call',
        toolName: 'show_video_frame',
        result: { status: 'selected', frame },
      },
    ],
  })
  mocks.chatbot.mockResolvedValue({ mcpConfigurations: [tutor] })
  mocks.read.mockResolvedValue(Buffer.from('jpeg'))
})

it('allows Quizzer to inherit Tutor access when there is no explicit override', async () => {
  expect((await GET(req, { params })).status).toBe(200)
  expect(mocks.read).toHaveBeenCalledWith(frame)
})

it('denies a previously accessible frame after Quizzer is explicitly disabled', async () => {
  expect((await GET(req, { params })).status).toBe(200)
  mocks.read.mockClear()
  mocks.chatbot.mockResolvedValue({
    mcpConfigurations: [
      tutor,
      { ...tutor, chatMode: 'quizzer', isEnabled: false },
    ],
  })
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})

it('also denies source-preview frames when Quizzer is explicitly disabled', async () => {
  mocks.message.mockResolvedValue({
    chatMode: 'quizzer',
    content: [{ type: 'tool-call', toolName: 'KB_doc_query', result: fixture }],
  })
  mocks.chatbot.mockResolvedValue({
    mcpConfigurations: [
      tutor,
      { ...tutor, chatMode: 'quizzer', isEnabled: false },
    ],
  })
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})
