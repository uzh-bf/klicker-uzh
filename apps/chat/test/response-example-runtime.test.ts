import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { ResponseExampleStatus } from '@klicker-uzh/prisma/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  createResponseExampleSearchTool,
  loadResponseExampleRuntimeSkill,
  RESPONSE_EXAMPLE_RUNTIME_MAX_EXAMPLES,
  RESPONSE_EXAMPLE_SEARCH_TOOL_NAME,
} from '../src/lib/server/responseExampleRuntime'

const currentSet = {
  digest: 'synthetic-set-digest',
  examples: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      chatMode: 'tutor',
      responseStyle: 'GUIDED_QUESTIONS',
      status: ResponseExampleStatus.APPROVED,
      evidenceReferences: [{ evidenceEligible: true }],
    },
  ],
} as never

afterEach(() => {
  vi.restoreAllMocks()
})

describe('response-example runtime skill', () => {
  test('keeps the excluded role empty without reading response examples', async () => {
    const prisma = new Proxy(
      {},
      {
        get() {
          throw new Error('excluded role must not access Prisma')
        },
      }
    ) as PrismaClient
    const reconcile = vi.fn(async () => currentSet)

    const skill = await loadResponseExampleRuntimeSkill({
      prisma,
      chatbotId: '00000000-0000-4000-8000-000000000002',
      chatMode: 'tutor',
      role: 'excluded',
      reconcile,
    })

    expect(skill.summary).toBe('')
    expect(skill.setDigest).toBeNull()
    expect(skill.projectionDigest).toHaveLength(64)
    expect(await skill.search('bounded question')).toEqual({
      degraded: false,
      examples: [],
    })
    expect(reconcile).not.toHaveBeenCalled()
    expect(RESPONSE_EXAMPLE_SEARCH_TOOL_NAME).toBe('search_response_examples')
  })

  test('bounds the database query and degrades without aborting the caller', async () => {
    let capturedQuery = ''
    const queryRaw = vi.fn(async (sql: { values: unknown[] }) => {
      capturedQuery =
        sql.values
          .find((value) => typeof value === 'string' && value.length === 4_000)
          ?.toString() ?? ''
      throw new Error('synthetic search failure')
    })
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaClient
    const reconcile = vi.fn(async () => currentSet)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const skill = await loadResponseExampleRuntimeSkill({
      prisma,
      chatbotId: '00000000-0000-4000-8000-000000000002',
      chatMode: 'tutor',
      role: 'included',
      reconcile,
    })
    const result = await skill.search(`  ${'query '.repeat(1_000)}`)

    expect(skill.summary).toContain('1 lecturer-approved response example')
    expect(skill.setDigest).toBe('synthetic-set-digest')
    expect(skill.projectionDigest).toHaveLength(64)
    expect(capturedQuery).toHaveLength(4_000)
    expect(result).toEqual({ degraded: true, examples: [] })
    expect(reconcile).toHaveBeenCalledTimes(2)
  })

  test('keeps full search results model-only and emits an opaque tool status', async () => {
    const modelResult = {
      degraded: false,
      examples: [
        {
          id: '00000000-0000-4000-8000-000000000003',
          responseStyle: 'GUIDED_QUESTIONS',
          studentMessage: 'Private lecturer example question',
          referenceAnswer: 'Private lecturer ideal answer',
          sourceAnchors: [{ citationIndex: 1, citationAnchor: 'page 1' }],
        },
      ],
    }
    const search = vi.fn(async () => modelResult)
    const searchTool = createResponseExampleSearchTool({
      summary: 'summary',
      setDigest: 'set-digest',
      projectionDigest: 'projection-digest',
      search,
    })

    const visibleOutput = (await searchTool.execute!(
      { query: 'current question' },
      {
        toolCallId: 'tool-call-1',
        messages: [],
        context: undefined,
      } as never
    )) as { kind: 'response-example-search'; status: 'completed' }
    const modelOutput = await searchTool.toModelOutput!({
      toolCallId: 'tool-call-1',
      input: { query: 'current question' },
      output: visibleOutput,
    })

    expect(visibleOutput).toEqual({
      kind: 'response-example-search',
      status: 'completed',
    })
    expect(JSON.stringify(visibleOutput)).not.toContain('Private lecturer')
    expect(modelOutput).toEqual({
      type: 'text',
      value: JSON.stringify(modelResult),
    })
    expect(search).toHaveBeenCalledWith('current question')
  })

  test('omits the skill when a set exceeds the first-release runtime cap', async () => {
    const oversizedSet = {
      digest: 'synthetic-set-digest',
      examples: Array.from(
        { length: RESPONSE_EXAMPLE_RUNTIME_MAX_EXAMPLES + 1 },
        (_, index) => ({
          id: `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`,
          chatMode: 'tutor',
          responseStyle: 'GUIDED_QUESTIONS',
          status: ResponseExampleStatus.APPROVED,
          evidenceReferences: [{ evidenceEligible: true }],
        })
      ),
    } as never

    await expect(
      loadResponseExampleRuntimeSkill({
        prisma: {} as PrismaClient,
        chatbotId: '00000000-0000-4000-8000-000000000002',
        chatMode: 'tutor',
        role: 'included',
        reconcile: async () => oversizedSet,
      })
    ).rejects.toThrow('Response-example set exceeds the runtime limit')
  })
})
