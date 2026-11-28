import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { courseImageCandidates } from '../src/lib/sources/courseImages'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  message: vi.fn(),
  chatbot: vi.fn(),
  resource: vi.fn(),
  read: vi.fn(),
}))
vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    chatMessage: { findFirst: mocks.message },
    chatbot: { findUnique: mocks.chatbot },
    kBResource: { findFirst: mocks.resource },
  },
}))
vi.mock('@/src/lib/server/apiGuards', () => ({ withChatbotAuth: mocks.auth }))
vi.mock('@/src/lib/server/courseImageStore', () => ({
  readCourseImage: mocks.read,
}))

import { GET } from '../src/app/api/chatbots/[chatbotId]/threads/[threadId]/messages/[messageId]/images/[assetId]/route'

const fixture = JSON.parse(
  await readFile(
    path.resolve('scripts/fixtures/course-images/query-result.json'),
    'utf8'
  )
)
const image = courseImageCandidates(fixture)[0]!
const LINK_ID = '4c1f2f0e-6d1a-4a56-9a2f-7d2b6f2f6f01'
const server = { id: 'server', name: 'KB' }
const legacyConfigurations = [
  {
    chatMode: 'tutor',
    isEnabled: true,
    allowedTools: ['doc_query'],
    parameters: {
      required: true,
      toolAlias: 'doc_query',
      kb_id: image.kb_id,
    },
    mcpServer: server,
  },
]
const managedLink = {
  id: LINK_ID,
  kbId: image.kb_id,
  isEnabled: true,
  isDefault: true,
  kb: { deletedAt: null, knowledgeGraphEnabled: true, name: 'Casebook' },
}
const provenance = {
  type: 'data' as const,
  name: 'retrieval-source',
  data: {
    chatMode: 'tutor',
    kbId: image.kb_id,
    kbLinkId: LINK_ID,
    revisionVersion: 3,
  },
}
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
  mocks.chatbot.mockResolvedValue({
    knowledgeBases: [],
    mcpConfigurations: legacyConfigurations,
  })
  mocks.resource.mockResolvedValue({ id: image.external_resource_id })
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
  mocks.chatbot.mockResolvedValue({
    knowledgeBases: [],
    mcpConfigurations: [],
  })
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})
it('replays a managed image while its original link is still the mode source', async () => {
  mocks.message.mockResolvedValue({
    chatMode: 'tutor',
    content: [
      {
        type: 'tool-call',
        toolName: 'show_course_image',
        result: { status: 'selected', image },
      },
      provenance,
    ],
  })
  mocks.chatbot.mockResolvedValue({
    knowledgeBases: [managedLink],
    mcpConfigurations: legacyConfigurations,
  })
  expect((await GET(req, { params })).status).toBe(200)
})
it('refuses managed replay when the mode no longer has document access', async () => {
  mocks.message.mockResolvedValue({
    chatMode: 'tutor',
    content: [
      {
        type: 'tool-call',
        toolName: 'show_course_image',
        result: { status: 'selected', image },
      },
      provenance,
    ],
  })
  mocks.chatbot.mockResolvedValue({
    knowledgeBases: [managedLink],
    mcpConfigurations: legacyConfigurations.map((configuration) => ({
      ...configuration,
      isEnabled: false,
    })),
  })

  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})
it('keeps serving an image stored before provenance markers', async () => {
  mocks.message.mockResolvedValue({
    chatMode: null,
    createdAt: new Date('2026-06-01T00:00:00Z'),
    content: [
      {
        type: 'tool-call',
        toolName: 'show_course_image',
        result: { status: 'selected', image },
      },
    ],
  })
  mocks.chatbot.mockResolvedValue({
    knowledgeBases: [
      { ...managedLink, createdAt: new Date('2026-05-01T00:00:00Z') },
    ],
    mcpConfigurations: legacyConfigurations,
  })
  expect((await GET(req, { params })).status).toBe(200)
})
it('requires current document access for an unmarked Quizzer image', async () => {
  mocks.message.mockResolvedValue({
    chatMode: 'quizzer',
    createdAt: new Date('2026-06-01T00:00:00Z'),
    content: [
      {
        type: 'tool-call',
        toolName: 'show_course_image',
        result: { status: 'selected', image },
      },
    ],
  })
  mocks.chatbot.mockResolvedValue({
    knowledgeBases: [
      { ...managedLink, createdAt: new Date('2026-05-01T00:00:00Z') },
    ],
    mcpConfigurations: [
      ...legacyConfigurations,
      { ...legacyConfigurations[0], chatMode: 'quizzer', isEnabled: false },
    ],
  })
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})

