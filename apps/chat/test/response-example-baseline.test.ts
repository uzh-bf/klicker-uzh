import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findCase: vi.fn(),
  findBot: vi.fn(),
  updateCase: vi.fn(),
  resources: vi.fn(),
  claim: vi.fn(),
  dispatch: vi.fn(),
  settle: vi.fn(),
  release: vi.fn(),
  model: vi.fn(),
  close: vi.fn(),
  tools: vi.fn(),
}))
vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    responseExampleBaselineCase: {
      findFirst: mocks.findCase,
      updateMany: mocks.updateCase,
    },
    chatbot: { findFirst: mocks.findBot },
  },
}))
vi.mock('@klicker-uzh/graphql/dist/responseExampleBaselineAccounting', () => ({
  claimBaselineOperation: mocks.claim,
  markBaselineOperationDispatched: mocks.dispatch,
  settleBaselineOperation: mocks.settle,
  releaseBaselineOperation: mocks.release,
}))
vi.mock('@klicker-uzh/util/response-example-eligibility', async (original) => ({
  ...(await original<
    typeof import('@klicker-uzh/util/response-example-eligibility')
  >()),
  loadCurrentResponseExampleResources: mocks.resources,
}))
vi.mock('@/src/lib/server/chatModelProvider', () => ({
  getChatModel: () => ({ model: mocks.model() }),
}))
vi.mock('@/src/lib/server/chatModelRegistry', () => ({
  getChatModelRegistry: () => [modelConfig],
}))
vi.mock('@/src/services/mcpClients', () => ({
  getAggregatedMCPTools: async () => ({
    tools: mocks.tools(),
    close: mocks.close,
  }),
}))

import { signResponseExampleBaselineJob } from '@klicker-uzh/util/auth'
import {
  computeResponseExampleBaselineConfigurationDigest,
  computeResponseExampleBaselineValueDigest,
} from '@klicker-uzh/util/response-example-runtime'
import { tool } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { POST } from '@/src/app/api/internal/response-example-baseline/route'
import { executeResponseExampleBaselineCase } from '@/src/lib/server/responseExampleBaseline'

const scope = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  chatbotId: '22222222-2222-4222-8222-222222222222',
  runId: '33333333-3333-4333-8333-333333333333',
  caseId: '44444444-4444-4444-8444-444444444444',
}
const modelConfig = {
  id: 'gpt-6-luna',
  deploymentId: 'gpt-6-luna',
  usageClass: 'BASE',
  maxOutputTokens: 4096,
  usesResponsesApi: true,
  supportsReasoning: false,
  supportedReasoningEfforts: [],
  cost: { input: 0.1, output: 0.5 },
}
const chatbot = {
  id: scope.chatbotId,
  ownerId: scope.ownerId,
  systemPrompts: {},
  standardModeConfig: { tutorEnabled: true },
  customModeConfig: null,
  draftConfig: null,
  answerPreferencesEnabled: true,
  knowledgeGraphRetrievalEnabled: false,
  openaiApiKey: null,
  openaiBaseUrl: null,
  knowledgeBases: [],
  mcpConfigurations: [],
  course: { displayName: 'Synthetic course' },
}
const evidence = {
  citationIndex: 1,
  sourceId: '55555555-5555-4555-8555-555555555555',
  chunkId: 'synthetic-chunk',
  contentHash: 'a'.repeat(64),
  citationAnchor: 'page 1',
}
const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
}
const ideal = 'synthetic-reference-must-not-enter-target'
beforeEach(() => {
  vi.clearAllMocks()
  const report = {
    ownerId: scope.ownerId,
    status: 'RUNNING',
    deadline: new Date(Date.now() + 60_000),
    setDigest: 'digest',
    configurationDigest:
      computeResponseExampleBaselineConfigurationDigest(chatbot),
    modelConfigurationDigest: computeResponseExampleBaselineValueDigest({
      id: modelConfig.id,
      deploymentId: modelConfig.deploymentId,
      maxOutputTokens: modelConfig.maxOutputTokens,
      usesResponsesApi: true,
      cost: modelConfig.cost,
      supportedReasoningEfforts: [],
    }),
    set: { chatbotId: scope.chatbotId, digest: 'digest' },
  }
  mocks.findCase.mockImplementation(async (args) =>
    args.select?.idealAnswer
      ? { idealAnswer: ideal, actualAnswer: 'synthetic' }
      : {
          id: scope.caseId,
          question: 'synthetic question',
          chatMode: 'tutor',
          expectedEvidence: [evidence],
          status: 'PENDING',
          report,
        }
  )
  mocks.findBot.mockResolvedValue(chatbot)
  mocks.resources.mockResolvedValue([
    {
      id: evidence.sourceId,
      deletedAt: null,
      activeContentSha256: evidence.contentHash,
    },
  ])
  mocks.updateCase.mockResolvedValue({ count: 1 })
  mocks.claim.mockResolvedValue({ id: 'operation-id' })
  mocks.dispatch.mockResolvedValue(true)
  mocks.settle.mockResolvedValue('SETTLED')
  mocks.close.mockResolvedValue(undefined)
  mocks.tools.mockReturnValue({})
})

