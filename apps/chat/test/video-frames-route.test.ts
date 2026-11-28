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
vi.mock('@/src/lib/server/apiGuards', () => ({ withChatbotAuth: mocks.auth }))
vi.mock('@/src/lib/server/videoFrameStore', () => ({
  readVideoFrame: mocks.read,
}))

import { GET } from '../src/app/api/chatbots/[chatbotId]/threads/[threadId]/messages/[messageId]/frames/[assetId]/route'

const fixture = JSON.parse(
  await readFile(
    path.resolve('scripts/fixtures/video-frames/query-result.json'),
    'utf8'
  )
)
const frame = videoFrameCandidates(fixture)[0]!
const LINK_ID = '4c1f2f0e-6d1a-4a56-9a2f-7d2b6f2f6f01'
const OTHER_LINK_ID = '9a5f2b31-0c86-4f2b-8a10-c3d0e5f5b902'
const legacyConfigurations = [
  {
    chatMode: 'tutor',
    isEnabled: true,
    allowedTools: ['doc_query'],
    parameters: {
      required: true,
      toolAlias: 'doc_query',
      kb_id: frame.kb_id,
    },
    mcpServer: { id: 'server', name: 'KB' },
  },
]
const managedLink = {
  id: LINK_ID,
  kbId: frame.kb_id,
  isEnabled: true,
  isDefault: true,
  kb: { deletedAt: null, knowledgeGraphEnabled: true, name: 'Casebook' },
}
const provenance = {
  type: 'data' as const,
  name: 'retrieval-source',
  data: {
    chatMode: 'tutor',
    kbId: frame.kb_id,
    kbLinkId: LINK_ID,
    revisionVersion: 2,
  },
}
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
  mocks.chatbot.mockResolvedValue({
    knowledgeBases: [],
    mcpConfigurations: legacyConfigurations,
  })
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

it('allows the representative source preview without selecting an inline image', async () => {
  mocks.message.mockResolvedValue({
    chatMode: 'tutor',
    content: [{ type: 'tool-call', toolName: 'KB_doc_query', result: fixture }],
  })
  expect((await GET(req, { params })).status).toBe(200)
  expect(mocks.read).toHaveBeenCalledWith(frame)
})

it('rejects frames absent from the message and revoked KB bindings', async () => {
  mocks.message.mockResolvedValue({ chatMode: 'tutor', content: [] })
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
  mocks.chatbot.mockResolvedValue({
    knowledgeBases: [],
    mcpConfigurations: [],
  })
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})

it('rejects source previews after KB access is revoked or the message is not owned', async () => {
  mocks.message.mockResolvedValue({
    chatMode: 'tutor',
    content: [{ type: 'tool-call', toolName: 'KB_doc_query', result: fixture }],
  })
  mocks.chatbot.mockResolvedValue({
    knowledgeBases: [],
    mcpConfigurations: [],
  })
  expect((await GET(req, { params })).status).toBe(404)
  mocks.chatbot.mockResolvedValue({
    knowledgeBases: [],
    mcpConfigurations: legacyConfigurations,
  })
  mocks.message.mockResolvedValue(null)
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})
it('replays a managed frame only with matching original link provenance', async () => {
  mocks.message.mockResolvedValue({
    chatMode: 'tutor',
    content: [
      {
        type: 'tool-call',
        toolName: 'show_video_frame',
        result: { status: 'selected', frame },
      },
      provenance,
    ],
  })
  mocks.chatbot.mockResolvedValue({
    knowledgeBases: [managedLink],
    mcpConfigurations: legacyConfigurations,
  })
  expect((await GET(req, { params })).status).toBe(200)

  mocks.message.mockResolvedValue({
    chatMode: 'tutor',
    content: [
      {
        type: 'tool-call',
        toolName: 'show_video_frame',
        result: { status: 'selected', frame },
      },
      { ...provenance, data: { ...provenance.data, kbLinkId: OTHER_LINK_ID } },
    ],
  })
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).toHaveBeenCalledTimes(1)
})
it('keeps serving a frame stored before provenance markers while its link is unchanged', async () => {
  const unmarked = {
    chatMode: 'tutor',
    createdAt: new Date('2026-06-01T00:00:00Z'),
    content: [
      {
        type: 'tool-call',
        toolName: 'show_video_frame',
        result: { status: 'selected', frame },
      },
    ],
  }
  mocks.message.mockResolvedValue(unmarked)
  mocks.chatbot.mockResolvedValue({
    knowledgeBases: [
      { ...managedLink, createdAt: new Date('2026-05-01T00:00:00Z') },
    ],
    mcpConfigurations: legacyConfigurations,
  })
  expect((await GET(req, { params })).status).toBe(200)

  // A reattached KB gets a new link that did not exist for the old message.
  mocks.chatbot.mockResolvedValue({
    knowledgeBases: [
      { ...managedLink, createdAt: new Date('2026-07-01T00:00:00Z') },
    ],
    mcpConfigurations: legacyConfigurations,
  })
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).toHaveBeenCalledTimes(1)
})
