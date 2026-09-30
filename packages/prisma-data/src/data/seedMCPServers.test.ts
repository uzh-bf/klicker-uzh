import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { seedMCPServers } from './seedMCPServers.js'

// The seed imports a chatbot id and the secret helper from its neighbours; both
// are mocked so the test loads no seed data and no key material.
vi.mock('@klicker-uzh/util', () => ({
  encrypt: () => 'encrypted-test-value',
}))

vi.mock('./seedChatbots.js', () => ({
  CHATBOT_ID_TEST: 'chatbot-test',
}))

const KB_DEFAULT_URL = 'http://localhost:1417/mcp'
const ISOLATED_URL = 'http://host.docker.internal:18117/mcp'

const RUNTIME_ONLY_ENV = 'KLICKER_LOCAL_KB_RUNTIME_ONLY'
const RETRIEVAL_URL_ENV = 'KLICKER_LOCAL_KB_RETRIEVAL_URL'

type ServerWrite = Record<string, unknown>

function createPrismaMock({ kbExists }: { kbExists: boolean }) {
  const creates: ServerWrite[] = []
  const updates: ServerWrite[] = []
  const reads: string[] = []

  const prisma = {
    chatbotMCPServer: {
      findUnique: async ({ where }: { where: { name: string } }) => {
        reads.push(where.name)
        return kbExists && where.name === 'KB' ? { id: 'kb-existing' } : null
      },
      create: async ({ data }: { data: ServerWrite }) => {
        creates.push(data)
        return data
      },
      update: async ({ data }: { data: ServerWrite }) => {
        updates.push(data)
        return data
      },
    },
  } as unknown as PrismaClient

  return { prisma, creates, updates, reads }
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('seedMCPServers isolated local KB runtime', () => {
  it('creates the KB server with the isolated URL and unchanged scope_token auth', async () => {
    vi.stubEnv(RUNTIME_ONLY_ENV, '1')
    vi.stubEnv(RETRIEVAL_URL_ENV, ISOLATED_URL)
    const { prisma, creates, updates } = createPrismaMock({ kbExists: false })

    await seedMCPServers(prisma)

    expect(updates).toHaveLength(0)
    expect(creates.filter((entry) => entry.url === ISOLATED_URL)).toHaveLength(
      1
    )

    const kb = creates.find((entry) => entry.name === 'KB')
    expect(kb?.url).toBe(ISOLATED_URL)
    expect(kb?.authType).toBe('scope_token')
    expect(kb?.authSecret).toBeUndefined()
    expect(kb?.passChatbotId).toBe(false)
  })

  it('updates an existing KB server with the isolated URL and unchanged scope_token auth', async () => {
    vi.stubEnv(RUNTIME_ONLY_ENV, '1')
    vi.stubEnv(RETRIEVAL_URL_ENV, ISOLATED_URL)
    const { prisma, creates, updates } = createPrismaMock({ kbExists: true })

    await seedMCPServers(prisma)

    expect(updates).toHaveLength(1)
    const kb = updates[0]
    expect(kb?.url).toBe(ISOLATED_URL)
    expect(kb?.authType).toBe('scope_token')
    expect(kb?.authSecret).toBeNull()
    expect(kb?.passChatbotId).toBe(false)
    expect(creates.filter((entry) => entry.url === ISOLATED_URL)).toHaveLength(
      0
    )
  })

  it('throws before any database access when the isolated URL is missing', async () => {
    vi.stubEnv(RUNTIME_ONLY_ENV, '1')
    vi.stubEnv(RETRIEVAL_URL_ENV, undefined)
    const { prisma, creates, updates, reads } = createPrismaMock({
      kbExists: false,
    })

    await expect(seedMCPServers(prisma)).rejects.toThrow(RETRIEVAL_URL_ENV)

    expect(reads).toHaveLength(0)
    expect(creates).toHaveLength(0)
    expect(updates).toHaveLength(0)
  })

  const malformedUrls: Array<[string, string]> = [
    ['an empty value', ''],
    ['a non-URL value', 'not-a-url'],
    ['a non-http scheme', 'https://host.docker.internal:18117/mcp'],
    ['a non-bridge host', 'http://127.0.0.1:18117/mcp'],
    ['credentials', 'http://user:secret@host.docker.internal:18117/mcp'],
    ['no explicit port', 'http://host.docker.internal/mcp'],
    ['a privileged port', 'http://host.docker.internal:80/mcp'],
    ['an out-of-range port', 'http://host.docker.internal:70000/mcp'],
    ['a non-mcp path', 'http://host.docker.internal:18117/other'],
    ['a query string', 'http://host.docker.internal:18117/mcp?kb=demo'],
    ['a fragment', 'http://host.docker.internal:18117/mcp#section'],
  ]

  it('rejects malformed isolated URLs before any database access', async () => {
    vi.stubEnv(RUNTIME_ONLY_ENV, '1')

    for (const [label, value] of malformedUrls) {
      vi.stubEnv(RETRIEVAL_URL_ENV, value)
      const { prisma, creates, updates, reads } = createPrismaMock({
        kbExists: false,
      })

      await expect(seedMCPServers(prisma), label).rejects.toThrow(
        RETRIEVAL_URL_ENV
      )

      expect(reads, label).toHaveLength(0)
      expect(creates, label).toHaveLength(0)
      expect(updates, label).toHaveLength(0)
    }
  })

  it('ignores the override when the runtime-only flag is absent or not 1', async () => {
    vi.stubEnv(RETRIEVAL_URL_ENV, ISOLATED_URL)

    for (const runtimeOnly of [undefined, '0', 'true']) {
      vi.stubEnv(RUNTIME_ONLY_ENV, runtimeOnly)

      const createRun = createPrismaMock({ kbExists: false })
      await seedMCPServers(createRun.prisma)

      expect(createRun.updates).toHaveLength(0)
      expect(
        createRun.creates.filter((entry) => entry.url === ISOLATED_URL)
      ).toHaveLength(0)

      const created = createRun.creates.find((entry) => entry.name === 'KB')
      expect(created?.url).toBe(KB_DEFAULT_URL)
      expect(created?.authType).toBe('scope_token')
      expect(created?.authSecret).toBeUndefined()

      const updateRun = createPrismaMock({ kbExists: true })
      await seedMCPServers(updateRun.prisma)

      expect(updateRun.updates[0]?.url).toBe(KB_DEFAULT_URL)
      expect(updateRun.updates[0]?.authType).toBe('scope_token')
      expect(updateRun.updates[0]?.authSecret).toBeNull()
    }
  })
})
