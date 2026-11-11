import { describe, expect, it } from 'vitest'
import {
  buildConversationExport,
  type ExportMessage,
  type ExportRosterEntry,
  escapeCsvValue,
  extractVisibleText,
  orderThreadMessages,
  toIndexCsv,
  toTranscriptHtml,
} from '../src/lib/server/conversationExport'

const metadata = {
  chatbotId: 'bot',
  chatbotName: 'Case bot',
  courseId: 'course',
  courseName: 'Course',
  exportedAt: new Date('2026-12-16T10:00:00Z'),
  windowFrom: null,
  windowTo: null,
}

function message(
  id: string,
  minute: number,
  overrides: Partial<ExportMessage> = {}
): ExportMessage {
  return {
    id,
    parentId: null,
    role: 'user',
    content: [{ type: 'text', text: id }],
    chatMode: 'exam',
    modelId: 'model',
    lifecycleStatus: 'COMPLETED',
    attachmentTypes: [],
    createdAt: new Date(Date.UTC(2026, 11, 16, 9, minute)),
    ...overrides,
  }
}

function rosterEntry(
  overrides: Partial<ExportRosterEntry> = {}
): ExportRosterEntry {
  return {
    participantId: 'p1',
    username: 'student1',
    email: null,
    invitationEmail: null,
    invitationMatriculationNumber: null,
    assessmentGivenName: null,
    assessmentSurname: null,
    assessmentMatriculationNumber: null,
    joined: true,
    ...overrides,
  }
}

describe('extractVisibleText', () => {
  it('drops reasoning and tool parts and keeps visible text', () => {
    expect(
      extractVisibleText([
        { type: 'reasoning', text: 'hidden chain' },
        { type: 'tool-doc_query', input: {} },
        { type: 'text', text: 'visible answer' },
      ])
    ).toBe('visible answer')
  })
})

describe('orderThreadMessages', () => {
  it('labels alternatives after an edited or regenerated turn', () => {
    const { ordered, hasBranches } = orderThreadMessages([
      message('q1', 0),
      message('a1', 1, { parentId: 'q1', role: 'assistant' }),
      message('a1-retry', 2, { parentId: 'q1', role: 'assistant' }),
    ])

    expect(hasBranches).toBe(true)
    expect(ordered.map(({ message, branch }) => [message.id, branch])).toEqual([
      ['q1', '1'],
      ['a1', '1.1'],
      ['a1-retry', '1.2'],
    ])
  })

  it('treats parentless legacy rows as one linear conversation', () => {
    const { ordered, hasBranches } = orderThreadMessages([
      message('second', 2),
      message('first', 1),
    ])

    expect(hasBranches).toBe(false)
    expect(ordered.map(({ message }) => message.id)).toEqual([
      'first',
      'second',
    ])
  })
})

describe('buildConversationExport', () => {
  it('reconciles the roster without choosing among several conversations', () => {
    const exported = buildConversationExport({
      metadata,
      roster: [
        rosterEntry({
          participantId: 'p1',
          assessmentGivenName: 'Ada',
          assessmentSurname: 'Example',
          assessmentMatriculationNumber: '00-000-001',
        }),
        rosterEntry({ participantId: 'p2', username: 'student2' }),
        rosterEntry({
          participantId: null,
          username: null,
          invitationEmail: 'invited@example.org',
          joined: false,
        }),
      ],
      threads: [
        {
          id: 't1',
          participantId: 'p1',
          title: null,
          createdAt: new Date('2026-12-16T09:00:00Z'),
          messages: [
            message('q1', 0),
            message('a1', 1, {
              parentId: 'q1',
              role: 'assistant',
              lifecycleStatus: 'FAILED',
            }),
          ],
        },
        {
          id: 't2',
          participantId: 'p1',
          title: null,
          createdAt: new Date('2026-12-16T09:10:00Z'),
          messages: [message('q2', 10, { attachmentTypes: ['IMAGE'] })],
        },
        {
          id: 't3',
          participantId: 'outsider',
          title: null,
          createdAt: new Date('2026-12-16T09:20:00Z'),
          messages: [message('q3', 20)],
        },
      ],
    })

    const byId = new Map(
      exported.students.map((student) => [
        student.participantId ?? student.identity.email,
        student,
      ])
    )
    expect(byId.get('p1')).toMatchObject({
      conversationStatus: 'several',
      incompleteAnswers: 1,
      attachmentCount: 1,
      identity: { source: 'assessment', matriculationNumber: '00-000-001' },
    })
    expect(byId.get('p2')).toMatchObject({
      conversationStatus: 'no conversation',
      identity: { source: 'account' },
    })
    expect(byId.get('invited@example.org')).toMatchObject({
      rosterStatus: 'invited, not joined',
      identity: { source: 'invitation' },
    })
    expect(byId.get('outsider')).toMatchObject({
      rosterStatus: 'not in roster',
      identity: { source: 'missing' },
    })
  })
})

describe('serialization', () => {
  it('neutralises spreadsheet formulas and quotes separators', () => {
    expect(escapeCsvValue('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(escapeCsvValue('\t=cmd')).toBe("'\t=cmd")
    expect(escapeCsvValue('a,"b"')).toBe('"a,""b"""')
    expect(
      toIndexCsv(
        buildConversationExport({ metadata, roster: [], threads: [] })
      ).startsWith('﻿')
    ).toBe(true)
  })

  it('escapes student text in the transcript page', () => {
    const exported = buildConversationExport({
      metadata,
      roster: [rosterEntry()],
      threads: [
        {
          id: 't1',
          participantId: 'p1',
          title: '<b>title</b>',
          createdAt: new Date('2026-12-16T09:00:00Z'),
          messages: [
            message('q1', 0, {
              content: [{ type: 'text', text: '<script>alert(1)</script>' }],
            }),
          ],
        },
      ],
    })

    const html = toTranscriptHtml(exported)
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>title</b>')
  })
})
