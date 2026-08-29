import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { ResponseExampleStatus } from '@klicker-uzh/prisma/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  loadResponseExampleRuntimeSkill,
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
        sql.values.find((value) => typeof value === 'string')?.toString() ?? ''
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
})
