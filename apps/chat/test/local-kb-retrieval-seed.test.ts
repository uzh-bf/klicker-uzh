import { describe, expect, test, vi } from 'vitest'

vi.mock('@klicker-uzh/util', () => ({
  encrypt: () => 'encrypted-test-value',
}))

import {
  assertIsolatedKbServer,
  normalizeIsolatedKbRetrieval,
} from '../scripts/local-kb-retrieval-seed.mjs'

const RETRIEVAL_URL = 'http://host.docker.internal:18117/mcp'

type ServerRow = {
  id: string
  name: string
  url: string
  authType: string
  authSecret: string | null
  isActive: boolean
  passChatbotId: boolean
  chatbotIdHeader: string | null
}

function parkedServer(overrides: Partial<ServerRow> = {}): ServerRow {
  return {
    id: 'kb-server',
    name: 'KB',
    url: RETRIEVAL_URL,
    authType: 'scope_token',
    authSecret: null,
    isActive: true,
    passChatbotId: false,
    chatbotIdHeader: null,
    ...overrides,
  }
}

function createDb(rows: ServerRow[]) {
  const statements: { text: string; values?: unknown[] }[] = []
  const db = {
    query: async (text: string, values?: unknown[]) => {
      statements.push({ text, values })
      if (text.startsWith('SELECT')) return { rows }
      return { rows: [] }
    },
  }
  return { db, statements }
}

describe('isolated KB retrieval transport normalization', () => {
  test('normalizes the parked seeded server to the transport credential', async () => {
    const { db, statements } = createDb([parkedServer()])

    await normalizeIsolatedKbRetrieval(db, RETRIEVAL_URL, 'transport-token')

    const update = statements.find((statement) =>
      statement.text.startsWith('UPDATE')
    )
    expect(update?.values).toEqual([
      'bearer',
      'encrypted-test-value',
      'kb-server',
    ])
    expect(statements.at(-1)?.text).toBe('COMMIT')
  })

  test('keeps an already normalized server idempotent', async () => {
    const { db, statements } = createDb([
      parkedServer({ authType: 'bearer', authSecret: 'iv:tag:cipher' }),
    ])

    await normalizeIsolatedKbRetrieval(db, RETRIEVAL_URL, 'transport-token')

    expect(
      statements.some((statement) => statement.text.startsWith('UPDATE'))
    ).toBe(true)
    expect(statements.at(-1)?.text).toBe('COMMIT')
  })

  test('rejects a drifted retrieval URL and rolls back', async () => {
    const { db, statements } = createDb([
      parkedServer({ url: 'http://host.docker.internal:19999/mcp' }),
    ])

    await expect(
      normalizeIsolatedKbRetrieval(db, RETRIEVAL_URL, 'transport-token')
    ).rejects.toThrowError(/normalization rejected/)
    expect(
      statements.some((statement) => statement.text.startsWith('UPDATE'))
    ).toBe(false)
    expect(statements.at(-1)?.text).toBe('ROLLBACK')
  })

  test('rejects a missing or duplicated server row', async () => {
    const empty = createDb([])
    await expect(
      normalizeIsolatedKbRetrieval(empty.db, RETRIEVAL_URL, 'transport-token')
    ).rejects.toThrowError(/normalization rejected/)

    const duplicated = createDb([parkedServer(), parkedServer({ id: 'other' })])
    await expect(
      normalizeIsolatedKbRetrieval(
        duplicated.db,
        RETRIEVAL_URL,
        'transport-token'
      )
    ).rejects.toThrowError(/normalization rejected/)
  })

  test('requires both the retrieval URL and a transport credential', async () => {
    const { db, statements } = createDb([parkedServer()])

    await expect(
      normalizeIsolatedKbRetrieval(db, '   ', 'transport-token')
    ).rejects.toThrowError(/URL is not configured/)
    await expect(
      normalizeIsolatedKbRetrieval(db, RETRIEVAL_URL, '')
    ).rejects.toThrowError(/credential is empty/)
    expect(statements).toHaveLength(0)
  })
})

describe('isolated KB server ownership', () => {
  test('accepts the parked and the normalized shape', () => {
    expect(() =>
      assertIsolatedKbServer(parkedServer(), RETRIEVAL_URL)
    ).not.toThrowError()
    expect(() =>
      assertIsolatedKbServer(
        parkedServer({ authType: 'bearer', authSecret: 'iv:tag:cipher' }),
        RETRIEVAL_URL
      )
    ).not.toThrowError()
  })

  test('rejects unowned shapes', () => {
    const rejected: ServerRow[] = [
      parkedServer({ name: 'Context7' }),
      parkedServer({ authType: 'none' }),
      parkedServer({ authType: 'scope_token', authSecret: 'iv:tag:cipher' }),
      parkedServer({ isActive: false }),
      parkedServer({ passChatbotId: true }),
      parkedServer({ chatbotIdHeader: 'Chatbot-ID' }),
    ]
    for (const server of rejected) {
      expect(() => assertIsolatedKbServer(server, RETRIEVAL_URL)).toThrowError()
    }
    expect(() =>
      assertIsolatedKbServer(parkedServer(), 'http://localhost:1417/mcp')
    ).toThrowError(/URL drifted/)
  })
})
