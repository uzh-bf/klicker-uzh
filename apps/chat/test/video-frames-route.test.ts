import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { videoFrameCandidates } from '../src/lib/sources/videoFrames'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  message: vi.fn(),
  chatbot: vi.fn(),
  scope: vi.fn(),
  read: vi.fn(),
}))
vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    chatMessage: { findFirst: mocks.message },
    chatbot: { findUnique: mocks.chatbot },
  },
}))
vi.mock('@/src/lib/server/apiGuards', () => ({ withChatbotAuth: mocks.auth }))
vi.mock('@/src/lib/server/effectiveChatModes', () => ({
  resolveEffectiveMCPConfigurations: (configs: unknown) => configs,
}))
vi.mock('@/src/lib/server/videoFrameStore', () => ({
  readVideoFrame: mocks.read,
}))
vi.mock('@/src/services/mcpScope', () => ({ resolveMcpScope: mocks.scope }))

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

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({
    participantId: 'student',
    chatbot: { courseId: 'course' },
  })
  mocks.message.mockResolvedValue({
    chatMode: 'tutor',
    content: [
      {
        type: 'tool-call',
        toolName: 'show_video_frame',
        result: { status: 'selected', frame },
      },
    ],
  })
  mocks.chatbot.mockResolvedValue({ mcpConfigurations: [] })
  mocks.scope.mockReturnValue([frame.kb_id])
  mocks.read.mockResolvedValue(Buffer.from('jpeg'))
})

it('requires authentication before frame storage access', async () => {
  mocks.auth.mockResolvedValue({
    response: NextResponse.json({}, { status: 401 }),
  })
  expect((await GET(req, { params })).status).toBe(401)
  expect(mocks.message).not.toHaveBeenCalled()
  expect(mocks.read).not.toHaveBeenCalled()
})

it('scopes the frame to the owned assistant message', async () => {
  const response = await GET(req, { params })
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toBe('image/jpeg')
  expect(mocks.message).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        id: 'message',
        threadId: 'thread',
        role: 'assistant',
        thread: { participantId: 'student', chatbotId: 'bot' },
      },
    })
  )
})

it('rejects unselected frames and revoked KB bindings', async () => {
  mocks.message.mockResolvedValue({
    chatMode: 'tutor',
    content: [{ type: 'tool-call', toolName: 'KB_doc_query', result: fixture }],
  })
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
  mocks.message.mockResolvedValue({
    chatMode: 'tutor',
    content: [
      {
        type: 'tool-call',
        toolName: 'show_video_frame',
        result: { status: 'selected', frame },
      },
    ],
  })
  mocks.scope.mockReturnValue([])
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})
