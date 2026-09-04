import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  convertToModelMessages: vi.fn(),
  createDocsQueryBundle: vi.fn(),
  getAuthenticatedManageUser: vi.fn(),
  isManageAiEnabled: vi.fn(),
  lecturerClose: vi.fn(),
  loadLecturerMcpTools: vi.fn(),
  docsClose: vi.fn(),
  rateLimitCheck: vi.fn(),
  readBoundedJson: vi.fn(),
  streamText: vi.fn(),
  tryAcquireManageChatRequest: vi.fn(),
}))

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  convertToModelMessages: mocks.convertToModelMessages,
  streamText: mocks.streamText,
}))

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn(() => ({ modelId: 'test-model' }))),
}))

// These cases are about what the route does after the gate, so the gate itself
// is stubbed open here; its own two conditions are covered in the feature flag
// package and by the flag being off in every environment that has no rule.
vi.mock('@/src/lib/server/featureFlags', () => ({
  isManageAiEnabled: mocks.isManageAiEnabled,
}))

vi.mock('@/src/lib/server/manageAuth', () => ({
  getAuthenticatedManageUser: mocks.getAuthenticatedManageUser,
}))

vi.mock('@/src/services/rateLimiter', () => ({
  createRateLimiter: () => ({ check: mocks.rateLimitCheck }),
}))

vi.mock('@/src/lib/server/manageChatRequest', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/src/lib/server/manageChatRequest')
  >()),
  readBoundedJson: mocks.readBoundedJson,
  tryAcquireManageChatRequest: mocks.tryAcquireManageChatRequest,
}))

vi.mock('@/src/lib/server/chatModelRegistry', () => ({
  getChatModelRegistry: vi.fn(() => []),
}))

vi.mock('@/src/services/docsSearchTool', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/services/docsSearchTool')>()),
  createKlickerDocsQueryToolBundle: mocks.createDocsQueryBundle,
}))

vi.mock('@/src/services/lecturerMcp', () => ({
  loadLecturerMcpTools: mocks.loadLecturerMcpTools,
}))

vi.mock('@/src/services/manageAssistantRuntime', () => ({
  buildManageAssistantSystemPrompt: vi.fn(() => 'system prompt'),
  getManageAssistantOpenAIProviderOptions: vi.fn(() => ({})),
  selectManageAssistantModel: vi.fn(() => ({
    deploymentId: 'test-deployment',
    maxOutputTokens: 100,
  })),
}))

import { POST } from '@/src/app/api/manage/chat/route'

function request() {
  return new NextRequest('https://chat.test/api/manage/chat', {
    body: '{"private":"do not expose"}',
    method: 'POST',
  })
}

async function expectJson(response: Response, status: number, body: unknown) {
  expect(response.status).toBe(status)
  await expect(response.json()).resolves.toEqual(body)
}