describe('baseline execution boundary', () => {
  it('sends only the question and excluded skill to the actual SDK transport, settles usage and marks missing sources unassessed', async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-start', id: 'text' })
            controller.enqueue({
              type: 'text-delta',
              id: 'text',
              delta: 'synthetic output',
            })
            controller.enqueue({ type: 'text-end', id: 'text' })
            controller.enqueue({
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage,
            })
            controller.close()
          },
        }),
      }),
    })
    mocks.model.mockReturnValue(model)
    const result = await executeResponseExampleBaselineCase(scope)
    expect(result).toEqual({ completed: false, continueRun: true })
    expect(model.doStreamCalls).toHaveLength(1)
    expect(JSON.stringify(model.doStreamCalls)).not.toContain(ideal)
    expect(
      mocks.findCase.mock.calls.every(([args]) => !args.select?.idealAnswer)
    ).toBe(true)
    expect(mocks.settle).toHaveBeenCalledWith(expect.anything(), {
      operationId: 'operation-id',
      inputTokens: 10,
      outputTokens: 5,
      usageComplete: true,
    })
    expect(mocks.updateCase).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'UNASSESSED' }),
      })
    )
    expect(mocks.close).toHaveBeenCalledOnce()
  })
  it('completes grounded target generation before opening the reference and charges both stages', async () => {
    let targetFinished = false
    mocks.findCase.mockImplementation(async (args) => {
      if (args.select?.idealAnswer) {
        expect(targetFinished).toBe(true)
        expect(mocks.settle).toHaveBeenCalledTimes(1)
        return { idealAnswer: ideal, actualAnswer: 'synthetic output [1]' }
      }
      return {
        id: scope.caseId,
        question: 'synthetic question',
        chatMode: 'tutor',
        expectedEvidence: [evidence],
        status: 'PENDING',
        report: {
          ownerId: scope.ownerId,
          status: 'RUNNING',
          deadline: new Date(Date.now() + 60_000),
          setDigest: 'digest',
          configurationDigest:
            computeResponseExampleBaselineConfigurationDigest(chatbot),
          modelConfigurationDigest: computeResponseExampleBaselineValueDigest({
            id: modelConfig.id,
            deploymentId: modelConfig.deploymentId,
            maxOutputTokens: 4096,
            usesResponsesApi: true,
            cost: modelConfig.cost,
            supportedReasoningEfforts: [],
          }),
          set: { chatbotId: scope.chatbotId, digest: 'digest' },
        },
      }
    })
    mocks.tools.mockReturnValue({
      KB_doc_query: tool({
        inputSchema: z.object({}),
        execute: async () => ({
          sources: [
            {
              expert: 'Synthetic',
              file_name: 'synthetic.pdf',
              source_id: evidence.sourceId,
              chunk_id: evidence.chunkId,
              content_hash: evidence.contentHash,
              citation_anchor: evidence.citationAnchor,
            },
          ],
        }),
      }),
    })
    let streamCall = 0
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            streamCall++
            if (streamCall === 1)
              controller.enqueue({
                type: 'tool-call',
                toolCallId: 'search',
                toolName: 'KB_doc_query',
                input: '{}',
              })
            else {
              controller.enqueue({ type: 'text-start', id: 'text' })
              controller.enqueue({
                type: 'text-delta',
                id: 'text',
                delta: 'synthetic output [1]',
              })
              controller.enqueue({ type: 'text-end', id: 'text' })
              targetFinished = true
            }
            controller.enqueue({
              type: 'finish',
              finishReason: {
                unified: streamCall === 1 ? 'tool-calls' : 'stop',
                raw: streamCall === 1 ? 'tool_calls' : 'stop',
              },
              usage,
            })
            controller.close()
          },
        }),
      }),
      doGenerate: async (request) => {
        expect(targetFinished).toBe(true)
        expect(JSON.stringify(request.prompt)).toContain(ideal)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'PASS',
                explanation: 'Synthetic assessment',
              }),
            },
          ],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage,
          warnings: [],
        }
      },
    })
    mocks.model.mockReturnValue(model)
    const result = await executeResponseExampleBaselineCase(scope)
    expect(result).toEqual({ completed: true, continueRun: true })
    expect(model.doStreamCalls).toHaveLength(2)
    expect(model.doGenerateCalls).toHaveLength(1)
    expect(JSON.stringify(model.doStreamCalls)).not.toContain(ideal)
    expect(
      mocks.settle.mock.calls.map(([, value]) => [
        value.inputTokens,
        value.outputTokens,
      ])
    ).toEqual([
      [20, 10],
      [10, 5],
    ])
    expect(mocks.updateCase).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
          assessment: expect.objectContaining({
            status: 'PASS',
            sourceSupport: 'UNASSESSED',
          }),
        }),
      })
    )
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('charges completed steps and retains uncertain accounting after a later provider failure', async () => {
    mocks.tools.mockReturnValue({
      KB_doc_query: tool({
        inputSchema: z.object({}),
        execute: async () => ({}),
      }),
    })
    let calls = 0
    const model = new MockLanguageModelV4({
      doStream: async () => {
        calls++
        if (calls > 1) throw new Error('synthetic provider failure')
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({
                type: 'tool-call',
                toolCallId: 'search',
                toolName: 'KB_doc_query',
                input: '{}',
              })
              controller.enqueue({
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
                usage,
              })
              controller.close()
            },
          }),
        }
      },
    })
    mocks.model.mockReturnValue(model)
    mocks.settle.mockResolvedValue('UNCERTAIN')
    expect(await executeResponseExampleBaselineCase(scope)).toEqual({
      completed: false,
      continueRun: false,
    })
    expect(mocks.settle).toHaveBeenCalledWith(expect.anything(), {
      operationId: 'operation-id',
      inputTokens: 10,
      outputTokens: 5,
      usageComplete: false,
    })
    expect(model.doGenerateCalls).toHaveLength(0)
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('never calls the provider when operation dispatch is denied', async () => {
    const model = new MockLanguageModelV4({})
    mocks.model.mockReturnValue(model)
    mocks.dispatch.mockResolvedValue(false)
    expect(await executeResponseExampleBaselineCase(scope)).toEqual({
      completed: false,
      continueRun: false,
    })
    expect(model.doStreamCalls).toHaveLength(0)
    expect(mocks.settle).not.toHaveBeenCalled()
    expect(mocks.close).toHaveBeenCalledOnce()
  })
  it('rejects missing, expired and mismatched signed worker authority before execution', async () => {
    const secret = 'example-test-baseline-job-secret-long-enough'
    vi.stubEnv('RESPONSE_EXAMPLE_BASELINE_JOB_SECRET', secret)
    const request = (token?: string) =>
      new NextRequest(
        'http://localhost/api/internal/response-example-baseline',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(scope),
        }
      )
    expect((await POST(request())).status).toBe(401)
    const expired = await signResponseExampleBaselineJob(
      scope,
      secret,
      new Date(Date.now() - 120_000)
    )
    expect((await POST(request(expired))).status).toBe(401)
    const mismatched = await signResponseExampleBaselineJob(
      { ...scope, ownerId: evidence.sourceId },
      secret
    )
    expect((await POST(request(mismatched))).status).toBe(401)
    expect(mocks.claim).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })
})
