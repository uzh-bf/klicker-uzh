import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { videoFrameCandidates } from '../src/lib/sources/videoFrames'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
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
  withChatbotAuth: mocks.auth,
  authorizeIdentityForChatbot: mocks.auth,
}))
vi.mock('@/src/lib/server/videoFrameStore', () => ({
  readVideoFrame: mocks.read,
}))
// Exercise the real shared configuration resolver, scope validation and
// knowledge-binding guard. Login, participant authorization, database and
// storage are replaced.
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

function chatbotRecord(mcpConfigurations = [tutor]) {
  return {
    ownerId: 'owner',
    courseId: 'course',
    status: 'PUBLISHED',
    knowledgeGraphRetrievalEnabled: false,
    mcpConfigurations,
    knowledgeBases: [
      {
        kbId: frame.kb_id,
        kb: { ownerId: 'owner', knowledgeGraphEnabled: false },
      },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({
    participantId: 'student',
    authMode: 'account',
    chatbot: { courseId: 'course', knowledgeGraphVisible: false },
  })
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
  mocks.chatbot.mockResolvedValue(chatbotRecord())
  mocks.read.mockResolvedValue(Buffer.from('jpeg'))
})

it('allows Quizzer to inherit Tutor access when there is no explicit override', async () => {
  expect((await GET(req, { params })).status).toBe(200)
  expect(mocks.read).toHaveBeenCalledWith(frame)
})

it('denies a frame when the participant is no longer authorized', async () => {
  mocks.auth
    .mockResolvedValueOnce({
      participantId: 'student',
      authMode: 'account',
      chatbot: { courseId: 'course', knowledgeGraphVisible: false },
    })
    .mockResolvedValueOnce({
      response: NextResponse.json({}, { status: 403 }),
    })
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})

it('denies a previously accessible frame after Quizzer is explicitly disabled', async () => {
  expect((await GET(req, { params })).status).toBe(200)
  mocks.read.mockClear()
  mocks.chatbot.mockResolvedValue(
    chatbotRecord([tutor, { ...tutor, chatMode: 'quizzer', isEnabled: false }])
  )
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})

it('also denies source-preview frames when Quizzer is explicitly disabled', async () => {
  mocks.message.mockResolvedValue({
    chatMode: 'quizzer',
    content: [{ type: 'tool-call', toolName: 'KB_doc_query', result: fixture }],
  })
  mocks.chatbot.mockResolvedValue(
    chatbotRecord([tutor, { ...tutor, chatMode: 'quizzer', isEnabled: false }])
  )
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})
