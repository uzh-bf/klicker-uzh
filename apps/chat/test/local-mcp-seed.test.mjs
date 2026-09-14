import { expect, test, vi } from 'vitest'

vi.mock('@klicker-uzh/util', () => ({ encrypt: () => 'synthetic-encrypted' }))

import { LOCAL_CHATBOT_ID } from '../scripts/local-mcp-auth.mjs'
import { repairLocalMcpSeed } from '../scripts/local-mcp-seed.mjs'

const fixture = {
  chatbotId: '11111111-1111-4111-8111-111111111111',
  ownerId: '22222222-2222-4222-8222-222222222222',
  courseId: '33333333-3333-4333-8333-333333333333',
  kbId: '44444444-4444-4444-8444-444444444444',
  chatMode: 'synthetic',
}
const server = {
  id: 'synthetic-server',
  name: 'KB',
  url: 'http://localhost:1417/mcp',
  isActive: true,
  passChatbotId: true,
  chatbotIdHeader: null,
  authType: 'none',
  authSecret: null,
  parameters: null,
}
const configs = ['tutor', 'explainer'].map((chatMode) => ({
  chatbotId: LOCAL_CHATBOT_ID,
  ownerId: '76047345-3801-4628-ae7b-adbebcfe8821',
  courseId: '7c12e44e-d083-4acf-845e-4c34aaff6b49',
  chatMode,
  isEnabled: true,
  priority: 0,
  allowedTools: ['doc_query'],
  parameters: null,
}))
for (const [field, value] of [
  ['ownerId', 'other'],
  ['courseId', 'other'],
  ['status', 'PUBLISHED'],
  ['systemPrompts', {}],
]) {
  test(`rejects mismatched ${field} before any binding or credential write`, async () => {
    const bot = {
      ownerId: fixture.ownerId,
      courseId: fixture.courseId,
      status: 'DRAFT',
      systemPrompts: { synthetic: {} },
      [field]: value,
    }
    const calls = []
    const db = {
      query: async (sql) => {
        calls.push(sql)
        if (sql.startsWith('SELECT * FROM')) return { rows: [server] }
        if (sql.startsWith('SELECT c.')) return { rows: configs }
        if (sql.startsWith('SELECT id,')) return { rows: [bot] }
        return { rows: [] }
      },
    }
    await expect(
      repairLocalMcpSeed(db, 'synthetic-token', () => false, fixture)
    ).rejects.toThrow('Local MCP seed repair rejected')
    expect(calls.some((sql) => /^(INSERT|UPDATE|DELETE)/.test(sql))).toBe(false)
    expect(calls.at(-1)).toBe('ROLLBACK')
  })
}