it('refuses an unmarked image when its KB was reattached after the message', async () => {
  mocks.message.mockResolvedValue({
    chatMode: 'tutor',
    createdAt: new Date('2026-06-01T00:00:00Z'),
    content: [
      {
        type: 'tool-call',
        toolName: 'show_course_image',
        result: { status: 'selected', image },
      },
    ],
  })
  mocks.chatbot.mockResolvedValue({
    knowledgeBases: [
      { ...managedLink, createdAt: new Date('2026-07-01T00:00:00Z') },
    ],
    mcpConfigurations: legacyConfigurations,
  })
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})
it('refuses an unmarked image after its mode is repointed to another link', async () => {
  const otherLinkId = '9a5f2b31-0c86-4f2b-8a10-c3d0e5f5b902'
  const createdAt = new Date('2026-05-01T00:00:00Z')
  mocks.message.mockResolvedValue({
    chatMode: 'cm_case',
    createdAt: new Date('2026-06-01T00:00:00Z'),
    content: [
      {
        type: 'tool-call',
        toolName: 'show_course_image',
        result: { status: 'selected', image },
      },
    ],
  })
  mocks.chatbot.mockResolvedValue({
    knowledgeBases: [
      { ...managedLink, createdAt },
      {
        ...managedLink,
        id: otherLinkId,
        isDefault: false,
        kbId: '0b6c4c1a-9d3e-4f1e-9b0c-1d2e3f4a5b6c',
        createdAt,
      },
    ],
    customModeConfig: {
      modes: [
        { key: 'cm_case', name: 'Case', knowledgeBaseLinkId: otherLinkId },
      ],
    },
    mcpConfigurations: legacyConfigurations,
  })
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})
it('refuses a malformed provenance marker instead of falling back', async () => {
  mocks.message.mockResolvedValue({
    chatMode: 'tutor',
    createdAt: new Date('2026-06-01T00:00:00Z'),
    content: [
      {
        type: 'tool-call',
        toolName: 'show_course_image',
        result: { status: 'selected', image },
      },
      { ...provenance, data: { chatMode: 'tutor' } },
    ],
  })
  mocks.chatbot.mockResolvedValue({
    knowledgeBases: [
      { ...managedLink, createdAt: new Date('2026-05-01T00:00:00Z') },
    ],
    mcpConfigurations: legacyConfigurations,
  })
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})
it('refuses replay after the mode is repointed to another live link', async () => {
  const otherLinkId = '9a5f2b31-0c86-4f2b-8a10-c3d0e5f5b902'
  mocks.message.mockResolvedValue({
    chatMode: 'cm_case',
    content: [
      {
        type: 'tool-call',
        toolName: 'show_course_image',
        result: { status: 'selected', image },
      },
      { ...provenance, data: { ...provenance.data, chatMode: 'cm_case' } },
    ],
  })
  mocks.chatbot.mockResolvedValue({
    knowledgeBases: [
      { ...managedLink, isDefault: false, isEnabled: true },
      {
        ...managedLink,
        id: otherLinkId,
        kbId: '0b6c4c1a-9d3e-4f1e-9b0c-1d2e3f4a5b6c',
      },
    ],
    customModeConfig: {
      modes: [
        {
          key: 'cm_case',
          knowledgeBaseLinkId: otherLinkId,
        },
      ],
    },
    mcpConfigurations: legacyConfigurations,
  })
  expect((await GET(req, { params })).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})
it('revokes access when the selected resource version is no longer serving', async () => {
  mocks.resource.mockResolvedValue(null)
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
it('logs storage failures while keeping the response sanitized', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.read.mockRejectedValue(new Error('/private/secret'))
  const response = await GET(req, { params })
  expect(response.status).toBe(404)
  expect(await response.json()).toEqual({ error: 'Course image unavailable' })
  expect(consoleError).toHaveBeenCalledWith(
    'Failed to serve authorized course image',
    expect.any(Error)
  )
  consoleError.mockRestore()
})
