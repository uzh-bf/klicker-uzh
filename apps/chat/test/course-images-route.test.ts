import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { courseImageCandidates } from '../src/lib/sources/courseImages'

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
vi.mock('@/src/lib/server/courseImageStore', () => ({
  readCourseImage: mocks.read,
}))
vi.mock('@/src/services/mcpScope', () => ({ resolveMcpScope: mocks.scope }))

import { GET } from '../src/app/api/chatbots/[chatbotId]/threads/[threadId]/messages/[messageId]/images/[assetId]/route'

const fixture = JSON.parse(
  await readFile(
    path.resolve('scripts/fixtures/course-images/query-result.json'),
    'utf8'
  )
)
const image = courseImageCandidates(fixture)[0]!
const req = new NextRequest('http://localhost/api/test')
const params = Promise.resolve({
  chatbotId: 'bot',
  threadId: 'thread',
  messageId: 'message',
  assetId: image.asset_id,
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
        toolName: 'show_course_image',
        result: { status: 'selected', image },
      },
    ],
  })
  mocks.chatbot.mockResolvedValue({ mcpConfigurations: [] })
  mocks.scope.mockReturnValue([image.kb_id])
  mocks.read.mockResolvedValue(Buffer.from('png'))
})
it('requires authentication before storage access', async () => {
  mocks.auth.mockResolvedValue({
    response: NextResponse.json({}, { status: 401 }),
  })
  expect((await GET(req, { params })).status).toBe(401)
  expect(mocks.message).not.toHaveBeenCalled()
  expect(mocks.read).not.toHaveBeenCalled()
})
it('scopes the persisted message lookup to this participant and chatbot', async () => {
  const response = await GET(req, { params })
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
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
it('does not serve another participant message or an arbitrary image id', async () => {
  mocks.message.mockResolvedValue(null)
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})
it('revokes access when the chatbot no longer has the KB binding', async () => {
  mocks.scope.mockReturnValue([])
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})
it('does not serve an unselected candidate', async () => {
  mocks.message.mockResolvedValue({
    chatMode: 'tutor',
    content: [{ type: 'tool-call', toolName: 'KB_doc_query', result: fixture }],
  })
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})