describe('POST /api/manage/chat request boundary', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'synthetic-model-key')
    mocks.convertToModelMessages.mockReset()
    mocks.convertToModelMessages.mockResolvedValue([])
    mocks.createDocsQueryBundle.mockReset()
    mocks.docsClose.mockReset()
    mocks.createDocsQueryBundle.mockReturnValue({
      close: mocks.docsClose,
      tools: {},
    })
    mocks.isManageAiEnabled.mockReset()
    mocks.isManageAiEnabled.mockResolvedValue(true)
    mocks.getAuthenticatedManageUser.mockReset()
    mocks.rateLimitCheck.mockReset()
    mocks.readBoundedJson.mockReset()
    mocks.lecturerClose.mockReset()
    mocks.loadLecturerMcpTools.mockReset()
    mocks.loadLecturerMcpTools.mockResolvedValue({
      capabilityState: 'draft-and-read',
      close: mocks.lecturerClose,
      sentinel: 'route-test-sentinel',
      tools: {},
    })
    mocks.streamText.mockReset()
    mocks.streamText.mockReturnValue({
      toUIMessageStreamResponse: vi.fn(() => new Response(null)),
    })
    mocks.tryAcquireManageChatRequest.mockReset()
    mocks.getAuthenticatedManageUser.mockResolvedValue({
      role: 'USER',
      scope: 'FULL_ACCESS',
      sub: 'lecturer-1',
    })
    mocks.rateLimitCheck.mockReturnValue({
      allowed: true,
      remaining: 29,
      retryAfterMs: 0,
    })
    mocks.readBoundedJson.mockResolvedValue({
      error: 'INVALID_JSON',
      ok: false,
    })
    mocks.tryAcquireManageChatRequest.mockReturnValue(vi.fn())
  })

  test('returns 401 before rate limiting or reading the request', async () => {
    mocks.getAuthenticatedManageUser.mockResolvedValue(null)

    await expectJson(await POST(request()), 401, { error: 'Unauthorized' })
    expect(mocks.rateLimitCheck).not.toHaveBeenCalled()
    expect(mocks.readBoundedJson).not.toHaveBeenCalled()
  })

  test('returns 429 after admission but before reading the request', async () => {
    const release = vi.fn()
    mocks.tryAcquireManageChatRequest.mockReturnValue(release)
    mocks.rateLimitCheck.mockReturnValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 1200,
    })

    const response = await POST(request())
    await expectJson(response, 429, { error: 'Too many requests' })
    expect(response.headers.get('retry-after')).toBe('2')
    expect(mocks.readBoundedJson).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledTimes(1)
  })

  test('returns a retryable 503 without consuming rate budget or reading a competing request', async () => {
    mocks.tryAcquireManageChatRequest.mockReturnValue(null)

    const response = await POST(request())
    await expectJson(response, 503, { error: 'Manage assistant is busy' })
    expect(response.headers.get('retry-after')).toBe('1')
    expect(mocks.rateLimitCheck).not.toHaveBeenCalled()
    expect(mocks.readBoundedJson).not.toHaveBeenCalled()
  })

  test('maps oversized bodies to the exact generic 413 contract', async () => {
    mocks.readBoundedJson.mockResolvedValue({
      error: 'TOO_LARGE',
      ok: false,
    })

    await expectJson(await POST(request()), 413, {
      error: 'Request body too large',
    })
  })

  test('maps malformed and schema-invalid bodies to the generic 400 contract', async () => {
    const release = vi.fn()
    mocks.tryAcquireManageChatRequest.mockReturnValue(release)

    await expectJson(await POST(request()), 400, {
      error: 'Invalid request body',
    })
    expect(release).toHaveBeenCalledTimes(1)

    mocks.readBoundedJson.mockResolvedValue({
      ok: true,
      value: { messages: [null] },
    })
    await expectJson(await POST(request()), 400, {
      error: 'Invalid request body',
    })
    expect(release).toHaveBeenCalledTimes(2)
  })

  test('maps a body deadline to the exact generic 408 contract', async () => {
    mocks.readBoundedJson.mockResolvedValue({
      error: 'TIMEOUT',
      ok: false,
    })

    await expectJson(await POST(request()), 408, {
      error: 'Request timed out',
    })
  })

  test.each([
    'onFinish',
    'onAbort',
    'onError',
  ] as const)('closes both tool clients from %s', async (callbackName) => {
    mocks.readBoundedJson.mockResolvedValue({
      ok: true,
      value: {
        messages: [
          {
            id: 'user-1',
            parts: [{ text: 'Draft a question', type: 'text' }],
            role: 'user',
          },
        ],
      },
    })

    const response = await POST(request())

    expect(response.status).toBe(200)
    const streamOptions = mocks.streamText.mock.calls[0]?.[0]
    expect(streamOptions).toBeDefined()
    const callback = streamOptions?.[callbackName] as
      | ((value?: unknown) => Promise<void>)
      | undefined
    expect(callback).toEqual(expect.any(Function))
    await callback?.(new Error('synthetic stream terminal state'))
    expect(mocks.lecturerClose).toHaveBeenCalledTimes(1)
    expect(mocks.docsClose).toHaveBeenCalledTimes(1)
  })
})
